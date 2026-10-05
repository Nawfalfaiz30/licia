"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { LANGUAGE_STORAGE_KEY, Language, TranslateVars, applyLanguage, localeOf, resolveLanguage, t as translate } from "@/lib/i18n";

type LanguageContextValue = {
  language: Language;
  locale: string;
  setLanguage: (language: Language) => void;
  t: (key: string, vars?: TranslateVars) => string;
  /** Alias `t`; dipakai kode hasil migrasi otomatis agar tidak bentrok dengan variabel lokal bernama `t`. */
  tr: (key: string, vars?: TranslateVars) => string;
};

const fallback: LanguageContextValue = {
  language: "id",
  locale: "id-ID",
  setLanguage: () => undefined,
  t: (key, vars) => translate(key, "id", vars),
  tr: (key, vars) => translate(key, "id", vars),
};

const LanguageContext = createContext<LanguageContextValue>(fallback);

/**
 * `initialLanguage` berasal dari cookie di server sehingga HTML pertama sudah berbahasa benar
 * (tanpa kedip dan tanpa hydration mismatch). Efek di bawah hanya menyelaraskan pengguna lama
 * yang pilihannya masih tersimpan di localStorage tanpa cookie.
 */
export function LanguageProvider({ children, initialLanguage = "id" }: { children: React.ReactNode; initialLanguage?: Language }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  useEffect(() => {
    let stored: Language | null = null;
    try { const raw = localStorage.getItem(LANGUAGE_STORAGE_KEY); stored = raw ? resolveLanguage(raw) : null; } catch {}
    const effective = stored ?? initialLanguage;
    if (effective !== language) setLanguageState(effective);
    applyLanguage(effective);
    const handler = (event: Event) => setLanguageState(resolveLanguage((event as CustomEvent<Language>).detail));
    window.addEventListener("licia:language-change", handler);
    return () => window.removeEventListener("licia:language-change", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<LanguageContextValue>(() => {
    const fn = (key: string, vars?: TranslateVars) => translate(key, language, vars);
    return {
      language,
      locale: localeOf(language),
      setLanguage: (next: Language) => { const selected = resolveLanguage(next); setLanguageState(selected); applyLanguage(selected); },
      t: fn,
      tr: fn,
    };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
