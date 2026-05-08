/**
 * TypeScript augmentation for i18next.
 *
 * This file makes `t()` fully type-safe:
 *   - autocompletion on all translation keys
 *   - compile-time error on missing/misspelled keys
 *   - interpolation variable type checking
 *
 * Usage: just import this file once (done in i18n/index.ts).
 * After that, every `useTranslation()` call is typed automatically.
 */

import "i18next";
import type en from "@/locales/en/translation.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: {
      translation: typeof en;
    };
  }
}
