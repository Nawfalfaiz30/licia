"use client";

import { LANGUAGE_COOKIE, resolveLanguage, t as translate } from "@/lib/i18n";
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // global-error menggantikan layout akar, jadi tak ada provider: baca bahasa dari cookie.
  const language = typeof document === "undefined" ? "id" : resolveLanguage(document.cookie.match(new RegExp(`(?:^|; )${LANGUAGE_COOKIE}=([^;]+)`))?.[1]);
  const tr = (key: string) => translate(key, language);
  return <html lang={language}><body style={{ fontFamily:"system-ui,sans-serif", margin:0, padding:24, background:"#0b0b0f", color:"#fff" }}><main style={{ maxWidth:640, margin:"18vh auto", textAlign:"center" }}><h1 style={{ fontSize:32 }}>{tr("Licia perlu dimuat ulang")}</h1><p style={{ opacity:.72, lineHeight:1.6 }}>{tr("Terjadi kesalahan yang tidak dapat dipulihkan pada halaman ini.")}</p><button onClick={() => reset()} style={{ marginTop:16, border:0, borderRadius:12, padding:"12px 18px", cursor:"pointer" }}>{tr("Muat ulang")}</button></main></body></html>;
}
