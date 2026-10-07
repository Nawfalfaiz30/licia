import { cookies } from "next/headers";
import {
  LANGUAGE_COOKIE,
  localeOf,
  resolveLanguage,
  t as translate,
  type Language,
  type TranslateParams,
} from "@/lib/i18n";

export type ServerT = {
  language: Language;
  locale: string;
  t: (key: string, params?: TranslateParams) => string;
};

/** Bahasa pengguna untuk komponen server, dibaca dari cookie yang diset klien (lib/i18n.ts → applyLanguage). */
export async function getServerLanguage(): Promise<Language> {
  try {
    const jar = await cookies();
    return resolveLanguage(jar.get(LANGUAGE_COOKIE)?.value);
  } catch {
    return "id";
  }
}

export async function getServerT(): Promise<ServerT> {
  const language = await getServerLanguage();
  return { language, locale: localeOf(language), t: (key, params) => translate(key, language, params) };
}
