"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { LANGUAGE_STORAGE_KEY, Language, applyLanguage, resolveLanguage, t } from "@/lib/i18n";

const LanguageContext = createContext<{ language: Language; setLanguage: (language: Language) => void; t: (key: string) => string }>({
  language: "id",
  setLanguage: () => undefined,
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("id");

  useEffect(() => {
    const stored = resolveLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY));
    setLanguageState(stored);
    applyLanguage(stored);
    const handler = (event: Event) => {
      setLanguageState(resolveLanguage((event as CustomEvent<Language>).detail));
    };
    window.addEventListener("licia:language-change", handler);
    return () => window.removeEventListener("licia:language-change", handler);
  }, []);

  const value = useMemo(() => ({
    language,
    setLanguage: (next: Language) => {
      const selected = resolveLanguage(next);
      setLanguageState(selected);
      applyLanguage(selected);
    },
    t: (key: string) => t(key, language),
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
