import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { I18nManager } from "react-native";

import en from "@/locales/en/translation.json";
import ur from "@/locales/ur/translation.json";

// ─── Constants ────────────────────────────────────────────────────────────────

export const SUPPORTED_LANGUAGES = ["en", "ur"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_STORAGE_KEY = "mz_language";

export const RTL_LANGUAGES: ReadonlyArray<SupportedLanguage> = ["ur"];

export const LANGUAGE_META: Record<
  SupportedLanguage,
  { nativeName: string; englishName: string; flag: string }
> = {
  en: { nativeName: "English", englishName: "English", flag: "🇬🇧" },
  ur: { nativeName: "اردو", englishName: "Urdu", flag: "🇵🇰" },
};

// ─── Resources ────────────────────────────────────────────────────────────────

const resources = {
  en: { translation: en },
  ur: { translation: ur },
} as const;

// ─── Device language detection ────────────────────────────────────────────────

function detectDeviceLanguage(): SupportedLanguage {
  try {
    const locales = getLocales();
    for (const locale of locales) {
      const code = locale.languageCode as SupportedLanguage;
      if (SUPPORTED_LANGUAGES.includes(code)) {
        return code;
      }
    }
  } catch {
    // getLocales can fail in some environments
  }
  return "en";
}

// ─── RTL helpers ──────────────────────────────────────────────────────────────

export function isRTL(language?: string): boolean {
  const lang = (language ?? i18n.language) as SupportedLanguage;
  return RTL_LANGUAGES.includes(lang);
}

/**
 * Applies RTL/LTR to React Native's layout engine.
 * Call this before the first render — changing direction at runtime
 * requires an app reload to take full visual effect.
 */
function applyDirectionality(language: SupportedLanguage): void {
  const shouldBeRTL = RTL_LANGUAGES.includes(language);
  I18nManager.allowRTL(shouldBeRTL);
  if (I18nManager.isRTL !== shouldBeRTL) {
    I18nManager.forceRTL(shouldBeRTL);
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

let initialized = false;

export async function initI18n(): Promise<void> {
  if (initialized) return;
  initialized = true;

  // 1. Determine language (persisted > device > fallback)
  const persisted = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  const language: SupportedLanguage = SUPPORTED_LANGUAGES.includes(
    persisted as SupportedLanguage
  )
    ? (persisted as SupportedLanguage)
    : detectDeviceLanguage();

  // 2. Set directionality before any render
  applyDirectionality(language);

  // 3. Initialise i18next
  await i18n.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    // Required for React Native — uses Intl-based plural rules (v4 format)
    compatibilityJSON: "v4",
  });
}

// ─── Language change ──────────────────────────────────────────────────────────

/**
 * Persist + switch language. Returns whether a full app reload is needed
 * (i.e. the writing direction changed).
 */
export async function changeLanguage(
  language: SupportedLanguage
): Promise<{ needsRestart: boolean }> {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  await i18n.changeLanguage(language);

  const needsRestart = I18nManager.isRTL !== RTL_LANGUAGES.includes(language);
  applyDirectionality(language);

  return { needsRestart };
}

export function getCurrentLanguage(): SupportedLanguage {
  return i18n.language as SupportedLanguage;
}

export default i18n;
