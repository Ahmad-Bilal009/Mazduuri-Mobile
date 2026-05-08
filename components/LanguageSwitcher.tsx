/**
 * LanguageSwitcher — compact EN / اردو toggle
 *
 * Drop it into any header or settings row:
 *
 *   <LanguageSwitcher />
 *   <LanguageSwitcher onLanguageChange={(lang) => console.log(lang)} />
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as Updates from "expo-updates";
import { changeLanguage, SUPPORTED_LANGUAGES, LANGUAGE_META } from "@/i18n";
import { useAppTranslation } from "@/hooks/useAppTranslation";
import type { SupportedLanguage } from "@/i18n";

interface Props {
  onLanguageChange?: (lang: SupportedLanguage) => void;
}

export function LanguageSwitcher({ onLanguageChange }: Props) {
  const { language } = useAppTranslation();
  const [loading, setLoading] = useState(false);

  async function handleSwitch(lang: SupportedLanguage) {
    if (lang === language || loading) return;
    setLoading(true);
    try {
      const { needsRestart } = await changeLanguage(lang);
      onLanguageChange?.(lang);
      if (needsRestart) {
        promptRestart();
      }
    } finally {
      setLoading(false);
    }
  }

  function promptRestart() {
    Alert.alert(
      "Restart Required / دوبارہ شروع",
      "Restart the app to apply the new layout direction.\nنئی ترتیب لاگو کرنے کے لیے ایپ دوبارہ شروع کریں۔",
      [
        { text: "Later / بعد میں", style: "cancel" },
        {
          text: "Restart / دوبارہ",
          style: "destructive",
          onPress: async () => {
            try {
              await Updates.reloadAsync();
            } catch {
              // expo-updates not available in dev — just ignore
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      {loading && (
        <ActivityIndicator size="small" color="#16a34a" style={styles.spinner} />
      )}
      {SUPPORTED_LANGUAGES.map((lang, idx) => {
        const isActive = lang === language;
        const isFirst = idx === 0;
        const isLast = idx === SUPPORTED_LANGUAGES.length - 1;
        return (
          <TouchableOpacity
            key={lang}
            onPress={() => handleSwitch(lang)}
            disabled={loading}
            activeOpacity={0.7}
            style={[
              styles.pill,
              isFirst && styles.pillLeft,
              isLast && styles.pillRight,
              isActive && styles.pillActive,
            ]}
          >
            <Text
              style={[
                styles.pillText,
                isActive && styles.pillTextActive,
                lang === "ur" && styles.urduText,
              ]}
            >
              {LANGUAGE_META[lang].nativeName}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    padding: 3,
    alignSelf: "flex-start",
    alignItems: "center",
  },
  spinner: {
    marginRight: 6,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    minWidth: 44,
    alignItems: "center",
  },
  pillLeft: {
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  pillRight: {
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  pillActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  pillText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6b7280",
  },
  pillTextActive: {
    color: "#111827",
    fontWeight: "600",
  },
  urduText: {
    fontFamily: "NotoNastaliqUrdu",
    fontSize: 14,
  },
});
