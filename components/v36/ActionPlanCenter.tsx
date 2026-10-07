"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Clock3, ShieldAlert, Undo2, XCircle } from "lucide-react";
import { Card } from "@/components/ui";

import { useLanguage } from "@/components/LanguageProvider";
import { documentLocale } from "@/lib/format";
type Plan = {
  id: string;
  title: string;
  goal: string;
  mode: string;
  confidence: number | null;
  risk: string;
  actions: any[];
  result: any;
  created_at: string;
  expires_at: string | null;
  confidence_reason?: string | null;
  evidence?: any[];
};
export function ActionPlanCenter() {
  const { t: tr } = useLanguage();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      const r = await fetch("/api/v36/plan", { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        setPlans(j.plans || []);
      }
    } catch {}
  }
  useEffect(() => {
    void load();
  }, []);
  async function cancel(id: string) {
    setBusy(true);
    try {
      await fetch("/api/v36/plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, mode: "cancelled" }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }
  if (!plans.length) return null;
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <ClipboardCheck size={16} className="text-accent" />
        <div>
          <p className="text-sm font-semibold text-text">{tr("Rencana tindakan Licia")}</p>
          <p className="text-2xs text-textMuted">{tr("Preview, risiko, evidence, dan status perubahan AI.")}</p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {plans.slice(0, 5).map((p) => {
          const evidence = p.evidence ?? [];
          return (
            <div key={p.id} className="rounded-xl border border-border bg-bg p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-text">{p.title}</p>
                  <p className="mt-1 text-2xs text-textMuted line-clamp-2">{p.goal}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-2xs font-semibold ${p.risk === "destructive" ? "bg-danger/10 text-danger" : p.risk === "high" ? "bg-accent/10 text-accent" : "bg-success/10 text-success"}`}
                >
                  {p.risk}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-2xs text-textMuted">
                <span>
                  {p.actions?.length || 0} {tr("aksi")}
                </span>
                {p.confidence != null && (
                  <span>
                    {tr("confidence")} {Math.round(Number(p.confidence) * 100)}%
                  </span>
                )}
                {evidence.length > 0 && (
                  <span>{tr("{evidence_length} evidence", { evidence_length: evidence.length })}</span>
                )}
                {p.expires_at && (
                  <span>
                    <Clock3 size={10} className="mr-0.5 inline" />
                    {new Date(p.expires_at).toLocaleTimeString(documentLocale(), {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
              {p.confidence_reason && (
                <p className="mt-2 text-2xs leading-relaxed text-textMuted">{p.confidence_reason}</p>
              )}
              {evidence.length > 0 && (
                <details className="mt-2 rounded-lg bg-surface p-2">
                  <summary className="cursor-pointer text-2xs font-semibold text-accent">
                    {tr("Lihat evidence")}
                  </summary>
                  <div className="mt-2 space-y-1">
                    {evidence.slice(0, 4).map((e: any, i: number) => (
                      <p key={i} className="text-2xs leading-relaxed text-textMuted">
                        • {e.label}: {e.detail}
                      </p>
                    ))}
                  </div>
                </details>
              )}
              {p.mode === "preview" && (
                <div className="mt-2 flex gap-2">
                  <Link
                    href="/insights"
                    className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-2xs font-semibold text-white"
                  >
                    {tr("Tinjau")}
                  </Link>
                  <button
                    onClick={() => void cancel(p.id)}
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-lg bg-surface px-2.5 py-1.5 text-2xs font-semibold text-textMuted hover:text-danger"
                  >
                    <XCircle size={11} /> {tr("Batalkan")}
                  </button>
                </div>
              )}
              {p.mode === "committed" && (
                <span className="inline-flex items-center gap-1 mt-2 text-2xs text-success">
                  <ClipboardCheck size={11} /> {tr("Sudah diterapkan")}
                </span>
              )}
              {p.mode === "cancelled" && (
                <span className="inline-flex items-center gap-1 mt-2 text-2xs text-textMuted">
                  <Undo2 size={11} /> {tr("Dibatalkan")}
                </span>
              )}
              {evidence.length > 0 && (
                <p className="mt-2 text-2xs text-textMuted">
                  <ShieldAlert size={10} className="mr-1 inline" />
                  {tr("{evidence_length} sumber evidence", { evidence_length: evidence.length })}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
