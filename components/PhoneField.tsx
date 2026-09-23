import { View, Text, TextInput, StyleSheet } from "react-native";

/**
 * Pakistani mobile number input used during profile completion.
 *
 * The number is stored but not OTP-verified yet — the admin confirms it by
 * calling during review. Phone verification is planned for a later release,
 * at which point this field becomes the entry point for that flow.
 */

/** Accepts 3001234567 or 03001234567, matching the backend's validator. */
export function isValidPakistaniMobile(digits: string): boolean {
  return /^0?3\d{9}$/.test(digits.trim());
}

interface Props {
  value: string;
  onChange: (digits: string) => void;
  label?: string;
  hint?: string;
}

export function PhoneField({
  value,
  onChange,
  label = "Phone Number *",
  hint = "Clients call this number to reach you. We'll verify it during review.",
}: Props) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <View style={styles.countryBox}>
          <Text style={styles.flag}>🇵🇰</Text>
          <Text style={styles.code}>+92</Text>
        </View>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={(t) => onChange(t.replace(/[^0-9]/g, ""))}
          keyboardType="phone-pad"
          maxLength={11}
          placeholder="300 1234567"
          placeholderTextColor="#9ca3af"
        />
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
    marginTop: 16,
  },
  row: { flexDirection: "row", gap: 8 },
  countryBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    backgroundColor: "#fff",
  },
  flag: { fontSize: 16 },
  code: { fontSize: 15, fontWeight: "600", color: "#111827" },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#fff",
  },
  hint: { fontSize: 11.5, color: "#9ca3af", marginTop: 6, lineHeight: 16 },
});
