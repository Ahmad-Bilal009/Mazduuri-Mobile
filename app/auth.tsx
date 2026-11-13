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
  Alert,
  Pressable,
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useRouter, useLocalSearchParams } from "expo-router";
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

/**
 * Sign in / sign up.
 *
 * - Sign in: mobile number or email + password.
 * - Sign up: role, name, email, mobile, password → 6-digit code emailed →
 *   account works once the code is entered.
 * - Forgot password: code emailed to the account's address → new password.
 * - Google: one tap; brand-new Google users pick a role first.
 * - Guests can skip all of this and browse.
 */

type Step = "signin" | "signup" | "verify" | "forgot" | "reset" | "googleRole";
type Role = "client" | "worker";

const MIN_PASSWORD = 8;
const RESEND_SECONDS = 60;

const GREEN = "#22c55e";
const GREEN_DARK = "#16a34a";
const INK = "#0f172a";
const MUTED = "#475569";
const BORDER = "#e2e8f0";

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; role?: string }>();
  const { setUser } = useAuthStore();

  const [step, setStep] = useState<Step>(params.mode === "signup" ? "signup" : "signin");

  // Shared form state
  const [identifier, setIdentifier] = useState(""); // sign in / forgot: mobile or email
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<Role>(params.role === "worker" ? "worker" : "client");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Code steps
  const [code, setCode] = useState("");
  const [codeTarget, setCodeTarget] = useState(""); // identifier the code belongs to
  const [codeNote, setCodeNote] = useState(""); // "We sent a code to a***@gmail.com"
  const [resendIn, setResendIn] = useState(0);
  const [newPassword, setNewPassword] = useState("");

  // Google
  const [googleIdToken, setGoogleIdToken] = useState<string | null>(null);

  const [loading, setLoading] = useState<null | "primary" | "google" | "resend">(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendIn > 0]);

  function go(next: Step) {
    setError("");
    setStep(next);
  }

  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }

  async function afterAuth(res: AuthResponse) {
    setUser(res.user, res.token);
    // Warm the saved-workers set so hearts render correctly straight away.
    void useSavedStore.getState().hydrate();
    leave();
  }

  function startCodeStep(target: string, note: string, next: "verify" | "reset") {
    setCodeTarget(target);
    setCodeNote(note);
    setCode("");
    setNewPassword("");
    setResendIn(RESEND_SECONDS);
    go(next);
  }

  // ─── Sign in ───────────────────────────────────────────────────────────────

  async function handleSignIn() {
    const id = identifier.trim();
    if (!id) return setError("Enter your mobile number or email");
    if (!password) return setError("Enter your password");
    setError("");
    setLoading("primary");
    try {
      await afterAuth(await authApi.login(toIdentifier(id), password));
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === "EMAIL_NOT_VERIFIED") {
        startCodeStep(toIdentifier(id), err.message, "verify");
        return;
      }
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setLoading(null);
    }
  }

  // ─── Sign up ───────────────────────────────────────────────────────────────

  async function handleSignUp() {
    if (fullName.trim().length < 2) return setError("Enter your full name");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address");
    if (!/^0?3\d{9}$/.test(phone.trim())) return setError("Enter a valid mobile number, e.g. 300 1234567");
    if (password.length < MIN_PASSWORD) {
      return setError(`Password must be at least ${MIN_PASSWORD} characters`);
    }
    setError("");
    setLoading("primary");
    try {
      const res = await authApi.register({
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
        role,
      });
      startCodeStep(
        email.trim().toLowerCase(),
        `We sent a 6-digit code to ${res.destination}. Enter it to finish creating your account.`,
        "verify",
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create your account");
    } finally {
      setLoading(null);
    }
  }

  // ─── Codes ─────────────────────────────────────────────────────────────────

  async function handleVerify() {
    if (code.length !== 6) return setError("Enter the 6-digit code");
    setError("");
    setLoading("primary");
    try {
      await afterAuth(await authApi.verifyEmail(codeTarget, code));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not verify the code");
    } finally {
      setLoading(null);
    }
  }

  async function handleResend() {
    setError("");
    setLoading("resend");
    try {
      await authApi.resendEmailCode(codeTarget, step === "reset" ? "reset_password" : "verify_email");
      setCode("");
      setResendIn(RESEND_SECONDS);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not resend the code");
    } finally {
      setLoading(null);
    }
  }

  async function handleForgot() {
    const id = identifier.trim();
    if (!id) return setError("Enter your mobile number or email");
    setError("");
    setLoading("primary");
    try {
      await authApi.forgotPassword(toIdentifier(id));
      startCodeStep(
        toIdentifier(id),
        "If an account exists, we've emailed a 6-digit code to the address on it.",
        "reset",
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not send the code");
    } finally {
      setLoading(null);
    }
  }

  async function handleReset() {
    if (code.length !== 6) return setError("Enter the 6-digit code");
    if (newPassword.length < MIN_PASSWORD) {
      return setError(`Password must be at least ${MIN_PASSWORD} characters`);
    }
    setError("");
    setLoading("primary");
    try {
      await afterAuth(await authApi.resetPassword(codeTarget, code, newPassword));
      Alert.alert("Password updated", "You're signed in with your new password.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not reset your password");
    } finally {
      setLoading(null);
    }
  }

  // ─── Google ────────────────────────────────────────────────────────────────

  const googleReady = isGoogleAvailable();

  async function handleGoogle() {
    if (!googleReady) {
      Alert.alert(
        "Google sign-in unavailable",
        isGoogleConfigured
          ? "This build of the app doesn't include Google sign-in yet. Please use your mobile number or email."
          : "Google sign-in isn't configured for this build. Please use your mobile number or email.",
      );
      return;
    }
    setError("");
    setLoading("google");
    try {
      const google = await signInWithGoogle();
      try {
        await afterAuth(await authApi.google(google.idToken));
      } catch (err: unknown) {
        if (err instanceof ApiError && err.code === "ROLE_REQUIRED") {
          // From sign-up the role is already chosen; from sign-in, ask once.
          if (step === "signup") {
            await afterAuth(
              await authApi.google(google.idToken, role, fullName.trim() || google.name || undefined),
            );
          } else {
            setGoogleIdToken(google.idToken);
            if (google.name) setFullName(google.name);
            go("googleRole");
          }
          return;
        }
        throw err;
      }
    } catch (err: unknown) {
      if (err instanceof GoogleSignInCancelled) return;
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setLoading(null);
    }
  }

  async function finishGoogle() {
    if (!googleIdToken) return go("signin");
    if (fullName.trim().length < 2) return setError("Enter your full name");
    setError("");
    setLoading("primary");
    try {
      await afterAuth(await authApi.google(googleIdToken, role, fullName.trim()));
    } catch (err: unknown) {
      // Google ID tokens last about an hour; a stale one needs a fresh sign-in.
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setLoading(null);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const isEntry = step === "signin" || step === "signup";

  function back() {
    setError("");
    if (step === "verify") go(codeTarget.includes("@") && email ? "signup" : "signin");
    else if (step === "forgot" || step === "googleRole") go("signin");
    else if (step === "reset") go("forgot");
    else leave();
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top row: brand, or back for inner steps */}
          <View style={styles.topRow}>
            {isEntry ? (
              <View style={styles.brand}>
                <View style={styles.brandIcon}>
                  <MaterialCommunityIcons name="hammer" size={24} color="#fff" />
                </View>
                <Text style={styles.brandText}>Mazduuri</Text>
              </View>
            ) : (
              <TouchableOpacity onPress={back} hitSlop={10} style={styles.backBtn}>
                <MaterialCommunityIcons name="arrow-left" size={24} color={INK} />
              </TouchableOpacity>
            )}
          </View>

          {isEntry && <TrustRow />}

          {/* ── Sign in ── */}
          {step === "signin" && (
            <>
              <Text style={styles.title}>Welcome back.</Text>
              <Text style={styles.subtitle}>
                Your next job—or the right person for it—is just a few taps away.
              </Text>

              <Label text="Mobile number or email" />
              <IdentifierField value={identifier} onChange={setIdentifier} />

              <View style={styles.labelRow}>
                <Text style={styles.label}>Password</Text>
                <TouchableOpacity onPress={() => go("forgot")} hitSlop={8}>
                  <Text style={styles.link}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
              <PasswordField
                value={password}
                onChange={setPassword}
                show={showPassword}
                onToggle={() => setShowPassword((v) => !v)}
                placeholder="Enter your password"
                autoComplete="current-password"
                onSubmit={handleSignIn}
              />

              <ErrorText text={error} />
              <PrimaryButton label="Sign in" loading={loading === "primary"} onPress={handleSignIn} />
              <OrDivider />
              <GoogleButton loading={loading === "google"} onPress={handleGoogle} disabled={!!loading} />

              <Text style={styles.switchText}>
                New to Mazduuri?{" "}
                <Text style={styles.switchLink} onPress={() => go("signup")}>
                  Create an account
                </Text>
              </Text>
              <GuestLink onPress={leave} />
              <Footer />
            </>
          )}

          {/* ── Sign up ── */}
          {step === "signup" && (
            <>
              <Text style={styles.title}>Find your people.</Text>
              <Text style={styles.subtitle}>
                One simple account to get the work done—or get your next job.
              </Text>

              <Label text="I want to" />
              <RoleSwitch value={role} onChange={setRole} />

              <Label text="Full name" />
              <View style={styles.field}>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Ayesha Khan"
                  placeholderTextColor="#94a3b8"
                  value={fullName}
                  onChangeText={setFullName}
                  autoComplete="name"
                  maxLength={100}
                />
              </View>

              <Label text="Email" />
              <View style={styles.field}>
                <MaterialCommunityIcons name="email-outline" size={20} color={MUTED} />
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor="#94a3b8"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  maxLength={254}
                />
              </View>

              <Label text="Mobile number" />
              <View style={styles.field}>
                <MaterialCommunityIcons name="phone-outline" size={20} color={MUTED} />
                <Text style={styles.prefix}>+92</Text>
                <View style={styles.prefixDivider} />
                <TextInput
                  style={styles.input}
                  placeholder="300 1234567"
                  placeholderTextColor="#94a3b8"
                  value={phone}
                  onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, ""))}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  maxLength={11}
                />
              </View>

              <Label text="Password" />
              <PasswordField
                value={password}
                onChange={setPassword}
                show={showPassword}
                onToggle={() => setShowPassword((v) => !v)}
                placeholder={`At least ${MIN_PASSWORD} characters`}
                autoComplete="new-password"
                onSubmit={handleSignUp}
              />

              <ErrorText text={error} />
              <PrimaryButton label="Create account" loading={loading === "primary"} onPress={handleSignUp} />
              <OrDivider />
              <GoogleButton loading={loading === "google"} onPress={handleGoogle} disabled={!!loading} />

              <Text style={styles.switchText}>
                Already have an account?{" "}
                <Text style={styles.switchLink} onPress={() => go("signin")}>
                  Sign in
                </Text>
              </Text>
              <GuestLink onPress={leave} />
              <Footer />
            </>
          )}

          {/* ── Verify email ── */}
          {step === "verify" && (
            <>
              <IconBadge name="email-check-outline" />
              <Text style={styles.title}>Check your email.</Text>
              <Text style={styles.subtitle}>{codeNote}</Text>

              <CodeInput value={code} onChange={setCode} onComplete={handleVerify} />
              <ResendRow seconds={resendIn} loading={loading === "resend"} onResend={handleResend} />

              <ErrorText text={error} />
              <PrimaryButton label="Verify email" loading={loading === "primary"} onPress={handleVerify} />
              <Text style={styles.hint}>Can't find it? Check your spam or promotions folder.</Text>
            </>
          )}

          {/* ── Forgot password ── */}
          {step === "forgot" && (
            <>
              <IconBadge name="lock-reset" />
              <Text style={styles.title}>Forgot password?</Text>
              <Text style={styles.subtitle}>
                Enter the mobile number or email on your account. We'll email you a code to reset
                your password.
              </Text>

              <Label text="Mobile number or email" />
              <IdentifierField value={identifier} onChange={setIdentifier} onSubmit={handleForgot} />

              <ErrorText text={error} />
              <PrimaryButton label="Send code" loading={loading === "primary"} onPress={handleForgot} />
            </>
          )}

          {/* ── Reset password ── */}
          {step === "reset" && (
            <>
              <IconBadge name="shield-key-outline" />
              <Text style={styles.title}>Set a new password.</Text>
              <Text style={styles.subtitle}>{codeNote}</Text>

              <Label text="6-digit code" />
              <CodeInput value={code} onChange={setCode} />
              <ResendRow seconds={resendIn} loading={loading === "resend"} onResend={handleResend} />

              <Label text="New password" />
              <PasswordField
                value={newPassword}
                onChange={setNewPassword}
                show={showPassword}
                onToggle={() => setShowPassword((v) => !v)}
                placeholder={`At least ${MIN_PASSWORD} characters`}
                autoComplete="new-password"
                onSubmit={handleReset}
              />

              <ErrorText text={error} />
              <PrimaryButton label="Reset password" loading={loading === "primary"} onPress={handleReset} />
            </>
          )}

          {/* ── New Google user: pick a role ── */}
          {step === "googleRole" && (
            <>
              <IconBadge name="account-check-outline" />
              <Text style={styles.title}>One last thing.</Text>
              <Text style={styles.subtitle}>Tell us how you'll use Mazduuri.</Text>

              <Label text="I want to" />
              <RoleSwitch value={role} onChange={setRole} />

              <Label text="Full name" />
              <View style={styles.field}>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Ayesha Khan"
                  placeholderTextColor="#94a3b8"
                  value={fullName}
                  onChangeText={setFullName}
                  maxLength={100}
                />
              </View>

              <ErrorText text={error} />
              <PrimaryButton label="Continue" loading={loading === "primary"} onPress={finishGoogle} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Digits typed into the identifier field are a mobile number; send them as such. */
function toIdentifier(raw: string): string {
  const t = raw.trim();
  if (t.includes("@")) return t.toLowerCase();
  return t.replace(/[\s-]/g, "");
}

function looksLikeEmail(v: string) {
  return /[a-zA-Z@]/.test(v);
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

function TrustRow() {
  const faces = [
    { bg: "#f97316", icon: "account-hard-hat" },
    { bg: "#16a34a", icon: "account-wrench" },
    { bg: "#2563eb", icon: "account-tie" },
  ];
  return (
    <View style={styles.trustRow}>
      <View style={styles.faces}>
        {faces.map((f, i) => (
          <View key={f.icon} style={[styles.face, { backgroundColor: f.bg, marginLeft: i === 0 ? 0 : -10 }]}>
            <MaterialCommunityIcons name={f.icon} size={20} color="#fff" />
          </View>
        ))}
      </View>
      <MaterialCommunityIcons name="check-circle-outline" size={16} color={GREEN_DARK} />
      <Text style={styles.trustText}>Trusted skilled hands</Text>
    </View>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={[styles.label, { marginTop: 18 }]}>{text}</Text>;
}

function ErrorText({ text }: { text: string }) {
  if (!text) return null;
  return (
    <View style={styles.errorBox}>
      <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#dc2626" />
      <Text style={styles.errorText}>{text}</Text>
    </View>
  );
}

function IdentifierField({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
}) {
  const email = looksLikeEmail(value);
  return (
    <View style={styles.field}>
      <MaterialCommunityIcons name={email ? "email-outline" : "phone-outline"} size={20} color={MUTED} />
      {!email && (
        <>
          <Text style={styles.prefix}>+92</Text>
          <View style={styles.prefixDivider} />
        </>
      )}
      <TextInput
        style={styles.input}
        placeholder="300 1234567 or email"
        placeholderTextColor="#94a3b8"
        value={value}
        onChangeText={onChange}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        maxLength={254}
        returnKeyType={onSubmit ? "go" : "next"}
        onSubmitEditing={onSubmit}
      />
    </View>
  );
}

function PasswordField({
  value,
  onChange,
  show,
  onToggle,
  placeholder,
  autoComplete,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder: string;
  autoComplete: "current-password" | "new-password";
  onSubmit?: () => void;
}) {
  return (
    <View style={styles.field}>
      <MaterialCommunityIcons name="lock-outline" size={20} color={MUTED} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        value={value}
        onChangeText={onChange}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={autoComplete}
        maxLength={128}
        returnKeyType="go"
        onSubmitEditing={onSubmit}
      />
      <TouchableOpacity onPress={onToggle} hitSlop={8}>
        <MaterialCommunityIcons name={show ? "eye-off-outline" : "eye-outline"} size={20} color={MUTED} />
      </TouchableOpacity>
    </View>
  );
}

function RoleSwitch({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  const options: { key: Role; label: string; icon: string }[] = [
    { key: "client", label: "Hire a worker", icon: "briefcase-outline" },
    { key: "worker", label: "Find work", icon: "account-outline" },
  ];
  return (
    <View style={styles.segment}>
      {options.map((o) => {
        const active = value === o.key;
        return (
          <TouchableOpacity
            key={o.key}
            style={[styles.segmentItem, active && styles.segmentItemActive]}
            onPress={() => onChange(o.key)}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name={o.icon} size={18} color={active ? INK : MUTED} />
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function PrimaryButton({ label, loading, onPress }: { label: string; loading: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.primaryBtn, loading && { opacity: 0.8 }]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          <Text style={styles.primaryText}>{label}</Text>
          <MaterialCommunityIcons name="arrow-right" size={18} color="#fff" />
        </>
      )}
    </TouchableOpacity>
  );
}

function OrDivider() {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>or continue with</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

function GoogleButton({ loading, onPress, disabled }: { loading: boolean; onPress: () => void; disabled: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.googleBtn, disabled && !loading && { opacity: 0.6 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color={MUTED} />
      ) : (
        <>
          <View style={styles.gBadge}>
            <Text style={styles.gText}>G</Text>
          </View>
          <Text style={styles.googleText}>Continue with Google</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

function GuestLink({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.guestBtn} onPress={onPress} hitSlop={8}>
      <MaterialCommunityIcons name="account-outline" size={17} color={MUTED} />
      <Text style={styles.guestText}>Continue as guest</Text>
    </TouchableOpacity>
  );
}

function Footer() {
  return (
    <View style={styles.footer}>
      <MaterialCommunityIcons name="shield-check-outline" size={15} color={GREEN_DARK} />
      <Text style={styles.footerText}>Your details stay safe with us</Text>
      <MaterialCommunityIcons name="account-group-outline" size={15} color={MUTED} style={{ marginLeft: 12 }} />
      <Text style={styles.footerText}>Across Pakistan</Text>
    </View>
  );
}

function IconBadge({ name }: { name: string }) {
  return (
    <View style={styles.iconBadge}>
      <MaterialCommunityIcons name={name} size={30} color={GREEN_DARK} />
    </View>
  );
}

function ResendRow({ seconds, loading, onResend }: { seconds: number; loading: boolean; onResend: () => void }) {
  return (
    <View style={styles.resendRow}>
      {seconds > 0 ? (
        <Text style={styles.resendWait}>
          Resend code in <Text style={styles.resendTimer}>0:{String(seconds).padStart(2, "0")}</Text>
        </Text>
      ) : loading ? (
        <ActivityIndicator color={GREEN_DARK} />
      ) : (
        <TouchableOpacity onPress={onResend} hitSlop={8}>
          <Text style={styles.link}>Resend code</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/** Six boxes over one hidden input, so paste and SMS/email autofill just work. */
function CodeInput({
  value,
  onChange,
  onComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: () => void;
}) {
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <Pressable style={styles.codeRow} onPress={() => ref.current?.focus()}>
      {Array.from({ length: 6 }).map((_, i) => {
        const active = focused && (i === value.length || (i === 5 && value.length === 6));
        return (
          <View key={i} style={[styles.codeBox, active && styles.codeBoxActive, !!value[i] && styles.codeBoxFilled]}>
            <Text style={styles.codeDigit}>{value[i] ?? ""}</Text>
          </View>
        );
      })}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => {
          const digits = t.replace(/\D/g, "").slice(0, 6);
          onChange(digits);
          if (digits.length === 6) onComplete?.();
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        style={styles.codeHidden}
        caretHidden
      />
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 28 },

  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: { fontSize: 22, fontWeight: "800", color: INK },
  backBtn: { width: 40, height: 40, justifyContent: "center" },

  trustRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 },
  faces: { flexDirection: "row", marginRight: 6 },
  face: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  trustText: { fontSize: 13, color: MUTED },

  title: { fontSize: 32, fontWeight: "800", color: INK, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, lineHeight: 23, color: MUTED, marginTop: 8 },

  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 18 },
  label: { fontSize: 13.5, fontWeight: "700", color: INK, marginBottom: 8 },
  link: { fontSize: 13.5, fontWeight: "700", color: GREEN },

  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 50,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
  },
  input: { flex: 1, fontSize: 15, color: INK, paddingVertical: 12 },
  prefix: { fontSize: 15, fontWeight: "700", color: INK },
  prefixDivider: { width: 1, height: 22, backgroundColor: BORDER },

  segment: { flexDirection: "row", padding: 4, borderRadius: 999, backgroundColor: "#f1f5f9" },
  segmentItem: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  segmentItemActive: {
    backgroundColor: "#fff",
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentText: { fontSize: 15, fontWeight: "600", color: MUTED },
  segmentTextActive: { color: INK },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fef2f2",
  },
  errorText: { flex: 1, fontSize: 13.5, color: "#b91c1c", lineHeight: 19 },

  primaryBtn: {
    marginTop: 20,
    height: 50,
    borderRadius: 999,
    backgroundColor: GREEN,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: GREEN,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  primaryText: { fontSize: 16, fontWeight: "700", color: "#fff" },

  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: BORDER },
  dividerText: { fontSize: 12.5, color: MUTED },

  googleBtn: {
    height: 50,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  gBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  gText: { fontSize: 12, fontWeight: "800", color: INK },
  googleText: { fontSize: 15.5, fontWeight: "700", color: INK },

  switchText: { textAlign: "center", fontSize: 15, color: MUTED, marginTop: 22 },
  switchLink: { color: GREEN, fontWeight: "700" },

  guestBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
    paddingVertical: 6,
  },
  guestText: { fontSize: 14, fontWeight: "600", color: MUTED, textDecorationLine: "underline" },

  footer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 18 },
  footerText: { fontSize: 12, color: MUTED },

  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  hint: { fontSize: 13, color: MUTED, textAlign: "center", marginTop: 16 },

  codeRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 24 },
  codeBox: {
    width: 48,
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  codeBoxActive: { borderColor: GREEN },
  codeBoxFilled: { backgroundColor: "#f0fdf4", borderColor: "#86efac" },
  codeDigit: { fontSize: 22, fontWeight: "800", color: INK },
  codeHidden: { position: "absolute", opacity: 0, width: 1, height: 1 },

  resendRow: { alignItems: "center", marginTop: 16, minHeight: 22 },
  resendWait: { fontSize: 13.5, color: MUTED },
  resendTimer: { fontWeight: "700", color: INK },
});
