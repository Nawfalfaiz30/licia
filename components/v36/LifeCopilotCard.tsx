"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { Card, SoftButton } from "@/components/ui";

import { useLanguage } from "@/components/LanguageProvider";
type Signal = {
  severity: string;
  score: number;
  label: string;
  detail: string;
  href?: string | null;
  sourceType: string;
  sourceId?: string | null;
};
type Payload = { signals: Signal[]; stats: any; nextMove: string; today: string };

export function LifeCopilotCard({ compact = false }: { compact?: boolean }) {
  const { t: tr } = useLanguage();
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, boolean>>({});
  async function load() {
    setBusy(true);
    try {
      const r = await fetch("/api/v36/copilot", { cache: "no-store" });
      if (r.ok) setData(await r.json());
    } finally {
      setBusy(false);
    }
  }
  async function sendFeedback(s: Signal, useful: boolean) {
    const key = `${s.sourceType}:${s.sourceId || s.label}`;
    setFeedback((v) => ({ ...v, [key]: useful }));
    try {
      await fetch("/api/v36/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insightKey: key, useful, context: { label: s.label, score: s.score } }),
      });
    } catch {}
  }
  useEffect(() => {
    void load();
  }, []);
  if (!data)
    return (
      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-2 text-sm text-textMuted">
          <BrainCircuit size={16} className="text-accent" /> {tr("Memuat Life Copilot…")}
        </div>
      </Card>
    );
  const top = data.signals?.slice(0, compact ? 3 : 5) ?? [];
  return (
    <Card className="overflow-hidden border-accent/15 bg-gradient-to-br from-accent/5 via-surface to-surface p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-accent/10 p-3 text-accent">
          <BrainCircuit size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-2xs font-bold uppercase tracking-[.16em] text-accent">{tr("Life Copilot")}</p>
              <h2 className="mt-1 font-display text-xl text-text">{tr("Untuk sekarang")}</h2>
            </div>
            <SoftButton className="min-h-9 px-2.5 py-1.5 text-2xs" onClick={() => void load()} disabled={busy}>
              <RefreshCw size={12} className={busy ? "animate-spin" : ""} />
            </SoftButton>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-textMuted">
            {tr("Keadaan saat ini, risiko terdekat, evidence, dan satu langkah berikutnya.")}
          </p>
          <p className="mt-1 text-2xs leading-relaxed text-text">{data.nextMove}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {top.map((s, i) => {
          const critical = s.severity === "critical";
          const attention = s.severity === "attention";
          return (
            <Link
              key={`${s.sourceType}-${s.sourceId || i}`}
              href={s.href || "/insights"}
              className="group rounded-2xl border border-border bg-bg/60 p-3 transition hover:-translate-y-0.5 hover:border-accent/30"
            >
              <div className="flex items-start gap-2">
                <span
                  className={`rounded-xl p-2 ${critical ? "bg-danger/10 text-danger" : attention ? "bg-accent/10 text-accent" : "bg-success/10 text-success"}`}
                >
                  {critical ? (
                    <AlertTriangle size={14} />
                  ) : attention ? (
                    <ShieldCheck size={14} />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-text">{s.label}</p>
                  <p className="mt-1 text-2xs leading-relaxed text-textMuted">{s.detail}</p>
                  <div className="mt-2 flex gap-1.5">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void sendFeedback(s, true);
                      }}
                      className={`rounded-lg p-1.5 ${feedback[`${s.sourceType}:${s.sourceId || s.label}`] === true ? "bg-success/10 text-success" : "bg-surface text-textMuted hover:text-success"}`}
                      aria-label={tr("Insight ini berguna")}
                    >
                      <ThumbsUp size={10} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void sendFeedback(s, false);
                      }}
                      className={`rounded-lg p-1.5 ${feedback[`${s.sourceType}:${s.sourceId || s.label}`] === false ? "bg-danger/10 text-danger" : "bg-surface text-textMuted hover:text-danger"}`}
                      aria-label={tr("Insight ini kurang tepat")}
                    >
                      <ThumbsDown size={10} />
                    </button>
                  </div>
                </div>
                <ArrowRight size={12} className="mt-1 shrink-0 text-textMuted transition group-hover:translate-x-0.5" />
              </div>
            </Link>
          );
        })}
      </div>
      {!compact && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-2xs font-semibold text-white"
          >
            <Sparkles size={12} /> {tr("Buka Life Copilot")} <ArrowRight size={11} />
          </Link>
          <Link
            href="/planner"
            className="inline-flex items-center gap-1.5 rounded-xl bg-bg px-3 py-2 text-2xs font-semibold text-textMuted hover:text-accent"
          >
            {tr("Susun rencana")}
          </Link>
        </div>
      )}
    </Card>
  );
}
