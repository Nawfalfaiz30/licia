"use client";

import { useEffect } from "react";
import { applyThemePreference } from "@/lib/theme";

export function ThemeSync() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      const stored = localStorage.getItem("licia-theme") || "system";
      if (stored === "system") applyThemePreference("system");
    };
    sync();
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, []);

  return null;
}
