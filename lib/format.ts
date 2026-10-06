/** Pemformat yang sadar bahasa (v0.57). Locale = "id-ID" atau "en-US", dari useLanguage().locale. */
import type { Language } from "@/lib/i18n";

export const LOCALES: Record<Language, string> = { id: "id-ID", en: "en-US" };

export function localeFor(language: Language | string | undefined): string {
  return language === "en" ? LOCALES.en : LOCALES.id;
}

/** Rupiah: "Rp 47.000" (ID) atau "Rp 47,000" (EN) — mata uang tetap Rupiah di kedua bahasa. */
export function formatMoney(amount: number, locale = "id-ID"): string {
  return "Rp " + Math.round(amount).toLocaleString(locale);
}

/** Locale sesuai bahasa dokumen saat ini (untuk kode non-React, mis. helper di luar komponen). */
export function documentLocale(): string {
  if (typeof document === "undefined") return LOCALES.id;
  return localeFor(document.documentElement.lang);
}
