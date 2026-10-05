import { cookies } from "next/headers";
import { LANGUAGE_COOKIE, localeOf, resolveLanguage, t, type Language, type TranslateVars } from "@/lib/i18n";

export type ServerI18n = { language: Language; locale: string; t: (key: string, vars?: TranslateVars) => string; tr: (key: string, vars?: TranslateVars) => string };

/** Bahasa pengguna untuk komponen server dan route handler (dari cookie `licia-language`). */
export async function getServerLanguage(): Promise<Language> {
  try {
    const store = await cookies();
    return resolveLanguage(store.get(LANGUAGE_COOKIE)?.value);
  } catch {
    return "id";
  }
}

export async function getServerI18n(): Promise<ServerI18n> {
  const language = await getServerLanguage();
  const translate = (key: string, vars?: TranslateVars) => t(key, language, vars);
  return { language, locale: localeOf(language), t: translate, tr: translate };
}
