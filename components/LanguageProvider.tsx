"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGE_COOKIE, LANGUAGE_STORAGE_KEY, Language, TranslateParams, applyLanguage, localeOf, resolveLanguage, t as translate } from "@/lib/i18n";

type Ctx = {
  language: Language;
  locale: string;
  setLanguage: (language: Language) => void;
  t: (key: string, params?: TranslateParams) => string;
};

const LanguageContext = createContext<Ctx>({
  language: "id",
  locale: "id-ID",
  setLanguage: () => undefined,
  t: (key, params) => translate(key, "id", params),
});

function cookieLanguage(): Language | null {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${LANGUAGE_COOKIE}=([^;]+)`));
    return match ? resolveLanguage(decodeURIComponent(match[1])) : null;
  } catch { return null; }
}

/**
 * Bahasa awal datang dari server (cookie) sehingga HTML pertama sudah benar — tidak ada kedipan Indonesia → Inggris.
 * Bila bahasa berubah di klien, cookie diperbarui dan komponen server dirender ulang lewat router.refresh().
 */
export function LanguageProvider({ children, initialLanguage = "id" }: { children: React.ReactNode; initialLanguage?: Language }) {
  const router = useRouter();
  const [language, setLanguageState] = useState<Language>(initialLanguage);
  const renderedByServer = useRef<Language>(initialLanguage);

  useEffect(() => {
    let stored: Language | null = null;
    try { const raw = localStorage.getItem(LANGUAGE_STORAGE_KEY); stored = raw ? resolveLanguage(raw) : null; } catch {}
    const preferred = stored ?? cookieLanguage() ?? initialLanguage;
    setLanguageState(preferred);
    applyLanguage(preferred);
    const handler = (event: Event) => {
      const next = resolveLanguage((event as CustomEvent<Language>).detail);
      setLanguageState(next);
      if (next !== renderedByServer.current) { renderedByServer.current = next; router.refresh(); }
    };
    window.addEventListener("licia:language-change", handler);
    return () => window.removeEventListener("licia:language-change", handler);
  }, [initialLanguage, router]);

  const value = useMemo<Ctx>(() => ({
    language,
    locale: localeOf(language),
    setLanguage: (next: Language) => { applyLanguage(resolveLanguage(next)); },
    t: (key: string, params?: TranslateParams) => translate(key, language, params),
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
