import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import { StyleSheet } from "react-native";
import type { SupportedLanguage } from "@/i18n";
import { isRTL } from "@/i18n";

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Drop-in replacement for `useTranslation` with app-specific helpers.
 *
 * ```tsx
 * const { t, isRTL, urduFont } = useAppTranslation();
 * <Text style={[styles.label, urduFont]}>{t('common.save')}</Text>
 * ```
 */
export function useAppTranslation() {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const rtl = isRTL(language);
  const isUrdu = language === "ur";

  /**
   * Font style to apply on Text components that should render in Urdu script.
   * Pass `urduFont` to the `style` prop whenever displaying user-facing text.
   */
  const urduFont = useMemo(
    () => (isUrdu ? ({ fontFamily: "NotoNastaliqUrdu" } as const) : null),
    [isUrdu]
  );

  /**
   * Returns a StyleSheet-compatible direction object.
   * Useful for row layouts that should flip in RTL.
   */
  const rowDirection = useMemo(
    () =>
      StyleSheet.flatten({
        flexDirection: rtl ? ("row-reverse" as const) : ("row" as const),
      }),
    [rtl]
  );

  /**
   * Align text to the reading-start side.
   * `textAlign: 'left'` in LTR, `textAlign: 'right'` in RTL.
   */
  const textAlign = useMemo(
    () =>
      StyleSheet.flatten({
        textAlign: (rtl ? "right" : "left") as "left" | "right",
      }),
    [rtl]
  );

  return {
    /** i18next translate function — fully typed via i18n/types.ts */
    t,
    /** Raw i18n instance — use for language change, events, etc. */
    i18n,
    /** Current language code e.g. 'en' | 'ur' */
    language,
    /** True when the active language is RTL (currently: Urdu) */
    isRTL: rtl,
    /** True when the active language is Urdu */
    isUrdu,
    /** Apply to Text components to use the Urdu font */
    urduFont,
    /** `{ flexDirection: 'row' | 'row-reverse' }` based on RTL */
    rowDirection,
    /** `{ textAlign: 'left' | 'right' }` based on RTL */
    textAlign,
  };
}
