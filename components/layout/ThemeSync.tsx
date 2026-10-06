"use client";

import { useEffect } from "react";
import { applyThemePreference, ensureAccentTokens } from "@/lib/theme";

export function ThemeSync() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      const stored = localStorage.getItem("licia-theme") || "system";
      if (stored === "system") applyThemePreference("system");
    };
    sync();
    ensureAccentTokens(); // pengguna lama: turunkan token aksen aman-kontras sekali
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, []);

  return null;
}
