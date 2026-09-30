"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { clsx } from "clsx";
import { applyBackgroundForCurrentMode } from "@/lib/theme";

type Theme = "light" | "dark" | "system";

export function ThemeToggle({ onChange }: { onChange?: (isDark: boolean) => void }) {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const stored = (localStorage.getItem("licia-theme") as Theme) || "system";
    setTheme(stored);
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    localStorage.setItem("licia-theme", next);
    const isDark =
      next === "dark" ||
      (next === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
    // Ganti mode → langsung pakai warna latar milik mode itu (custom kalau ada,
    // default kalau belum pernah dikustomisasi). Ini yang sebelumnya tidak terjadi.
    applyBackgroundForCurrentMode();
    onChange?.(isDark);
  }

  const options: { key: Theme; icon: typeof Sun }[] = [
    { key: "light", icon: Sun },
    { key: "dark", icon: Moon },
    { key: "system", icon: Monitor },
  ];

  return (
    <div className="flex items-center gap-1 rounded-full bg-surface border border-border p-1">
      {options.map(({ key, icon: Icon }) => (
        <button
          key={key}
          onClick={() => apply(key)}
          aria-label={key}
          className={clsx(
            "p-1.5 rounded-full transition",
            theme === key ? "bg-accent text-white" : "text-textMuted hover:text-text"
          )}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}
