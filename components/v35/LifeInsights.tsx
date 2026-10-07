"use client";
import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, HeartPulse, Timer, Wallet } from "lucide-react";
import { Card } from "@/components/ui";

import { useLanguage } from "@/components/LanguageProvider";
export function LifeInsights() {
  const { t: tr, locale } = useLanguage();
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    let active = true;
    const load = () =>
      fetch("/api/v35/insights", { cache: "no-store", credentials: "include" })
        .then((r) => r.json())
        .then((j) => active && setData(j?.ok ? j : null))
        .catch(() => {});
    load();
    const on = () => load();
    window.addEventListener("licia:sync-complete", on);
    return () => {
      active = false;
      window.removeEventListener("licia:sync-complete", on);
    };
  }, []);
  if (!data) return null;
  const financeUp = data.finance.delta > 0;
  const focusUp = data.focus.delta >= 0;
  const h = data.health?.latest;
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <Card className="licia-v35-card">
        <div className="flex items-center gap-2">
          <Wallet size={15} className="text-accent" />
          <p className="text-xs font-semibold text-text">{tr("Keuangan 14 hari")}</p>
        </div>
        <p className="mt-2 text-lg font-display text-text">
          {tr("Rp")} {Math.round(data.finance.spendRecent).toLocaleString(locale)}
        </p>
        <p className="mt-1 flex items-center gap-1 text-2xs text-textMuted">
          {financeUp ? (
            <ArrowUpRight size={12} className="text-danger" />
          ) : (
            <ArrowDownRight size={12} className="text-success" />
          )}
          {Math.abs(Math.round(data.finance.delta)).toLocaleString(locale)} {tr("dibanding 7 hari sebelumnya")}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {data.finance.categories.slice(0, 3).map((x: any) => (
            <span key={x.category} className="rounded-full bg-bg px-2 py-1 text-2xs text-textMuted">
              {tr("{category}: Rp", { category: x.category })} {Math.round(x.amount).toLocaleString(locale)}
            </span>
          ))}
        </div>
      </Card>
      <Card className="licia-v35-card">
        <div className="flex items-center gap-2">
          <Timer size={15} className="text-accent" />
          <p className="text-xs font-semibold text-text">{tr("Ritme fokus")}</p>
        </div>
        <p className="mt-2 text-lg font-display text-text">
          {tr("{recentMinutes} menit", { recentMinutes: data.focus.recentMinutes })}
        </p>
        <p className="mt-1 flex items-center gap-1 text-2xs text-textMuted">
          {focusUp ? (
            <ArrowUpRight size={12} className="text-success" />
          ) : (
            <ArrowDownRight size={12} className="text-danger" />
          )}
          {tr("{abs} menit dibanding minggu sebelumnya", { abs: Math.abs(data.focus.delta) })}
        </p>
        <p className="mt-3 text-2xs leading-relaxed text-textMuted">
          {tr("Gunakan ritme ini sebagai sinyal kapasitas, bukan skor kinerja.")}
        </p>
      </Card>
      <Card className="licia-v35-card">
        <div className="flex items-center gap-2">
          <HeartPulse size={15} className="text-accent" />
          <p className="text-xs font-semibold text-text">{tr("Kesehatan terkini")}</p>
        </div>
        {h ? (
          <>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                ["Berat", h.weight_kg ? `${h.weight_kg} kg` : "—"],
                ["Tekanan", h.systolic && h.diastolic ? `${h.systolic}/${h.diastolic}` : "—"],
                ["Nadi", h.resting_hr ? `${h.resting_hr} bpm` : "—"],
              ].map(([a, b]) => (
                <div key={a} className="rounded-xl bg-bg p-2.5">
                  <p className="text-2xs text-textMuted">{a}</p>
                  <p className="mt-1 text-xs font-semibold text-text">{b}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-3 text-2xs text-textMuted">{tr("Belum ada metrik kesehatan untuk dianalisis.")}</p>
        )}
      </Card>
    </div>
  );
}
