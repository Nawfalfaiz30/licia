"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { clsx } from "clsx";
import { applyThemePreference, type ThemeMode } from "@/lib/theme";
import { useLanguage } from "@/components/LanguageProvider";

const OPTIONS: Array<{ key: ThemeMode; label: string; hint: string; icon: typeof Sun }> = [
  { key: "light", label: "Terang", hint: "Selalu terang", icon: Sun },
  { key: "dark", label: "Gelap", hint: "Selalu gelap", icon: Moon },
  { key: "system", label: "Sesuai sistem", hint: "Ikuti perangkat", icon: Monitor },
];

export function ThemeModeControl({ value, onChange }: { value: ThemeMode; onChange: (value: ThemeMode) => void }) {
  const { t: tr } = useLanguage();
  const [active, setActive] = useState<ThemeMode>(value);

  useEffect(() => {
    setActive(value);
  }, [value]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handle = () => {
      if ((localStorage.getItem("licia-theme") || "system") === "system") applyThemePreference("system");
    };
    media.addEventListener?.("change", handle);
    return () => media.removeEventListener?.("change", handle);
  }, []);

  function choose(next: ThemeMode) {
    setActive(next);
    applyThemePreference(next);
    onChange(next);
  }

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {OPTIONS.map(({ key, label, hint, icon: Icon }) => (
        <button
          type="button"
          key={key}
          onClick={() => choose(key)}
          aria-pressed={active === key}
          className={clsx(
            "rounded-2xl border p-3 text-left transition",
            active === key ? "border-accent/30 bg-accent/5" : "border-border bg-bg hover:border-accent/20",
          )}
        >
          <div className="flex items-center gap-2">
            <span
              className={clsx(
                "grid h-9 w-9 place-items-center rounded-xl",
                active === key ? "bg-accent text-white" : "bg-surface text-textMuted",
              )}
            >
              <Icon size={17} />
            </span>
            <span>
              <span className="block text-xs font-semibold text-text">{tr(label)}</span>
              <span className="mt-0.5 block text-2xs text-textMuted">{tr(hint)}</span>
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
