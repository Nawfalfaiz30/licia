"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, Bell, CheckCircle2, Database, KeyRound, RefreshCw, Server, ShieldCheck, Smartphone, Sparkles, TimerReset, Zap, TestTube2, Globe2, Copy, ExternalLink, XCircle, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, PrimaryButton, SoftButton, notifyToast } from "@/components/ui";
import { getPushStatus, requestBrowserNotifications, type PushClientState } from "@/lib/notifications/client";

type Status = "ok" | "warn" | "error" | "loading";
function StatusPill({ status, label }: { status: Status; label: string }) { const Icon = status === "ok" ? CheckCircle2 : status === "loading" ? RefreshCw : status === "warn" ? Activity : XCircle; return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${status === "ok" ? "bg-success/10 text-success" : status === "warn" ? "bg-accent/10 text-accent" : status === "loading" ? "bg-accent/10 text-accent" : "bg-danger/10 text-danger"}`}><Icon size={12} className={status === "loading" ? "animate-spin" : ""}/>{label}</span>; }

export default function SystemPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<any>(null);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [push, setPush] = useState<any>(null);
  const [pushState, setPushState] = useState<PushClientState>("permission");
  const [counts, setCounts] = useState({ reminders: 0, notifications: 0, automations: 0, actions: 0, subscriptions: 0 });
  const [deviceOnline, setDeviceOnline] = useState(true);
  const [swReady, setSwReady] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [testingBrowser, setTestingBrowser] = useState(false);
  const [creatingReminder, setCreatingReminder] = useState(false);
  const [lastDispatch, setLastDispatch] = useState<any>(null);
  const [schemaReady, setSchemaReady] = useState<boolean | null>(null);
  const [schemaMissing, setSchemaMissing] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    try {
      const [{ data: { user } }, h, p, d] = await Promise.all([supabase.auth.getUser(), fetch("/api/health", { cache: "no-store" }), fetch("/api/push/vapid-public", { cache: "no-store" }), fetch("/api/system/diagnostics", { cache: "no-store" })]);
      if (!user) throw new Error("Belum masuk.");
      const [{ count: reminders, error: remindersError }, { count: notifications, error: notificationsError }, { count: automations, error: automationsError }, { count: actions, error: actionsError }, { count: subscriptions, error: subscriptionsError }] = await Promise.all([
        supabase.from("reminders").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("enabled", true).in("status", ["pending", "waiting_for_device"]),
        supabase.from("notification_events").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null),
        supabase.from("automations").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("enabled", true),
        supabase.from("ai_action_history").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("undoable", true),
        supabase.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("enabled", true),
      ]);
      const featureChecks = [
        ["reminders", remindersError],
        ["notification_events", notificationsError],
        ["push_subscriptions", subscriptionsError],
      ] as const;
      const missing: string[] = featureChecks.filter(([, error]) => Boolean(error)).map(([name]) => name);
      const diagnosticsData = await d.json().catch(() => null);
      if (diagnosticsData?.schema) {
        if (!diagnosticsData.schema.remindersV30) missing.push("reminders_v30_fields");
        if (!diagnosticsData.schema.notificationDeliveryFields) missing.push("notification_delivery_fields");
        if (!diagnosticsData.schema.heartbeatTable) missing.push("system_health_heartbeats");
        if (!diagnosticsData.schema.aiUsageEvents) missing.push("ai_usage_events");
      }
      setSchemaMissing(Array.from(new Set(missing)));
      setSchemaReady(missing.length === 0);
      setHealth(await h.json().catch(() => null));
      setPush(await p.json().catch(() => null));
      setDiagnostics(diagnosticsData);
      setPushState(await getPushStatus());
      setCounts({ reminders: reminders || 0, notifications: notifications || 0, automations: automations || 0, actions: actions || 0, subscriptions: subscriptions || 0 });
      setDeviceOnline(navigator.onLine);
      try {
        if (!navigator.serviceWorker) setSwReady(false);
        else {
          const registration = await navigator.serviceWorker.ready;
          setSwReady(Boolean(registration?.active));
        }
      } catch { setSwReady(false); }
    } catch (e) { notifyToast({ title: "System Center gagal dimuat", message: e instanceof Error ? e.message : "Coba lagi.", tone: "error" }); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); const on = () => setDeviceOnline(navigator.onLine); window.addEventListener("online", on); window.addEventListener("offline", on); return () => { window.removeEventListener("online", on); window.removeEventListener("offline", on); }; }, []);

  const rows = useMemo(() => [
    { label: "Database Supabase", status: health?.database ? "ok" as Status : loading ? "loading" as Status : "error" as Status, detail: health?.database ? "Terhubung dan merespons." : "Tidak dapat diakses.", icon: Database },
    { label: "Feature schema", status: schemaReady === null ? "loading" as Status : schemaReady ? "ok" as Status : "error" as Status, detail: schemaReady ? "Reminder, notification, AI telemetry, dan health table tersedia." : `Migration belum lengkap: ${schemaMissing.join(", ")}.`, icon: Sparkles },
    { label: "OpenAI", status: health?.configuration?.openaiConfigured ? "ok" as Status : "warn" as Status, detail: health?.configuration?.openaiConfigured ? "OPENAI_API_KEY terdeteksi di server." : "OPENAI_API_KEY belum tersedia.", icon: KeyRound },
    { label: "Web Push", status: push?.enabled ? "ok" as Status : "warn" as Status, detail: push?.enabled ? `${counts.subscriptions} perangkat terhubung.` : "VAPID + service role belum lengkap.", icon: Bell },
    { label: "Reminder Engine", status: diagnostics?.worker?.status === "ok" ? "ok" as Status : diagnostics?.worker?.status === "error" ? "error" as Status : loading ? "loading" as Status : "warn" as Status, detail: diagnostics?.worker?.heartbeat ? `Heartbeat ${Math.round((diagnostics.worker.ageMs || 0) / 1000)} detik lalu.` : diagnostics?.worker?.cronConfigured ? "Cron secret ada, tetapi worker belum mengirim heartbeat." : "Worker cron belum dikonfigurasi.", icon: TimerReset },
    { label: "Service Worker", status: swReady ? "ok" as Status : "warn" as Status, detail: swReady ? "Terdaftar/tersedia untuk PWA dan push." : "Belum terdeteksi; buka ulang halaman setelah HTTPS aktif.", icon: Smartphone },
    { label: "Perangkat", status: deviceOnline ? "ok" as Status : "warn" as Status, detail: deviceOnline ? "Online." : "Offline.", icon: Globe2 },
  ], [health, diagnostics, loading, push, counts.subscriptions, swReady, deviceOnline, schemaReady, schemaMissing]);

  async function dispatch() { setDispatching(true); try { const res = await fetch("/api/reminders/dispatch?mode=client", { cache: "no-store" }); const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.error || "Dispatch gagal."); setLastDispatch(data); notifyToast({ title: "Reminder engine dijalankan", message: `${data.delivered ?? 0} terkirim · ${data.waiting ?? 0} menunggu perangkat.`, tone: "success" }); await load(); } catch (e) { notifyToast({ title: "Dispatch gagal", message: e instanceof Error ? e.message : "Coba lagi.", tone: "error" }); } finally { setDispatching(false); } }

  async function browserTest() { setTestingBrowser(true); try { const result = await requestBrowserNotifications(); if (!result.ok) throw new Error(result.error || "Izin notifikasi browser belum diberikan."); new Notification("Licia — tes notifikasi", { body: "Notifikasi browser bekerja dari perangkat ini.", icon: "/icon-192.png", tag: `licia-browser-test-${Date.now()}` }); notifyToast({ title: "Tes browser berhasil", message: "Izin disimpan dan fallback browser aktif.", tone: "success" }); } catch (e) { notifyToast({ title: "Tes browser gagal", message: e instanceof Error ? e.message : "Coba lagi.", tone: "error" }); } finally { setTestingBrowser(false); } }

  async function pushTest() { setTestingPush(true); try { const res = await fetch("/api/push/test", { method: "POST" }); const data = await res.json().catch(() => ({})); if (!res.ok || !data.ok) throw new Error(data.error || "Push belum terkirim."); notifyToast({ title: "Tes push berhasil", message: `${data.delivered ?? 0} perangkat menerima permintaan push.`, tone: "success" }); await load(); } catch (e) { notifyToast({ title: "Tes push gagal", message: e instanceof Error ? e.message : "Push belum siap.", tone: "error" }); } finally { setTestingPush(false); } }

  async function createTestReminder() { setCreatingReminder(true); try { const res = await fetch("/api/reminders/test", { method: "POST", cache: "no-store" }); const data = await res.json().catch(() => ({})); if (!res.ok || !data.ok) throw new Error(data.error || "Reminder uji gagal dibuat."); notifyToast({ title: "Reminder uji dibuat", message: "Waktunya sekitar 1 menit dari sekarang.", tone: "success" }); await load(); } catch (e) { notifyToast({ title: "Reminder uji gagal", message: e instanceof Error ? e.message : "Coba lagi.", tone: "error" }); } finally { setCreatingReminder(false); } }

  const setupText = `LICIA_INTERNAL_URL=<INTERNAL_APP_URL>\nVAPID_SUBJECT=mailto:admin@domain-kamu\nVAPID_PUBLIC_KEY=...\nVAPID_PRIVATE_KEY=...\nSUPABASE_SERVICE_ROLE_KEY=...\nLICIA_CRON_SECRET=...`;
  async function copySetup() { try { await navigator.clipboard.writeText(setupText); notifyToast({ title: "Konfigurasi disalin", message: "Tempel ke .env.local di VPS dan jangan commit secret.", tone: "success" }); } catch { notifyToast({ title: "Tidak bisa menyalin", message: "Salin manual dari blok konfigurasi.", tone: "error" }); } }

  return <div className="system-v30 space-y-5 animate-licia-page-in">
    <header className="rounded-[1.75rem] border border-border bg-surface p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div className="min-w-0"><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-accent"><Server size={14}/> SYSTEM CENTER</p><h1 className="mt-1 break-words font-display text-3xl text-text">Kontrol & kesehatan Licia.</h1><p className="mt-1 max-w-2xl text-xs leading-relaxed text-textMuted">Cek koneksi, notifikasi, reminder, service worker, dan kesiapan server dari satu tempat.</p></div><div className="flex flex-wrap gap-2"><SoftButton onClick={()=>void load()} disabled={loading}><RefreshCw size={13} className={loading?"animate-spin":""}/> Segarkan</SoftButton><PrimaryButton onClick={()=>void dispatch()} disabled={dispatching}><Zap size={13}/>{dispatching?"Memproses…":"Jalankan reminder"}</PrimaryButton></div></div></header>

    <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5"><Link href="/reminders" className="rounded-2xl border border-border bg-surface p-4"><Bell size={15} className="text-accent"/><p className="mt-3 text-[9px] text-textMuted">Reminder aktif</p><p className="mt-1 text-xl font-semibold text-text">{counts.reminders}</p></Link><Link href="/timeline" className="rounded-2xl border border-border bg-surface p-4"><Activity size={15} className="text-accent"/><p className="mt-3 text-[9px] text-textMuted">Belum dibaca</p><p className="mt-1 text-xl font-semibold text-text">{counts.notifications}</p></Link><Link href="/automations" className="rounded-2xl border border-border bg-surface p-4"><Zap size={15} className="text-accent"/><p className="mt-3 text-[9px] text-textMuted">Automation</p><p className="mt-1 text-xl font-semibold text-text">{counts.automations}</p></Link><Link href="/ai-history" className="rounded-2xl border border-border bg-surface p-4"><ShieldCheck size={15} className="text-accent"/><p className="mt-3 text-[9px] text-textMuted">Undo AI</p><p className="mt-1 text-xl font-semibold text-text">{counts.actions}</p></Link><Link href="/settings" className="rounded-2xl border border-border bg-surface p-4"><Smartphone size={15} className="text-accent"/><p className="mt-3 text-[9px] text-textMuted">Push device</p><p className="mt-1 text-xl font-semibold text-text">{counts.subscriptions}</p></Link></section>

    <Card className="p-4 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-textMuted">Service health</p><div className="mt-1 flex items-center gap-2"><h2 className="font-display text-2xl text-text">Status sekarang</h2><StatusPill status={health?.ok ? "ok" : loading ? "loading" : "warn"} label={health?.ok ? "Sehat" : "Perlu perhatian"}/></div></div><div className="text-left sm:text-right"><p className="text-[9px] text-textMuted">Latency API</p><p className="mt-1 text-lg font-semibold text-text">{health?.latency_ms != null ? `${health.latency_ms} ms` : "—"}</p></div></div><div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{rows.map(r=>{const I=r.icon;return <div key={r.label} className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-bg/60 p-3"><span className="rounded-xl bg-accent/10 p-2 text-accent"><I size={15}/></span><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-text">{r.label}</p><p className="mt-0.5 break-words text-[10px] leading-relaxed text-textMuted">{r.detail}</p></div><StatusPill status={r.status} label={r.status === "ok" ? "OK" : r.status === "warn" ? "Periksa" : r.status === "loading" ? "Memuat" : "Gagal"}/></div>})}</div></Card>

    {diagnostics && <Card className={`${diagnostics.ok ? "border-success/15 bg-success/5" : "border-danger/15 bg-danger/5"} p-4`}><div className="flex flex-col gap-3 sm:flex-row sm:items-start"><span className={`rounded-xl p-2.5 ${diagnostics.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}><Activity size={16}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-text">V30 diagnostic engine</p><StatusPill status={diagnostics.ok ? "ok" : "error"} label={diagnostics.ok ? "Semua jalur sehat" : `${diagnostics.issues?.length || 0} masalah`}/></div><div className="mt-2 grid gap-2 text-[10px] text-textMuted sm:grid-cols-2 lg:grid-cols-4"><span>Worker: <b className="text-text">{diagnostics.worker?.status || "—"}</b></span><span>Overdue: <b className="text-text">{diagnostics.reminders?.overdue ?? 0}</b></span><span>Stuck: <b className="text-text">{diagnostics.reminders?.stuckProcessing ?? 0}</b></span><span>Orphan: <b className="text-text">{diagnostics.reminders?.orphaned ?? 0}</b></span></div>{diagnostics.issues?.length > 0 && <div className="mt-3 rounded-xl border border-danger/10 bg-surface p-3 text-[10px] leading-relaxed text-textMuted">{diagnostics.issues.slice(0,5).map((issue:string, i:number)=><p key={`${issue}-${i}`}>• {issue}</p>)}</div>}</div></div></Card>}

    {schemaReady === false && <Card className="border-danger/20 bg-danger/5 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start"><span className="rounded-xl bg-danger/10 p-2.5 text-danger"><Database size={16}/></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-text">Migration reminder belum lengkap</p><p className="mt-1 text-[10px] leading-relaxed text-textMuted">System Center menemukan table yang belum tersedia: <span className="font-semibold text-text">{schemaMissing.join(", ")}</span>. Jalankan file <span className="font-semibold text-text">supabase/schema_v30_core_intelligence.sql</span> di Supabase SQL Editor, lalu tekan Segarkan.</p></div><Link href="/guide" className="shrink-0 rounded-xl bg-surface px-3 py-2 text-[10px] font-semibold text-textMuted hover:text-accent">Panduan</Link></div></Card>}

    <section className="grid gap-4 lg:grid-cols-2"><Card className="p-4 sm:p-5"><div className="flex items-start gap-3"><span className="rounded-2xl bg-accent/10 p-3 text-accent"><TestTube2 size={18}/></span><div className="min-w-0"><h2 className="text-sm font-semibold text-text">Tes dari perangkat ini</h2><p className="mt-1 text-[10px] leading-relaxed text-textMuted">Tes browser tidak membutuhkan VAPID. Ini jalur paling cepat untuk memastikan izin notifikasi perangkat berfungsi.</p></div></div><div className="mt-4 flex flex-wrap gap-2"><SoftButton onClick={()=>void browserTest()} disabled={testingBrowser}>{testingBrowser?<RefreshCw size={13} className="animate-spin"/>:<Bell size={13}/>} Tes browser</SoftButton><SoftButton onClick={()=>void createTestReminder()} disabled={creatingReminder}>{creatingReminder?<RefreshCw size={13} className="animate-spin"/>:<TimerReset size={13}/>} Reminder 1 menit</SoftButton></div><p className="mt-3 text-[9px] text-textMuted">Web Push perangkat: <span className="font-semibold text-text">{pushState === "subscribed" ? "aktif" : pushState === "unconfigured" ? "server belum siap" : pushState === "denied" ? "diblokir" : pushState}</span></p></Card>
      <Card className="p-4 sm:p-5"><div className="flex items-start gap-3"><span className="rounded-2xl bg-accent/10 p-3 text-accent"><Bell size={18}/></span><div className="min-w-0"><h2 className="text-sm font-semibold text-text">Tes Web Push</h2><p className="mt-1 text-[10px] leading-relaxed text-textMuted">Jalur ini membutuhkan HTTPS, VAPID, service-role, subscription perangkat, dan server yang siap mengirim push.</p></div></div><div className="mt-4 flex flex-wrap gap-2"><SoftButton onClick={()=>void pushTest()} disabled={testingPush || pushState !== "subscribed"}>{testingPush?<RefreshCw size={13} className="animate-spin"/>:<Bell size={13}/>} Kirim tes push</SoftButton><Link href="/settings" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2 text-[10px] font-semibold text-textMuted hover:text-accent">Atur perangkat <ExternalLink size={12}/></Link></div>{!push?.enabled&&<p className="mt-3 rounded-xl bg-accent/10 p-3 text-[9px] leading-relaxed text-accent">Server push belum lengkap. Reminder tetap dapat membuat event notifikasi dan muncul di Notification Center; untuk notifikasi saat web tertutup, aktifkan Web Push + cron di VPS.</p>}</Card></section>

    <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]"><Card className="p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-textMuted">Reminder engine</p><h2 className="mt-1 font-display text-2xl text-text">Uji alur dari awal sampai akhir</h2></div><Link href="/reminders" className="text-xs font-semibold text-accent">Buka Pengingat →</Link></div><div className="mt-4 grid gap-2 sm:grid-cols-3"><div className="rounded-2xl bg-bg p-3"><p className="text-[9px] text-textMuted">1. Data</p><p className="mt-1 text-xs font-semibold text-text">Reminder tersimpan</p></div><div className="rounded-2xl bg-bg p-3"><p className="text-[9px] text-textMuted">2. Dispatch</p><p className="mt-1 text-xs font-semibold text-text">Engine memeriksa jatuh tempo</p></div><div className="rounded-2xl bg-bg p-3"><p className="text-[9px] text-textMuted">3. Delivery</p><p className="mt-1 text-xs font-semibold text-text">Browser event atau Web Push</p></div></div>{lastDispatch&&<div className="mt-3 rounded-2xl border border-accent/15 bg-accent/5 p-3 text-[10px] text-textMuted">Dispatch terakhir: <span className="font-semibold text-text">{lastDispatch.delivered ?? 0} terkirim</span> · {lastDispatch.waiting ?? 0} menunggu · {lastDispatch.failed ?? 0} gagal.</div>}</Card>
      <Card className="p-4 sm:p-5"><div className="flex items-center justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-textMuted">Server setup</p><h2 className="mt-1 text-sm font-semibold text-text">Environment push</h2></div><button type="button" onClick={()=>void copySetup()} className="rounded-lg p-2 text-textMuted hover:bg-bg hover:text-accent" title="Salin konfigurasi"><Copy size={14}/></button></div><pre className="mt-3 overflow-x-auto rounded-xl bg-bg p-3 text-[9px] leading-relaxed text-textMuted">{setupText}</pre><p className="mt-3 text-[9px] leading-relaxed text-textMuted">Secret hanya di VPS. Jangan masukkan nilai sebenarnya ke Git atau ZIP.</p><div className="mt-3 flex flex-wrap gap-2"><Link href="/guide" className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-accent">Lihat Panduan <ArrowRight size={11}/></Link></div></Card></section>

    <Card className="border-accent/15 bg-accent/5 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-start gap-3"><span className="rounded-xl bg-accent/10 p-2.5 text-accent"><ShieldCheck size={16}/></span><div className="min-w-0"><p className="text-sm font-semibold text-text">Jalur aman</p><p className="mt-1 text-[10px] leading-relaxed text-textMuted">Browser test → Reminder test → Dispatch manual → Web Push test. Jalankan berurutan untuk mencari titik yang bermasalah.</p></div></div><Link href="/settings" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-surface px-3 py-2 text-[10px] font-semibold text-textMuted hover:text-accent">Pengaturan <ArrowRight size={12}/></Link></div></Card>
  </div>;
}
