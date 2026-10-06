"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { BrainCircuit, ArrowRight, Lightbulb, AlertTriangle, TrendingUp, Sparkles, Gauge, Inbox, Target, Wallet, Timer, RefreshCw, Zap, Compass, Share2, History, BarChart3, ClipboardCheck } from "lucide-react";
import { Card, EmptyState, SectionTitle } from "@/components/ui";
import { clsx } from "clsx";
import { EndOfDayReview } from "@/components/intelligence/EndOfDayReview";

import { useLanguage } from "@/components/LanguageProvider";
type Suggestion = { id: string; title: string; detail: string; href: string; action: string; tone: string };
type Payload = { suggestions: Suggestion[]; notifications: Suggestion[]; nextActions: Array<{ id: string; title: string; href: string }>; stats: any; insightSummary?: any };
const icon = (tone: string): LucideIcon => tone === "danger" ? AlertTriangle : tone === "success" ? TrendingUp : Lightbulb;

function Stat({ icon: Icon, label, value, detail, tone = "accent" }: { icon: LucideIcon; label: string; value: string; detail: string; tone?: "accent" | "success" | "danger" }) {
  const iconTone = tone === "danger" ? "bg-danger/10 text-danger" : tone === "success" ? "bg-success/10 text-success" : "bg-accent/10 text-accent";
  return <div className="licia-refined-hover animate-licia-reveal rounded-2xl border border-border bg-surface p-4"><div className="flex items-center gap-2"><span className={clsx("rounded-xl p-2", iconTone)}><Icon size={15}/></span><span className="text-2xs font-semibold uppercase tracking-wider text-textMuted">{label}</span></div><p className="mt-3 font-display text-2xl text-text tabular-nums">{value}</p><p className="mt-1 text-2xs leading-relaxed text-textMuted">{detail}</p></div>;
}

export default function InsightsPage() {
  const { t: tr } = useLanguage();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(refresh = false) {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const r = await fetch(`/api/intelligence?now=${encodeURIComponent(new Date().toISOString())}`, { cache: "no-store" });
      const next = r.ok ? await r.json() : null;
      if (next) setData(next);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { void load(); }, []);

  const rows = useMemo(() => data ? [...(data.suggestions || []), ...(data.notifications || [])].filter((x, i, a) => a.findIndex(y => y.id === x.id) === i) : [], [data]);
  const summary = data?.insightSummary;
  if (loading && !data) return <div className="space-y-4"><div className="h-36 animate-licia-shimmer rounded-3xl bg-bg"/><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({length:4}).map((_,i)=><div key={i} className="h-32 animate-pulse rounded-2xl bg-bg"/>)}</div></div>;
  if (!data) return <EmptyState title={tr("Pusat Insight belum tersedia")} description={tr("Coba muat ulang setelah koneksi kembali normal.")}/>;

  return <div className="space-y-6 animate-licia-page-in">
    <header className="relative overflow-hidden rounded-3xl border border-accent/15 bg-gradient-to-br from-accent/10 via-surface to-surface p-5 sm:p-7">
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-accent/10 blur-3xl animate-licia-float" aria-hidden="true"/>
      <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent"><Sparkles size={14}/> {" "}{tr("LAPISAN KECERDASAN")}</p><h1 className="font-display text-3xl text-text sm:text-4xl">{tr("Pusat Insight")}</h1><p className="mt-2 max-w-3xl text-sm leading-relaxed text-textMuted">{tr("Bukan sekadar statistik. Di sini Licia merangkum sinyal penting, menjelaskan pola, dan menunjukkan langkah yang paling masuk akal dari data kamu.")}</p></div><button onClick={()=>void load(true)} disabled={refreshing} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-xs font-semibold text-textMuted transition hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:opacity-60"><RefreshCw size={13} className={refreshing?"animate-spin":""}/> {refreshing?tr("Memperbarui…"):tr("Perbarui")}</button></div>
    </header>

    {summary && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Stat icon={Gauge} label={tr("Beban saat ini")} value={`${summary.workloadScore}/100`} detail={tr("Skor ringkas dari tugas tertunda, tenggat, dan ritme fokus.")} tone={summary.workloadScore < 55 ? "danger" : summary.workloadScore < 75 ? "accent" : "success"}/>
      <Stat icon={Target} label={tr("Risiko proyek")} value={String(summary.projectRiskCount)} detail={tr("Proyek yang stagnan atau mendekati deadline.")} tone={summary.projectRiskCount > 0 ? "danger" : "success"}/>
      <Stat icon={Timer} label={tr("Hari fokus")} value={tr("{focusDays} hari", { focusDays: summary.focusDays })} detail={tr("Konsistensi sesi fokus pada minggu berjalan.")} tone="success"/>
      <Stat icon={Wallet} label={tr("Perubahan pengeluaran")} value={summary.expenseDeltaPct === null ? "—" : `${summary.expenseDeltaPct > 0 ? "+" : ""}${summary.expenseDeltaPct}%`} detail={tr("Dibanding bulan sebelumnya.")} tone={summary.expenseDeltaPct !== null && summary.expenseDeltaPct > 0 ? "danger" : "success"}/>
    </div>}

    <EndOfDayReview />

    <Card className="border-accent/15 bg-accent/5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="rounded-xl bg-accent/10 p-2.5 text-accent"><Zap size={15}/></span><div><p className="text-2xs font-bold uppercase tracking-[.14em] text-accent">{tr("Otomasi")}</p><h2 className="mt-1 text-sm font-semibold text-text">{tr("Tindakan berulang tanpa menu tambahan")}</h2><p className="mt-1 text-2xs leading-relaxed text-textMuted">{tr("Workflow otomatis tetap tersedia di sini supaya navigasi utama tetap ringkas.")}</p></div></div><Link href="/automations" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-bg px-3 text-2xs font-semibold text-textMuted hover:text-accent">{tr("Buka Otomasi")}{" "}<ArrowRight size={11}/></Link></div></Card>

    <Card id="insight-explore" className="p-4 sm:p-5"><SectionTitle>{tr("Eksplorasi dalam Insights")}</SectionTitle><p className="mt-1 text-2xs leading-relaxed text-textMuted">{tr("Semua alat wawasan lama tetap dapat dipakai tanpa mengembalikan menu terpisah. Pilih konteks di bawah ini.")}</p><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{[[Compass,"Peta Hidup","/life-map"],[Share2,"Peta Koneksi","/life-graph"],[History,"Linimasa","/timeline"],[BarChart3,"Analitik Pribadi","/analytics"],[ClipboardCheck,"Review & Ringkasan","/brief"]].map(([I,label,id]:any)=><a key={id} href={id} className="group flex items-center gap-3 rounded-2xl border border-border bg-bg p-3 transition hover:border-accent/25 hover:bg-accent/5"><span className="rounded-xl bg-accent/10 p-2 text-accent"><I size={15}/></span><span className="min-w-0 flex-1 text-xs font-semibold text-text">{label}</span><ArrowRight size={12} className="text-textMuted transition group-hover:translate-x-0.5 group-hover:text-accent"/></a>)}</div></Card>

    {rows.length ? <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
      <Card className="licia-ambient-glow overflow-hidden"><SectionTitle>{tr("Yang perlu diperhatikan")}</SectionTitle><div className="space-y-2">{rows.slice(0,8).map((r,i)=>{const I=icon(r.tone);return <Link key={`${r.id}-${i}`} href={r.href} className="group flex items-start gap-3 rounded-2xl border border-border bg-bg/55 p-3.5 transition duration-200 hover:-translate-y-0.5 hover:border-accent/35 hover:bg-accent/5"><div className={clsx("rounded-xl p-2.5",r.tone === "danger" ? "bg-danger/10 text-danger" : r.tone === "success" ? "bg-success/10 text-success" : "bg-accent/10 text-accent")}><I size={15}/></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-text">{r.title}</p><p className="mt-1 text-xs leading-relaxed text-textMuted">{r.detail}</p><span className="mt-2 inline-flex items-center gap-1 text-2xs font-semibold text-accent">{r.action || "Tinjau"}<ArrowRight size={11} className="transition group-hover:translate-x-0.5"/></span></div></Link>})}</div></Card>
      <div className="space-y-4">
        <Card><SectionTitle>{tr("Radar sinyal")}</SectionTitle><div className="space-y-2">{[[Inbox,"Inbox terbuka",summary?.signals?.inbox||0,"/capture"],[AlertTriangle,tr("Tugas terlambat"),summary?.signals?.overdue||0,"/tasks"],[Wallet,"Langganan dekat jatuh tempo",summary?.signals?.dueSubscriptions||0,"/finance?tab=subscriptions"],[BrainCircuit,tr("Keputusan perlu ditinjau"),summary?.signals?.decisionsDue||0,"/decisions"]].map(([I,label,value,href]:any)=><Link key={label} href={href} className="flex items-center gap-3 rounded-xl border border-border bg-bg/50 p-3 transition hover:border-accent/30"><span className="rounded-lg bg-accent/10 p-2 text-accent"><I size={14}/></span><span className="min-w-0 flex-1 text-xs font-semibold text-text">{label}</span><span className="font-display text-lg text-text">{value}</span></Link>)}</div></Card>
        <Card className="border-accent/15 bg-accent/5"><div className="flex items-start gap-3"><BrainCircuit size={17} className="mt-0.5 shrink-0 text-accent"/><div><p className="text-sm font-semibold text-text">{tr("Cara membaca Insight")}</p><p className="mt-1 text-xs leading-relaxed text-textMuted">{tr("Insight berasal dari data nyata Licia. Angka ringkas menunjukkan sinyal; kartu di atas membawa kamu ke modul sumber agar kamu bisa memeriksa dan mengambil keputusan sendiri.")}</p></div></div></Card>
      </div>
    </div> : <EmptyState title={tr("Belum ada insight kuat")} description={tr("Saat data bertambah, Licia akan menampilkan sinyal yang cukup bermakna untuk ditindaklanjuti.")}/>}
  </div>;
}
