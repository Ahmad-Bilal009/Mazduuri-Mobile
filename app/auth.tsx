import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { authApi, ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useSavedStore } from "@/store/savedStore";
import {
  signInWithGoogle,
  GoogleSignInCancelled,
  isGoogleAvailable,
  isGoogleConfigured,
} from "@/lib/googleAuth";
import type { AuthResponse } from "@/types";

type Step = "method" | "email" | "phone" | "otp" | "role";

/** Which entry path the pending role step belongs to. */
type PendingIdentity = "google" | "email" | "phone";

const RESEND_SECONDS = 60;
const MIN_PASSWORD = 8;

/**
 * Shows the "phone number" entry point on the sign-in screen.
 *
 * Off until phone verification ships. The whole phone → WhatsApp OTP → role
 * flow below is intact and the backend routes are live; this only controls
 * whether there is a way in from the UI. Flip to true to bring it back.
 */
const PHONE_LOGIN_ENABLED = false;

export default function AuthScreen() {
  const router = useRouter();
  const { setUser } = useAuthStore();

  const [step, setStep] = useState<Step>("method");
  const [pending, setPending] = useState<PendingIdentity>("phone");

  // Phone / OTP — kept alongside the new paths; phone verification is planned
  // for a later release and this flow stays reachable in the meantime.
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [activeOtpIndex, setActiveOtpIndex] = useState(0);
  const [isNewUser, setIsNewUser] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  // Email + password
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authMode, setAuthMode] = useState<"register" | "login">("register");

  // Google
  const [googleIdToken, setGoogleIdToken] = useState<string | null>(null);
  const [googleEmail, setGoogleEmail] = useState("");

  // Basic account details
  const [role, setRole] = useState<"worker" | "client">("client");
  const [fullName, setFullName] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const otpRefs = useRef<(TextInput | null)[]>([]);

  const normalizedPhone = `+92${phone.replace(/^0/, "")}`;
  const displayPhone = `+92 ${phone.replace(/^0/, "").replace(/(\d{3})(\d{7})/, "$1 $2")}`;

  // Resend countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendIn > 0]);

  // ─── Shared tail ───────────────────────────────────────────────────────────

  /**
   * Every successful sign-in ends here. A basic account is all that is needed
   * to browse — the full profile (phone, location, documents) is completed
   * later from the Profile tab, so nothing is forced on the way in.
   */
  async function afterAuth(_res: AuthResponse) {
    setUser(_res.user, _res.token);
    // Warm the saved-workers set so hearts render correctly straight away.
    void useSavedStore.getState().hydrate();
    router.back();
  }

  // ─── Google ────────────────────────────────────────────────────────────────

  async function handleGoogleSignIn() {
    setError("");
    setLoading(true);
    try {
      const google = await signInWithGoogle();
      setGoogleIdToken(google.idToken);
      setGoogleEmail(google.email);

      try {
        // Returning user — the backend already knows this Google account.
        const res = await authApi.google(google.idToken);
        await afterAuth(res);
      } catch (err: unknown) {
        if (err instanceof ApiError && err.code === "ROLE_REQUIRED") {
          if (google.name) setFullName(google.name);
          setPending("google");
          setStep("role");
          return;
        }
        throw err;
      }
    } catch (err: unknown) {
      // Backing out of the Google sheet is a normal action, not a failure.
      if (err instanceof GoogleSignInCancelled) return;
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  async function completeGoogleSignUp(selectedRole: "worker" | "client") {
    if (!googleIdToken) return;
    setError("");
    setLoading(true);
    try {
      const res = await authApi.google(googleIdToken, selectedRole, fullName.trim());
      await afterAuth(res);
    } catch (err: unknown) {
      // Google ID tokens last about an hour; a stale one has to be re-issued.
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  // ─── Email + password ──────────────────────────────────────────────────────

  function validateEmailStep(): boolean {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid email address");
      return false;
    }
    if (authMode === "register" && password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters`);
      return false;
    }
    if (!password) {
      setError("Enter your password");
      return false;
    }
    return true;
  }

  async function handleEmailContinue() {
    setError("");
    if (!validateEmailStep()) return;

    if (authMode === "login") {
      setLoading(true);
      try {
        const res = await authApi.login(email.trim(), password);
        await afterAuth(res);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Could not sign in");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Registering: name and role are collected on the next step, then sent
    // together so no half-built account exists if the user backs out.
    setPending("email");
    setStep("role");
  }

  async function completeEmailRegister(selectedRole: "worker" | "client") {
    setError("");
    setLoading(true);
    try {
      const res = await authApi.register({
        email: email.trim(),
        password,
        name: fullName.trim(),
        role: selectedRole,
      });
      await afterAuth(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create account");
      // Nothing was created, so send them back to fix the address or password.
      if (err instanceof ApiError && err.code === "CONFLICT") setStep("email");
    } finally {
      setLoading(false);
    }
  }

  // ─── Phone / OTP ───────────────────────────────────────────────────────────

  async function handleSendOtp() {
    setError("");
    setLoading(true);
    try {
      const res = await authApi.sendOtp(normalizedPhone);
      setIsNewUser(res.isNewUser);
      setOtp(["", "", "", "", "", ""]);
      setResendIn(RESEND_SECONDS);
      setStep("otp");
      setTimeout(() => otpRefs.current[0]?.focus(), 350);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function completeVerification(selectedRole?: "worker" | "client") {
    const code = otp.join("");
    setError("");
    setLoading(true);
    try {
      const res = await authApi.verifyOtp(normalizedPhone, code, selectedRole);
      await afterAuth(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  function handleVerifyPressed() {
    const code = otp.join("");
    if (code.length < 6) {
      setError("Enter all 6 digits");
      return;
    }
    if (isNewUser) {
      setError("");
      setPending("phone");
      setStep("role");
    } else {
      completeVerification();
    }
  }

  function handleOtpChange(index: number, value: string) {
    // Support pasting the whole code into one box
    if (value.length > 1) {
      const digits = value.replace(/\D/g, "").slice(0, 6).split("");
      if (digits.length) {
        const newOtp = ["", "", "", "", "", ""];
        digits.forEach((d, i) => { newOtp[i] = d; });
        setOtp(newOtp);
        const next = Math.min(digits.length, 5);
        otpRefs.current[next]?.focus();
      }
      return;
    }
    if (!/^\d?$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyPress(index: number, key: string) {
    if (key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  // ─── Role step ─────────────────────────────────────────────────────────────

  function handleContinuePressed() {
    if (fullName.trim().length < 2) {
      setError("Please enter your full name");
      return;
    }
    setError("");
    if (pending === "google") completeGoogleSignUp(role);
    else if (pending === "email") completeEmailRegister(role);
    else completeVerification(role);
  }

  // ─── Navigation ────────────────────────────────────────────────────────────

  function handleBack() {
    setError("");
    if (step === "otp") setStep("phone");
    else if (step === "phone" || step === "email") setStep("method");
    else if (step === "role") {
      // Return to whichever path opened this step.
      if (pending === "google") {
        setGoogleIdToken(null);
        setGoogleEmail("");
        setStep("method");
      } else if (pending === "email") {
        setStep("email");
      } else {
        setStep("otp");
      }
    } else router.back();
  }

  const comingSoon = (provider: string) =>
    Alert.alert(provider, `${provider} sign-in is coming soon. Please continue with Google or email.`);

  // Which locked identity to show on the role step
  const identity =
    pending === "google"
      ? { icon: "google" as const, label: "Google account", value: googleEmail }
      : pending === "email"
        ? { icon: "email-outline" as const, label: "Email", value: email.trim() }
        : { icon: null, label: "Phone", value: displayPhone };

  const bottomBarStep = step === "otp" || step === "role" || step === "email";

  // Google needs both a Web client ID and the native module compiled into this
  // binary. The two failure modes need different answers, so they are reported
  // separately rather than as one "unavailable".
  const googleReady = isGoogleAvailable();

  function explainGoogleUnavailable() {
    Alert.alert(
      "Google sign-in unavailable",
      isGoogleConfigured
        ? "This build of the app doesn't include Google sign-in yet. Rebuild the app, or continue with email."
        : "No Google client ID is configured for this build. Please continue with email.",
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* Back */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleBack} hitSlop={10}>
            <MaterialCommunityIcons name="arrow-left" size={26} color="#111827" />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Step: Choose a method ── */}
          {step === "method" && (
            <>
              <View style={styles.logoContainer}>
                <Image
                  source={require("../assets/icon.png")}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
                <Text style={styles.title}>Welcome to Mazduuri</Text>
                <Text style={styles.subtitle}>
                  Create your account or log in to continue
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.socialBtn, loading && styles.disabled]}
                onPress={googleReady ? handleGoogleSignIn : explainGoogleUnavailable}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#6b7280" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="google" size={20} color="#EA4335" />
                    <Text style={styles.socialBtnText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.waBtn}
                onPress={() => {
                  setAuthMode("register");
                  setError("");
                  setStep("email");
                }}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="email-outline" size={21} color="#fff" />
                <Text style={styles.waBtnText}>Continue with Email</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => comingSoon("Apple")}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="apple" size={22} color="#111827" />
                <Text style={styles.socialBtnText}>Continue with Apple</Text>
              </TouchableOpacity>

              {PHONE_LOGIN_ENABLED && (
                <>
                  <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <TouchableOpacity
                    style={styles.textBtn}
                    onPress={() => {
                      setError("");
                      setStep("phone");
                    }}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="phone-outline" size={18} color="#16a34a" />
                    <Text style={styles.textBtnLabel}>Use phone number instead</Text>
                  </TouchableOpacity>
                </>
              )}

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Text style={styles.terms}>
                By continuing you agree to <Text style={styles.termsLink}>Terms</Text>
                {" "}&{" "}<Text style={styles.termsLink}>Privacy</Text>
              </Text>
            </>
          )}

          {/* ── Step: Email + password ── */}
          {step === "email" && (
            <>
              <Text style={styles.bigTitle}>
                {authMode === "register" ? "Create account" : "Welcome back"}
              </Text>
              <Text style={styles.sentTo}>
                {authMode === "register"
                  ? "Use your email and a password you'll remember"
                  : "Log in with your email and password"}
              </Text>

              <View style={styles.fieldBox}>
                <MaterialCommunityIcons name="email-outline" size={20} color="#6b7280" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Email</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="you@example.com"
                    placeholderTextColor="#9ca3af"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    maxLength={254}
                  />
                </View>
              </View>

              <View style={styles.fieldBox}>
                <MaterialCommunityIcons name="lock-outline" size={20} color="#6b7280" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Password</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder={
                      authMode === "register" ? `At least ${MIN_PASSWORD} characters` : "Your password"
                    }
                    placeholderTextColor="#9ca3af"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete={authMode === "register" ? "new-password" : "current-password"}
                    maxLength={128}
                    onSubmitEditing={handleEmailContinue}
                    returnKeyType="go"
                  />
                </View>
                <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                  <MaterialCommunityIcons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="#9ca3af"
                  />
                </TouchableOpacity>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={styles.modeToggle}
                onPress={() => {
                  setAuthMode((m) => (m === "register" ? "login" : "register"));
                  setError("");
                }}
                hitSlop={8}
              >
                <Text style={styles.modeToggleText}>
                  {authMode === "register"
                    ? "Already have an account? Log in"
                    : "New here? Create an account"}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Step: Phone ── */}
          {step === "phone" && (
            <>
              <Text style={styles.bigTitle}>Your phone number</Text>
              <Text style={styles.sentTo}>We'll send a one-time code over WhatsApp</Text>

              <View style={styles.phoneRow}>
                <View style={styles.countryBox}>
                  <Text style={styles.flag}>🇵🇰</Text>
                  <Text style={styles.countryCode}>+92</Text>
                  <MaterialCommunityIcons name="chevron-down" size={18} color="#9ca3af" />
                </View>
                <TextInput
                  style={styles.phoneField}
                  placeholder="300 1234567"
                  placeholderTextColor="#9ca3af"
                  value={phone}
                  onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, ""))}
                  keyboardType="phone-pad"
                  maxLength={11}
                />
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.waBtn, (loading || phone.replace(/^0/, "").length < 10) && styles.disabled]}
                onPress={handleSendOtp}
                disabled={loading || phone.replace(/^0/, "").length < 10}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="whatsapp" size={22} color="#fff" />
                    <Text style={styles.waBtnText}>Send OTP on WhatsApp</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* ── Step: OTP ── */}
          {step === "otp" && (
            <>
              <Text style={styles.bigTitle}>Enter OTP</Text>
              <Text style={styles.sentTo}>Sent to {displayPhone}</Text>

              <View style={styles.otpRow}>
                {otp.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={(el) => {
                      otpRefs.current[i] = el;
                    }}
                    style={[styles.otpBox, activeOtpIndex === i && styles.otpBoxActive]}
                    value={digit}
                    onChangeText={(v) => handleOtpChange(i, v)}
                    onKeyPress={(e) => handleOtpKeyPress(i, e.nativeEvent.key)}
                    onFocus={() => setActiveOtpIndex(i)}
                    keyboardType="numeric"
                    maxLength={i === 0 ? 6 : 1}
                    textAlign="center"
                    autoFocus={i === 0}
                  />
                ))}
              </View>

              {resendIn > 0 ? (
                <Text style={styles.resendWait}>
                  Resend in{" "}
                  <Text style={styles.resendTimer}>
                    0:{String(resendIn).padStart(2, "0")}
                  </Text>
                </Text>
              ) : (
                <TouchableOpacity onPress={handleSendOtp} style={{ alignSelf: "center" }}>
                  <Text style={styles.resendLink}>Resend OTP</Text>
                </TouchableOpacity>
              )}

              {error ? <Text style={styles.error}>{error}</Text> : null}
            </>
          )}

          {/* ── Step: Role + name ── */}
          {step === "role" && (
            <>
              <Text style={styles.bigTitle}>I want to...</Text>
              <Text style={styles.sentTo}>Choose the option that best describes you</Text>

              <View style={styles.roleRow}>
                <RoleCard
                  icon="briefcase"
                  title="Hire Workers"
                  description="I want to hire skilled workers"
                  selected={role === "client"}
                  onPress={() => setRole("client")}
                />
                <RoleCard
                  icon="hammer"
                  title="Offer Services"
                  description="I want to offer my skills and services"
                  selected={role === "worker"}
                  onPress={() => setRole("worker")}
                />
              </View>

              {/* Full name */}
              <View style={styles.fieldBox}>
                <MaterialCommunityIcons name="account-outline" size={20} color="#6b7280" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Full name</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Ahmed Raza"
                    placeholderTextColor="#9ca3af"
                    value={fullName}
                    onChangeText={setFullName}
                    maxLength={100}
                  />
                </View>
              </View>

              {/* Verified identity (locked) */}
              <View style={[styles.fieldBox, { opacity: 0.7 }]}>
                {identity.icon ? (
                  <MaterialCommunityIcons
                    name={identity.icon}
                    size={20}
                    color={identity.icon === "google" ? "#EA4335" : "#6b7280"}
                  />
                ) : (
                  <Text style={styles.flag}>🇵🇰</Text>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>{identity.label}</Text>
                  <Text style={styles.fieldStatic} numberOfLines={1}>
                    {identity.value}
                  </Text>
                </View>
                <MaterialCommunityIcons name="lock-outline" size={16} color="#9ca3af" />
              </View>

              <Text style={styles.roleFootnote}>
                You can add your phone, location and documents from your profile
                once you're in.
              </Text>

              {error ? <Text style={styles.error}>{error}</Text> : null}
            </>
          )}
        </ScrollView>

        {/* Bottom-pinned action */}
        {bottomBarStep && (
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                (loading || (step === "otp" && otp.join("").length < 6)) && styles.disabled,
              ]}
              onPress={
                step === "otp"
                  ? handleVerifyPressed
                  : step === "email"
                    ? handleEmailContinue
                    : handleContinuePressed
              }
              disabled={loading || (step === "otp" && otp.join("").length < 6)}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {step === "otp"
                    ? "Verify"
                    : step === "email" && authMode === "login"
                      ? "Log in"
                      : "Continue"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Role card ────────────────────────────────────────────────────────────────

function RoleCard({
  icon,
  title,
  description,
  selected,
  onPress,
}: {
  icon: string;
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.roleCard, selected && styles.roleCardSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.roleIconCircle, selected && styles.roleIconCircleSelected]}>
        <MaterialCommunityIcons name={icon} size={30} color={selected ? "#16a34a" : "#6b7280"} />
      </View>
      <Text style={styles.roleTitle}>{title}</Text>
      <Text style={styles.roleDesc}>{description}</Text>
      {selected ? (
        <MaterialCommunityIcons name="check-circle" size={24} color="#16a34a" />
      ) : (
        <View style={styles.roleRadio} />
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  topBar: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 },

  // Phone step
  logoContainer: { alignItems: "center", marginTop: 16, marginBottom: 30 },
  logoImage: { width: 170, height: 76, marginBottom: 14 },
  title: { fontSize: 26, fontWeight: "800", color: "#111827" },
  subtitle: { fontSize: 14.5, color: "#6b7280", marginTop: 6, textAlign: "center" },

  phoneRow: { flexDirection: "row", gap: 10 },
  countryBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 56,
    backgroundColor: "#fff",
  },
  flag: { fontSize: 18 },
  countryCode: { fontSize: 15.5, fontWeight: "600", color: "#111827" },
  phoneField: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 56,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#fff",
  },

  waBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#16a34a",
    borderRadius: 14,
    height: 54,
    marginTop: 20,
  },
  waBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#e5e7eb" },
  dividerText: { fontSize: 13, color: "#9ca3af" },

  socialBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    height: 54,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  socialBtnText: { fontSize: 15.5, fontWeight: "600", color: "#111827" },

  textBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
  },
  textBtnLabel: { fontSize: 15, fontWeight: "600", color: "#16a34a" },

  modeToggle: { alignSelf: "center", marginTop: 20, paddingVertical: 6 },
  modeToggleText: { fontSize: 14.5, color: "#16a34a", fontWeight: "600" },

  roleFootnote: {
    fontSize: 12.5,
    color: "#6b7280",
    lineHeight: 18,
    marginTop: 2,
  },

  terms: {
    fontSize: 12.5,
    color: "#6b7280",
    textAlign: "center",
    marginTop: "auto",
    paddingTop: 24,
  },
  termsLink: { color: "#16a34a", fontWeight: "600" },

  // OTP step
  bigTitle: { fontSize: 28, fontWeight: "800", color: "#111827", marginTop: 12 },
  sentTo: { fontSize: 14.5, color: "#6b7280", marginTop: 8, marginBottom: 28 },
  otpRow: { flexDirection: "row", gap: 9, justifyContent: "space-between" },
  otpBox: {
    flex: 1,
    height: 60,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    backgroundColor: "#fff",
  },
  otpBoxActive: { borderColor: "#16a34a" },
  resendWait: { fontSize: 14, color: "#6b7280", textAlign: "center", marginTop: 26 },
  resendTimer: { color: "#16a34a", fontWeight: "700" },
  resendLink: { fontSize: 14.5, color: "#16a34a", fontWeight: "700", marginTop: 26 },

  // Role step
  roleRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  roleCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  roleCardSelected: { borderColor: "#16a34a", backgroundColor: "#f7fdf9" },
  roleIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  roleIconCircleSelected: { backgroundColor: "#dcfce7" },
  roleTitle: { fontSize: 15.5, fontWeight: "700", color: "#111827", textAlign: "center" },
  roleDesc: {
    fontSize: 12.5,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 17,
    marginTop: 5,
    marginBottom: 14,
    minHeight: 34,
  },
  roleRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#d1d5db",
  },

  fieldBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: "#fff",
    minHeight: 62,
  },
  fieldLabel: { fontSize: 11.5, color: "#9ca3af", marginBottom: 1 },
  fieldInput: { fontSize: 15.5, color: "#111827", padding: 0 },
  fieldStatic: { fontSize: 15.5, color: "#111827", fontWeight: "500" },

  // Bottom bar
  bottomBar: { paddingHorizontal: 24, paddingBottom: 10, paddingTop: 8 },
  primaryBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 14,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 17 },
  disabled: { opacity: 0.5 },

  error: {
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    padding: 10,
    marginTop: 14,
    color: "#ef4444",
    fontSize: 13,
    textAlign: "center",
  },

});
