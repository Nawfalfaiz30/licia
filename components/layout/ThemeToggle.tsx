"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { clsx } from "clsx";
import { applyThemePreference, type ThemeMode } from "@/lib/theme";

import { useLanguage } from "@/components/LanguageProvider";
export function ThemeToggle({ onChange }: { onChange?: (isDark: boolean) => void }) {
  const { t: tr } = useLanguage();
  const [theme, setTheme] = useState<ThemeMode>("system");

  useEffect(() => {
    const stored = localStorage.getItem("licia-theme");
    const next: ThemeMode = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    setTheme(next);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      if ((localStorage.getItem("licia-theme") || "system") === "system") {
        const safe = applyThemePreference("system");
        onChange?.(safe === "dark");
      }
    };
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, [onChange]);

  function apply(next: ThemeMode) {
    setTheme(next);
    const safe = applyThemePreference(next);
    onChange?.(safe === "dark");
  }

  const options: { key: ThemeMode; icon: typeof Sun }[] = [
    { key: "light", icon: Sun },
    { key: "dark", icon: Moon },
    { key: "system", icon: Monitor },
  ];

  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-surface p-1">
      {options.map(({ key, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => apply(key)}
          aria-label={key === "light" ? tr("Mode terang") : key === "dark" ? tr("Mode gelap") : tr("Sesuai sistem")}
          aria-pressed={theme === key}
          className={clsx(
            "min-h-8 min-w-8 rounded-full p-1.5 transition",
            theme === key ? "bg-accent text-white" : "text-textMuted hover:text-text",
          )}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}
