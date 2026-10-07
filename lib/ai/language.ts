/**
 * Bahasa balasan AI mengikuti bahasa antarmuka (v0.57). Bahasa dibaca dari cookie `licia-language`
 * yang diset klien, jadi tidak perlu mengubah kontrak API chat.
 */
import { LANGUAGE_COOKIE, resolveLanguage, type Language } from "@/lib/i18n";

export function languageFromCookieHeader(header: string | null | undefined): Language {
  if (!header) return "id";
  const match = header
    .split(/;\s*/)
    .map((part) => part.split("="))
    .find(([name]) => name === LANGUAGE_COOKIE);
  return resolveLanguage(match?.[1] ? decodeURIComponent(match[1]) : undefined);
}

/** Pesan sistem tambahan. Alat/argumen tetap sama; hanya bahasa teks yang ditulis untuk pengguna yang berubah. */
export function languageDirective(language: Language): string {
  if (language === "en") {
    return "LANGUAGE: The user's interface language is English. Write every reply, title, label, note, and summary in natural English, even though the instructions and stored data may be in Indonesian. If the user clearly writes in another language, answer in that language. Understand Indonesian date and time words in the user's text (besok = tomorrow, lusa = day after tomorrow, jam 7 malam = 7 pm, Senin = Monday) and keep tool arguments (ISO dates, enums) unchanged.";
  }
  return "BAHASA: Bahasa antarmuka pengguna adalah Indonesia. Tulis semua balasan, judul, label, catatan, dan ringkasan dalam bahasa Indonesia yang natural, kecuali pengguna jelas menulis dalam bahasa lain.";
}
