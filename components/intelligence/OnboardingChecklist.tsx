"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, ChevronDown, Sparkles, X } from "lucide-react";
import { clsx } from "clsx";
import { Card } from "@/components/ui";
import { useLanguage } from "@/components/LanguageProvider";
import {
  ONBOARDING_DISMISS_KEY,
  buildOnboardingSteps,
  nextStep,
  onboardingProgress,
  type OnboardingStatus,
} from "@/lib/onboarding";
import { QUICK_CAPTURE_EVENT } from "@/lib/shortcuts";

/**
 * Checklist 5 langkah di Beranda (A7). Setiap langkah punya jalan pintas: tautan atau contoh yang bisa diklik
 * dan langsung membuka Simpan Cepat terisi. Memperbarui diri saat sesuatu tersimpan; hilang setelah ditutup atau selesai.
 */
export function OnboardingChecklist() {
  const { t } = useLanguage();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [hidden, setHidden] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  const refresh = useCallback(() => {
    fetch("/api/onboarding", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.status) setStatus(d.status as OnboardingStatus);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(ONBOARDING_DISMISS_KEY) === "true");
      setCollapsed(localStorage.getItem(`${ONBOARDING_DISMISS_KEY}:collapsed`) === "true");
    } catch {
      setHidden(false);
    }
    refresh();
    for (const name of ["licia:capture-complete", "licia:sync-complete"]) window.addEventListener(name, refresh);
    return () => {
      for (const name of ["licia:capture-complete", "licia:sync-complete"]) window.removeEventListener(name, refresh);
    };
  }, [refresh]);

  if (hidden || !status) return null;
  const steps = buildOnboardingSteps(status);
  const progress = onboardingProgress(steps);
  const upNext = nextStep(steps);
  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(ONBOARDING_DISMISS_KEY, "true");
    } catch {}
  };
  const toggle = () => {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(`${ONBOARDING_DISMISS_KEY}:collapsed`, String(next));
      } catch {}
      return next;
    });
  };

  return (
    <Card className="border-accent/20 bg-gradient-to-br from-accent/10 via-surface to-surface animate-licia-pop-in">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-accent/10 p-2.5 text-accent">
          <Sparkles size={17} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-text">
                {progress.complete ? t("Semua langkah awal selesai 🎉") : t("Mulai dengan 5 langkah singkat")}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-textMuted">
                {progress.complete
                  ? t("Licia sekarang punya cukup data untuk memberi saran yang relevan.")
                  : t("{done} dari {total} selesai. Klik contoh untuk langsung mencobanya.", {
                      done: progress.done,
                      total: progress.total,
                    })}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={toggle}
                aria-expanded={!collapsed}
                aria-label={collapsed ? t("Tampilkan langkah") : t("Ciutkan langkah")}
                className="touch-target rounded-lg text-textMuted hover:bg-bg"
              >
                <ChevronDown size={15} className={clsx("transition", collapsed && "-rotate-90")} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={dismiss}
                aria-label={t("Tutup panduan awal")}
                className="touch-target rounded-lg text-textMuted hover:bg-bg"
              >
                <X size={15} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-bg"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.done}
            aria-label={t("Kemajuan panduan awal")}
          >
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress.percent}%` }} />
          </div>
          {!collapsed && (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {steps.map((step) => {
                const body = (
                  <>
                    {step.done ? (
                      <CheckCircle2 size={15} className="shrink-0 text-success" aria-hidden="true" />
                    ) : (
                      <span
                        className="h-[15px] w-[15px] shrink-0 rounded-full border border-border"
                        aria-hidden="true"
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span
                        className={clsx(
                          "block text-xs font-semibold",
                          step.done ? "text-textMuted line-through" : "text-text",
                        )}
                      >
                        {t(step.title)}
                      </span>
                      {!step.done && step.example && (
                        <span className="mt-0.5 block truncate text-2xs text-accent">
                          {t("Coba: {example}", { example: `“${t(step.example.text)}”` })}
                        </span>
                      )}
                    </span>
                    {!step.done && <ArrowRight size={12} className="shrink-0 text-textMuted" aria-hidden="true" />}
                  </>
                );
                const cls = clsx(
                  "flex min-h-11 items-center gap-2 rounded-xl border bg-surface/80 p-2.5 text-left transition",
                  step.done ? "border-border" : "border-border hover:-translate-y-0.5 hover:border-accent/40",
                  upNext?.id === step.id && "border-accent/40 ring-1 ring-accent/20",
                );
                return (
                  <li key={step.id}>
                    {step.done ? (
                      <div className={cls}>{body}</div>
                    ) : step.example ? (
                      <button
                        type="button"
                        className={clsx(cls, "w-full")}
                        onClick={() =>
                          window.dispatchEvent(
                            new CustomEvent(QUICK_CAPTURE_EVENT, {
                              detail: { mode: step.example!.mode, text: t(step.example!.text) },
                            }),
                          )
                        }
                      >
                        {body}
                      </button>
                    ) : (
                      <Link href={step.href ?? "/"} className={cls}>
                        {body}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
