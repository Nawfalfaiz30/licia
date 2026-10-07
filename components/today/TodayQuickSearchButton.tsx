"use client";

import { Search } from "lucide-react";
import { PALETTE_OPEN_EVENT } from "@/lib/shortcuts";

export function TodayQuickSearchButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(PALETTE_OPEN_EVENT))}
      className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-border bg-surface px-3.5 text-xs font-semibold text-textMuted hover:border-accent hover:text-accent"
      aria-label={label}
    >
      <Search size={15} aria-hidden />
      {label}
    </button>
  );
}
