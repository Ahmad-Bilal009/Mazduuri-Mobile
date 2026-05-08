/**
 * LanguageSelector — full-page language selection screen
 *
 * Use as a standalone screen or embed inside a modal.
 * Register it in Expo Router as `app/language-select.tsx`, then push it:
 *
 *   router.push('/language-select')
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Updates from "expo-updates";
import {
  changeLanguage,
  SUPPORTED_LANGUAGES,
  LANGUAGE_META,
  type SupportedLanguage,
} from "@/i18n";
import { useAppTranslation } from "@/hooks/useAppTranslation";

interface Props {
  /** Called after the language was successfully saved */
  onSelect?: (lang: SupportedLanguage) => void;
  /** Called when the user taps Back */
  onBack?: () => void;
}

export function LanguageSelector({ onSelect, onBack }: Props) {
  const { t, language, isUrdu } = useAppTranslation();
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SupportedLanguage>(language);

  async function handleSelect(lang: SupportedLanguage) {
    if (loading) return;
    setSelected(lang);
    setLoading(true);

    try {
      const { needsRestart } = await changeLanguage(lang);
      onSelect?.(lang);

      if (needsRestart) {
        Alert.alert(
          t("language.restartTitle"),
          t("language.restartMessage"),
          [
            { text: t("language.later"), style: "cancel" },
            {
              text: t("language.restartNow"),
              style: "destructive",
              onPress: async () => {
                try {
                  await Updates.reloadAsync();
                } catch {
                  // Not available in Expo Go — handled gracefully
                }
              },
            },
          ]
        );
      }
    } catch {
      // Revert selection on error
      setSelected(language);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={12}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
        )}
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, isUrdu && styles.urduText]}>
            {t("language.title")}
          </Text>
          <Text style={[styles.headerSubtitle, isUrdu && styles.urduText]}>
            {t("language.subtitle")}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {SUPPORTED_LANGUAGES.map((lang) => {
          const meta = LANGUAGE_META[lang];
          const isActive = selected === lang;
          const isCurrentlySaving = loading && selected === lang;

          return (
            <TouchableOpacity
              key={lang}
              onPress={() => handleSelect(lang)}
              activeOpacity={0.7}
              disabled={loading}
              style={[styles.card, isActive && styles.cardActive]}
            >
              {/* Flag + names */}
              <View style={styles.cardLeft}>
                <Text style={styles.flag}>{meta.flag}</Text>
                <View style={styles.nameStack}>
                  <Text
                    style={[
                      styles.nativeName,
                      isActive && styles.nativeNameActive,
                      lang === "ur" && styles.urduText,
                    ]}
                  >
                    {meta.nativeName}
                  </Text>
                  <Text
                    style={[
                      styles.englishName,
                      isActive && styles.englishNameActive,
                    ]}
                  >
                    {meta.englishName}
                  </Text>
                </View>
              </View>

              {/* Status indicator */}
              <View style={styles.cardRight}>
                {isCurrentlySaving ? (
                  <ActivityIndicator size="small" color="#16a34a" />
                ) : isActive ? (
                  <View style={styles.checkCircle}>
                    <Text style={styles.checkMark}>✓</Text>
                  </View>
                ) : (
                  <View style={styles.emptyCircle} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Info note */}
        <View style={styles.infoBox}>
          <Text style={[styles.infoText, isUrdu && styles.urduText]}>
            💡{" "}
            {isUrdu
              ? "اردو منتخب کرنے پر ایپ RTL (دائیں سے بائیں) میں چلے گی"
              : "Selecting Urdu will switch the app to RTL (right-to-left) layout"}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  backBtn: {
    marginRight: 12,
    marginTop: 4,
  },
  backArrow: {
    fontSize: 22,
    color: "#374151",
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 18,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 2,
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardActive: {
    borderColor: "#16a34a",
    backgroundColor: "#f0fdf4",
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  flag: {
    fontSize: 36,
  },
  nameStack: {
    gap: 2,
  },
  nativeName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
  },
  nativeNameActive: {
    color: "#15803d",
  },
  englishName: {
    fontSize: 13,
    color: "#9ca3af",
  },
  englishNameActive: {
    color: "#6b7280",
  },
  cardRight: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  emptyCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "#e5e7eb",
  },
  infoBox: {
    backgroundColor: "#fffbeb",
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  infoText: {
    fontSize: 13,
    color: "#92400e",
    lineHeight: 20,
  },
  urduText: {
    fontFamily: "NotoNastaliqUrdu",
  },
});
