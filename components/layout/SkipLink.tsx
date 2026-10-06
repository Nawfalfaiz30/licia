"use client";

import { useLanguage } from "@/components/LanguageProvider";
/** Tautan "Lewati ke konten utama" untuk pengguna keyboard dan pembaca layar (WCAG 2.4.1). */
export function SkipLink() {
  const { t: tr } = useLanguage();
  return (
    <a href="#main-content" className="licia-skip-link">
      {tr("Lewati ke konten utama")}</a>
  );
}
