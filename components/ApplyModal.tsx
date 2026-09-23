import { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { formatCurrency } from "@/lib/utils";

interface Props {
  visible: boolean;
  jobBudget: number;
  onClose: () => void;
  onSubmit: (payload: { message?: string; offerAmount?: number }) => Promise<void>;
}

export function ApplyModal({ visible, jobBudget, onClose, onSubmit }: Props) {
  const [message, setMessage] = useState("");
  const [useCustomOffer, setUseCustomOffer] = useState(false);
  const [customOffer, setCustomOffer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setMessage("");
    setUseCustomOffer(false);
    setCustomOffer("");
    setError("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit() {
    setError("");
    const offerAmount = useCustomOffer
      ? parseInt(customOffer.replace(/[^0-9]/g, ""), 10)
      : undefined;

    if (useCustomOffer && (!offerAmount || offerAmount <= 0)) {
      setError("Enter a valid offer amount");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({ message: message.trim() || undefined, offerAmount });
      reset();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to apply");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.sheetWrapper}
        >
          <View style={styles.sheet}>
            {/* Handle bar */}
            <View style={styles.handle} />

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.heading}>Apply for this Job</Text>
              <Text style={styles.subheading}>
                Your profile will be shared with the client.
              </Text>

              {/* Offer section */}
              <Text style={styles.label}>Your Daily Offer</Text>
              <View style={styles.offerRow}>
                <TouchableOpacity
                  style={[styles.offerOption, !useCustomOffer && styles.offerOptionActive]}
                  onPress={() => setUseCustomOffer(false)}
                >
                  <Text
                    style={[
                      styles.offerOptionText,
                      !useCustomOffer && styles.offerOptionTextActive,
                    ]}
                  >
                    Accept Listed
                  </Text>
                  <Text
                    style={[
                      styles.offerAmount,
                      !useCustomOffer && styles.offerAmountActive,
                    ]}
                  >
                    {formatCurrency(jobBudget)}/day
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.offerOption, useCustomOffer && styles.offerOptionActive]}
                  onPress={() => setUseCustomOffer(true)}
                >
                  <Text
                    style={[
                      styles.offerOptionText,
                      useCustomOffer && styles.offerOptionTextActive,
                    ]}
                  >
                    Custom Offer
                  </Text>
                  <Text
                    style={[
                      styles.offerAmount,
                      useCustomOffer && styles.offerAmountActive,
                    ]}
                  >
                    Enter amount
                  </Text>
                </TouchableOpacity>
              </View>

              {useCustomOffer && (
                <View style={styles.customOfferRow}>
                  <Text style={styles.rsPrefix}>Rs.</Text>
                  <TextInput
                    style={styles.customOfferInput}
                    placeholder="e.g. 4500"
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                    value={customOffer}
                    onChangeText={setCustomOffer}
                    returnKeyType="done"
                  />
                  <Text style={styles.perDay}>/day</Text>
                </View>
              )}

              {/* Message */}
              <Text style={styles.label}>Message to Client (optional)</Text>
              <TextInput
                style={styles.messageInput}
                placeholder="Introduce yourself, describe your experience..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={4}
                maxLength={500}
                value={message}
                onChangeText={setMessage}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{message.length}/500</Text>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </ScrollView>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} disabled={submitting}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.disabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Submit Application</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheetWrapper: { width: "100%" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    maxHeight: "90%",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#e5e7eb",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  heading: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 4 },
  subheading: { fontSize: 13, color: "#6b7280", marginBottom: 20 },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  offerRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  offerOption: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
  },
  offerOptionActive: {
    borderColor: "#16a34a",
    backgroundColor: "#f0fdf4",
  },
  offerOptionText: { fontSize: 12, color: "#6b7280", fontWeight: "500", marginBottom: 4 },
  offerOptionTextActive: { color: "#16a34a", fontWeight: "700" },
  offerAmount: { fontSize: 14, fontWeight: "700", color: "#374151" },
  offerAmountActive: { color: "#15803d" },
  customOfferRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#16a34a",
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 18,
    backgroundColor: "#f9fafb",
  },
  rsPrefix: { fontSize: 15, color: "#374151", fontWeight: "600", marginRight: 4 },
  customOfferInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    paddingVertical: 12,
  },
  perDay: { fontSize: 13, color: "#6b7280", marginLeft: 4 },
  messageInput: {
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: "#111827",
    minHeight: 100,
    backgroundColor: "#f9fafb",
    marginBottom: 4,
  },
  charCount: { fontSize: 11, color: "#9ca3af", textAlign: "right", marginBottom: 16 },
  errorText: {
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    color: "#ef4444",
    fontSize: 13,
    textAlign: "center",
  },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelBtnText: { fontSize: 15, fontWeight: "600", color: "#374151" },
  submitBtn: {
    flex: 2,
    backgroundColor: "#16a34a",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  disabled: { opacity: 0.6 },
});
