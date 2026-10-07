"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, CalendarCheck, Eye, EyeOff, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { clsx } from "clsx";
import { Overlay } from "@/components/ui/Overlay";
import { useLanguage } from "@/components/LanguageProvider";
import { useDashboardLayout } from "@/components/dashboard/DashboardLayoutProvider";
import {
  DASHBOARD_WIDGETS,
  isCustomized,
  moveWidget,
  resetLayout,
  setTodayOnly,
  toggleWidget,
} from "@/lib/dashboardLayout";

/** Tombol + panel "Atur Beranda": mode Hari ini saja, tampil/sembunyi, dan urutan (tombol naik/turun — ramah keyboard). */
export function DashboardCustomizer() {
  const { t } = useLanguage();
  const { layout, update } = useDashboardLayout();
  const [open, setOpen] = useState(false);
  const customized = isCustomized(layout);
  const byId = new Map(DASHBOARD_WIDGETS.map((w) => [w.id, w]));

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => update(setTodayOnly(layout, !layout.todayOnly))}
          aria-pressed={layout.todayOnly}
          className={clsx(
            "inline-flex min-h-10 items-center gap-2 rounded-xl border px-3.5 text-xs font-semibold transition",
            layout.todayOnly
              ? "border-accent bg-accent/10 text-accent"
              : "border-border bg-bg text-textMuted hover:text-text",
          )}
        >
          <CalendarCheck size={14} aria-hidden="true" />
          {t("Hari ini saja")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-bg px-3.5 text-xs font-semibold text-textMuted transition hover:text-text"
        >
          <SlidersHorizontal size={14} aria-hidden="true" />
          {t("Atur beranda")}
          {customized && <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />}
        </button>
      </div>

      <Overlay
        open={open}
        onClose={() => setOpen(false)}
        tier="sheet"
        align="bottom"
        labelledBy="licia-dash-custom-title"
        panelClassName="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-[1.75rem] border border-border bg-surface p-4 shadow-2xl sm:rounded-[1.75rem] sm:p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="licia-dash-custom-title" className="font-display text-lg text-text">
              {t("Atur beranda")}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-textMuted">
              {t("Pilih bagian yang tampil dan urutannya. Pengaturan ikut tersimpan di semua perangkat.")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("Tutup")}
            className="touch-target rounded-xl border border-border text-textMuted hover:text-text"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border bg-bg p-3">
          <span>
            <span className="block text-xs font-semibold text-text">{t("Hari ini saja")}</span>
            <span className="block text-2xs text-textMuted">
              {t("Sembunyikan wawasan, ulasan, dan pusat kendali; sisakan yang relevan hari ini.")}
            </span>
          </span>
          <input
            type="checkbox"
            checked={layout.todayOnly}
            onChange={(e) => update(setTodayOnly(layout, e.target.checked))}
            className="h-5 w-5 accent-accent"
          />
        </label>

        <ol className="mt-3 space-y-2">
          {layout.order.map((id, index) => {
            const def = byId.get(id);
            if (!def) return null;
            const hidden = layout.hidden.includes(id);
            return (
              <li
                key={id}
                className={clsx(
                  "flex items-center gap-2 rounded-2xl border border-border bg-bg p-2.5",
                  hidden && "opacity-60",
                )}
              >
                <button
                  type="button"
                  onClick={() => update(toggleWidget(layout, id))}
                  aria-pressed={!hidden}
                  aria-label={
                    hidden
                      ? t("Tampilkan {name}", { name: t(def.label) })
                      : t("Sembunyikan {name}", { name: t(def.label) })
                  }
                  className="touch-target shrink-0 rounded-xl text-textMuted hover:text-text"
                >
                  {hidden ? (
                    <EyeOff size={16} aria-hidden="true" />
                  ) : (
                    <Eye size={16} className="text-accent" aria-hidden="true" />
                  )}
                </button>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-text">{t(def.label)}</span>
                  <span className="block truncate text-2xs text-textMuted">{t(def.description)}</span>
                </span>
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => update(moveWidget(layout, id, -1))}
                  aria-label={t("Naikkan {name}", { name: t(def.label) })}
                  className="touch-target shrink-0 rounded-xl text-textMuted hover:text-text disabled:opacity-30"
                >
                  <ArrowUp size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={index === layout.order.length - 1}
                  onClick={() => update(moveWidget(layout, id, 1))}
                  aria-label={t("Turunkan {name}", { name: t(def.label) })}
                  className="touch-target shrink-0 rounded-xl text-textMuted hover:text-text disabled:opacity-30"
                >
                  <ArrowDown size={16} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ol>

        <div className="mt-4 flex justify-between gap-2">
          <button
            type="button"
            onClick={() => update(resetLayout())}
            disabled={!customized}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3.5 text-xs font-semibold text-textMuted hover:text-text disabled:opacity-50"
          >
            <RotateCcw size={14} aria-hidden="true" />
            {t("Kembalikan bawaan")}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="min-h-11 rounded-xl bg-accent px-5 text-xs font-semibold text-white"
          >
            {t("Selesai")}
          </button>
        </div>
      </Overlay>
    </>
  );
}
