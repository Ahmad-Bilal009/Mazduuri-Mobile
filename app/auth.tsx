import { useState, useRef } from "react";
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
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

type Step = "phone" | "otp" | "role";

export default function AuthScreen() {
  const router = useRouter();
  const { setUser } = useAuthStore();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [role, setRole] = useState<"worker" | "client">("worker");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);

  const otpRefs = useRef<(TextInput | null)[]>([]);

  async function handleSendOtp() {
    setError("");
    setLoading(true);
    try {
      const res = await authApi.sendOtp(`+92${phone.replace(/^0/, "")}`);
      setIsNewUser(res.isNewUser);
      setStep("otp");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    const code = otp.join("");
    if (code.length < 6) {
      setError("Enter all 6 digits");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await authApi.verifyOtp(
        `+92${phone.replace(/^0/, "")}`,
        code,
        isNewUser ? role : undefined,
      );
      setUser(res.user, res.token);
      router.back();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  function handleOtpChange(index: number, value: string) {
    if (!/^\d?$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>M</Text>
            </View>
            <Text style={styles.appName}>Mazduuri</Text>
            <Text style={styles.subtitle}>
              {step === "phone" && "Enter your phone number"}
              {step === "otp" && "Enter the 6-digit code"}
              {step === "role" && "How do you want to use the app?"}
            </Text>
          </View>

          {/* Step: Phone */}
          {step === "phone" && (
            <View style={styles.card}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.phoneInput}>
                <Text style={styles.countryCode}>+92</Text>
                <TextInput
                  style={styles.phoneField}
                  placeholder="03XX XXXXXXX"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoFocus
                  maxLength={11}
                />
              </View>

              {/* Role */}
              <Text style={[styles.label, { marginTop: 16 }]}>I am a...</Text>
              <View style={styles.roleRow}>
                <TouchableOpacity
                  style={[
                    styles.roleOption,
                    role === "worker" && styles.roleSelected,
                  ]}
                  onPress={() => setRole("worker")}
                >
                  <Text style={{ fontSize: 24 }}>👷</Text>
                  <Text
                    style={[
                      styles.roleText,
                      role === "worker" && { color: "#16a34a" },
                    ]}
                  >
                    Worker
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.roleOption,
                    role === "client" && styles.roleSelectedClient,
                  ]}
                  onPress={() => setRole("client")}
                >
                  <Text style={{ fontSize: 24 }}>🏢</Text>
                  <Text
                    style={[
                      styles.roleText,
                      role === "client" && { color: "#9333ea" },
                    ]}
                  >
                    Client
                  </Text>
                </TouchableOpacity>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  (loading || phone.length < 10) && styles.disabled,
                ]}
                onPress={handleSendOtp}
                disabled={loading || phone.length < 10}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Send OTP →</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Step: OTP */}
          {step === "otp" && (
            <View style={styles.card}>
              <Text style={styles.sentTo}>
                Code sent to <Text style={{ fontWeight: "700" }}>0{phone}</Text>
              </Text>

              <View style={styles.otpRow}>
                {otp.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={(el) => {
                      otpRefs.current[i] = el;
                    }}
                    style={styles.otpBox}
                    value={digit}
                    onChangeText={(v) => handleOtpChange(i, v)}
                    keyboardType="numeric"
                    maxLength={1}
                    textAlign="center"
                    autoFocus={i === 0}
                  />
                ))}
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  (loading || otp.join("").length < 6) && styles.disabled,
                ]}
                onPress={handleVerifyOtp}
                disabled={loading || otp.join("").length < 6}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Verify →</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resendBtn}
                onPress={handleSendOtp}
              >
                <Text style={styles.resendText}>Resend OTP</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f9fafb" },
  container: { flexGrow: 1, justifyContent: "center", padding: 20 },
  logoContainer: { alignItems: "center", marginBottom: 32 },
  logo: {
    width: 56,
    height: 56,
    backgroundColor: "#16a34a",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logoText: { color: "#fff", fontWeight: "700", fontSize: 24 },
  appName: { fontSize: 24, fontWeight: "700", color: "#111827" },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8 },
  phoneInput: {
    flexDirection: "row",
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    overflow: "hidden",
  },
  countryCode: {
    backgroundColor: "#f9fafb",
    paddingHorizontal: 12,
    paddingVertical: 14,
    color: "#374151",
    fontWeight: "600",
    fontSize: 15,
    borderRightWidth: 1,
    borderRightColor: "#e5e7eb",
  },
  phoneField: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 16,
    color: "#111827",
  },
  roleRow: { flexDirection: "row", gap: 10 },
  roleOption: {
    flex: 1,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  roleSelected: { borderColor: "#16a34a", backgroundColor: "#f0fdf4" },
  roleSelectedClient: { borderColor: "#9333ea", backgroundColor: "#faf5ff" },
  roleText: { fontSize: 13, fontWeight: "600", color: "#4b5563" },
  otpRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginVertical: 12,
  },
  otpBox: {
    width: 44,
    height: 52,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  sentTo: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 4,
    textAlign: "center",
  },
  primaryBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 16,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  disabled: { opacity: 0.6 },
  resendBtn: { paddingVertical: 12, alignItems: "center" },
  resendText: { color: "#16a34a", fontWeight: "600", fontSize: 14 },
  error: {
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    color: "#ef4444",
    fontSize: 13,
    textAlign: "center",
  },
});
