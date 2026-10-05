"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, Bell, CheckCircle2, Database, KeyRound, RefreshCw, Server, ShieldCheck, Smartphone, Sparkles, TimerReset, Zap, TestTube2, Globe2, Copy, ExternalLink, XCircle, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, PrimaryButton, SoftButton, notifyToast } from "@/components/ui";
import { getPushStatus, requestBrowserNotifications, type PushClientState } from "@/lib/notifications/client";
import { ConflictCenter } from "@/components/sync/ConflictCenter";
import { FeatureCoverage } from "@/components/v35/FeatureCoverage";
import { useLanguage } from "@/components/LanguageProvider";

type Status = "ok" | "warn" | "error" | "loading";
function StatusPill({ status, label }: { status: Status; label: string }) { const Icon = status === "ok" ? CheckCircle2 : status === "loading" ? RefreshCw : status === "warn" ? Activity : XCircle; return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${status === "ok" ? "bg-success/10 text-success" : status === "warn" ? "bg-accent/10 text-accent" : status === "loading" ? "bg-accent/10 text-accent" : "bg-danger/10 text-danger"}`}><Icon size={12} className={status === "loading" ? "animate-spin" : ""}/>{label}</span>; }

export default function SystemPage() {
  const { tr } = useLanguage();
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
      if (!user) throw new Error(tr("Belum masuk."));
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
        if (!diagnosticsData.schema.syncDevices) missing.push("life_os_sync_devices");
        if (!diagnosticsData.schema.syncEvents) missing.push("life_os_sync_events");
        if (!diagnosticsData.schema.syncMutations) missing.push("life_os_sync_mutations");
        if (!diagnosticsData.schema.aiActionPlans) missing.push("ai_action_plans");
        if (!diagnosticsData.schema.aiWatchers) missing.push("ai_watchers");
        if (!diagnosticsData.schema.taskDependencies) missing.push("life_os_task_dependencies");
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
    } catch (e) { notifyToast({ title: tr("Pusat Sistem gagal dimuat"), message: e instanceof Error ? e.message : tr("Coba lagi."), tone: "error" }); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); const on = () => setDeviceOnline(navigator.onLine); window.addEventListener("online", on); window.addEventListener("offline", on); return () => { window.removeEventListener("online", on); window.removeEventListener("offline", on); }; }, []);

  const rows = useMemo(() => [
    { label: tr("Database Supabase"), status: health?.database ? "ok" as Status : loading ? "loading" as Status : "error" as Status, detail: health?.database ? tr("Terhubung dan merespons.") : tr("Tidak dapat diakses."), icon: Database },
    { label: tr("Feature schema"), status: schemaReady === null ? "loading" as Status : schemaReady ? "ok" as Status : "error" as Status, detail: schemaReady ? tr("Reminder, notification, AI telemetry, dan health table tersedia.") : tr("Migration belum lengkap: {0}.", [schemaMissing.join(", ")]), icon: Sparkles },
    { label: tr("OpenAI"), status: health?.configuration?.openaiConfigured ? "ok" as Status : "warn" as Status, detail: health?.configuration?.openaiConfigured ? tr("OPENAI_API_KEY terdeteksi di server.") : tr("OPENAI_API_KEY belum tersedia."), icon: KeyRound },
    { label: tr("Web Push"), status: push?.enabled ? "ok" as Status : "warn" as Status, detail: push?.enabled ? tr("{0} perangkat terhubung.", [counts.subscriptions]) : tr("Belum siap{0}", [push?.missing?.length ? `: ${push.missing.join(", ")}` : "."]), icon: Bell },
    { label: tr("Reminder Engine"), status: diagnostics?.worker?.status === "ok" ? "ok" as Status : diagnostics?.worker?.status === "error" ? "error" as Status : loading ? "loading" as Status : "warn" as Status, detail: diagnostics?.worker?.heartbeat ? tr("Heartbeat {0} detik lalu.", [Math.round((diagnostics.worker.ageMs || 0) / 1000)]) : diagnostics?.worker?.cronConfigured ? tr("Cron secret ada, tetapi worker belum mengirim heartbeat.") : tr("Worker cron belum dikonfigurasi."), icon: TimerReset },
    { label: tr("Service Worker"), status: swReady ? "ok" as Status : "warn" as Status, detail: swReady ? tr("Terdaftar/tersedia untuk PWA dan push.") : tr("Belum terdeteksi; buka ulang halaman setelah HTTPS aktif."), icon: Smartphone },
    { label: tr("Perangkat"), status: deviceOnline ? "ok" as Status : "warn" as Status, detail: deviceOnline ? "Online." : "Offline.", icon: Globe2 },
  ], [health, diagnostics, loading, push, counts.subscriptions, swReady, deviceOnline, schemaReady, schemaMissing]);

  async function dispatch() { setDispatching(true); try { const res = await fetch("/api/reminders/dispatch?mode=client", { cache: "no-store" }); const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.error || tr("Dispatch gagal.")); setLastDispatch(data); notifyToast({ title: tr("Reminder engine dijalankan"), message: tr("{0} terkirim · {1} menunggu perangkat.", [data.delivered ?? 0, data.waiting ?? 0]), tone: "success" }); await load(); } catch (e) { notifyToast({ title: tr("Dispatch gagal"), message: e instanceof Error ? e.message : tr("Coba lagi."), tone: "error" }); } finally { setDispatching(false); } }

  async function browserTest() { setTestingBrowser(true); try { const result = await requestBrowserNotifications(); if (!result.ok) throw new Error(result.error || tr("Izin notifikasi browser belum diberikan.")); new Notification("Licia — tes notifikasi", { body: tr("Notifikasi browser bekerja dari perangkat ini."), icon: "/icon-192.png", tag: `licia-browser-test-${Date.now()}` }); notifyToast({ title: tr("Tes browser berhasil"), message: tr("Izin disimpan dan fallback browser aktif."), tone: "success" }); } catch (e) { notifyToast({ title: tr("Tes browser gagal"), message: e instanceof Error ? e.message : tr("Coba lagi."), tone: "error" }); } finally { setTestingBrowser(false); } }

  async function pushTest() { setTestingPush(true); try { const res = await fetch("/api/push/test", { method: "POST" }); const data = await res.json().catch(() => ({})); if (!res.ok || !data.ok) throw new Error(data.error || (data.code === "NO_PUSH_SUBSCRIPTION" ? tr("Perangkat ini belum berlangganan Web Push.") : tr("Push belum terkirim."))); notifyToast({ title: tr("Tes push berhasil"), message: tr("{0} perangkat menerima permintaan push.", [data.delivered ?? 0]), tone: "success" }); await load(); } catch (e) { notifyToast({ title: tr("Tes push gagal"), message: e instanceof Error ? e.message : tr("Push belum siap."), tone: "error" }); } finally { setTestingPush(false); } }

  async function createTestReminder() { setCreatingReminder(true); try { const res = await fetch("/api/reminders/test", { method: "POST", cache: "no-store" }); const data = await res.json().catch(() => ({})); if (!res.ok || !data.ok) throw new Error(data.error || tr("Reminder uji gagal dibuat.")); notifyToast({ title: tr("Reminder uji dibuat"), message: tr("Waktunya sekitar 1 menit dari sekarang."), tone: "success" }); await load(); } catch (e) { notifyToast({ title: tr("Reminder uji gagal"), message: e instanceof Error ? e.message : tr("Coba lagi."), tone: "error" }); } finally { setCreatingReminder(false); } }

  const setupText = tr("LICIA_INTERNAL_URL=<INTERNAL_APP_URL>\nVAPID_SUBJECT=mailto:admin@domain-kamu\nVAPID_PUBLIC_KEY=...\nVAPID_PRIVATE_KEY=...\nSUPABASE_SERVICE_ROLE_KEY=...\nLICIA_CRON_SECRET=...");
  async function copySetup() { try { await navigator.clipboard.writeText(setupText); notifyToast({ title: tr("Konfigurasi disalin"), message: tr("Tempel ke .env.local di VPS dan jangan commit secret."), tone: "success" }); } catch { notifyToast({ title: tr("Tidak bisa menyalin"), message: tr("Salin manual dari blok konfigurasi."), tone: "error" }); } }

  return <div className="system-v30 space-y-5 animate-licia-page-in">
    <header className="rounded-[1.75rem] border border-border bg-surface p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div className="min-w-0"><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-accent"><Server size={14}/> {tr("SYSTEM CENTER")}</p><h1 className="mt-1 break-words font-display text-3xl text-text">{tr("Kontrol & kesehatan Licia.")}</h1><p className="mt-1 max-w-2xl text-xs leading-relaxed text-textMuted">{tr("Cek koneksi, notifikasi, reminder, service worker, dan kesiapan server dari satu tempat.")}</p></div><div className="flex flex-wrap gap-2"><SoftButton onClick={()=>void load()} disabled={loading}><RefreshCw size={13} className={loading?"animate-spin":""}/> {tr("Segarkan")}</SoftButton><PrimaryButton onClick={()=>void dispatch()} disabled={dispatching}><Zap size={13}/>{dispatching?tr("Memproses…"):tr("Jalankan reminder")}</PrimaryButton></div></div></header>

    <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5"><Link href="/reminders" className="rounded-2xl border border-border bg-surface p-4"><Bell size={15} className="text-accent"/><p className="mt-3 text-[9px] text-textMuted">{tr("Reminder aktif")}</p><p className="mt-1 text-xl font-semibold text-text">{counts.reminders}</p></Link><Link href="/timeline" className="rounded-2xl border border-border bg-surface p-4"><Activity size={15} className="text-accent"/><p className="mt-3 text-[9px] text-textMuted">{tr("Belum dibaca")}</p><p className="mt-1 text-xl font-semibold text-text">{counts.notifications}</p></Link><Link href="/automations" className="rounded-2xl border border-border bg-surface p-4"><Zap size={15} className="text-accent"/><p className="mt-3 text-[9px] text-textMuted">{tr("Automation")}</p><p className="mt-1 text-xl font-semibold text-text">{counts.automations}</p></Link><Link href="/ai-history" className="rounded-2xl border border-border bg-surface p-4"><ShieldCheck size={15} className="text-accent"/><p className="mt-3 text-[9px] text-textMuted">{tr("Undo AI")}</p><p className="mt-1 text-xl font-semibold text-text">{counts.actions}</p></Link><Link href="/settings" className="rounded-2xl border border-border bg-surface p-4"><Smartphone size={15} className="text-accent"/><p className="mt-3 text-[9px] text-textMuted">{tr("Push device")}</p><p className="mt-1 text-xl font-semibold text-text">{counts.subscriptions}</p></Link></section>

    <Card className="p-4 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-textMuted">{tr("Service health")}</p><div className="mt-1 flex items-center gap-2"><h2 className="font-display text-2xl text-text">{tr("Status sekarang")}</h2><StatusPill status={health?.ok ? "ok" : loading ? "loading" : "warn"} label={health?.ok ? tr("Sehat") : tr("Perlu perhatian")}/></div></div><div className="text-left sm:text-right"><p className="text-[9px] text-textMuted">{tr("Latency API")}</p><p className="mt-1 text-lg font-semibold text-text">{health?.latency_ms != null ? `${health.latency_ms} ms` : "—"}</p></div></div><div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{rows.map(r=>{const I=r.icon;return <div key={r.label} className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-bg/60 p-3"><span className="rounded-xl bg-accent/10 p-2 text-accent"><I size={15}/></span><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-text">{r.label}</p><p className="mt-0.5 break-words text-[10px] leading-relaxed text-textMuted">{r.detail}</p></div><StatusPill status={r.status} label={r.status === "ok" ? tr("OK") : r.status === "warn" ? tr("Periksa") : r.status === "loading" ? tr("Memuat") : tr("Gagal")}/></div>})}</div></Card>

    <FeatureCoverage />

    {diagnostics && diagnostics.healthScore !== undefined && <Card className="border-accent/15 bg-accent/5 p-4"><div className="flex items-center gap-3"><div className="h-12 w-12 shrink-0 rounded-full border-4 border-accent/20 p-1"><div className="flex h-full w-full items-center justify-center rounded-full bg-bg text-xs font-bold text-accent">{diagnostics.healthScore}%</div></div><div><p className="text-xs font-semibold text-text">{tr("Kesehatan sistem")}</p><p className="mt-1 text-[10px] text-textMuted">{tr("Score menggabungkan schema, worker, reminder, push, dan sinkronisasi.")}</p></div></div></Card>}

    {diagnostics && <Card className={`${diagnostics.ok ? "border-success/15 bg-success/5" : "border-danger/15 bg-danger/5"} p-4`}><div className="flex flex-col gap-3 sm:flex-row sm:items-start"><span className={`rounded-xl p-2.5 ${diagnostics.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}><Activity size={16}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-text">{tr("Mesin diagnostik")}</p><StatusPill status={diagnostics.ok ? "ok" : "error"} label={diagnostics.ok ? tr("Semua jalur sehat") : `${diagnostics.issues?.length || 0} masalah`}/></div><div className="mt-2 grid gap-2 text-[10px] text-textMuted sm:grid-cols-2 lg:grid-cols-4"><span>{tr("Worker:")} <b className="text-text">{diagnostics.worker?.status || "—"}</b></span><span>{tr("Overdue:")} <b className="text-text">{diagnostics.reminders?.overdue ?? 0}</b></span><span>{tr("Stuck:")} <b className="text-text">{diagnostics.reminders?.stuckProcessing ?? 0}</b></span><span>{tr("Orphan:")} <b className="text-text">{diagnostics.reminders?.orphaned ?? 0}</b></span></div>{diagnostics.issues?.length > 0 && <div className="mt-3 rounded-xl border border-danger/10 bg-surface p-3 text-[10px] leading-relaxed text-textMuted">{diagnostics.issues.slice(0,5).map((issue:string, i:number)=><p key={`${issue}-${i}`}>• {issue}</p>)}</div>}</div></div></Card>}

    {schemaReady === false && <Card className="border-danger/20 bg-danger/5 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start"><span className="rounded-xl bg-danger/10 p-2.5 text-danger"><Database size={16}/></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-text">{tr("Migration reminder belum lengkap")}</p><p className="mt-1 text-[10px] leading-relaxed text-textMuted">{tr("Pusat Sistem menemukan tabel yang belum tersedia:")} <span className="font-semibold text-text">{schemaMissing.join(", ")}</span>{tr(". Jalankan migration V31, V32, V33, V34, dan")} <span className="font-semibold text-text">supabase/schema_v35_ai_experience.sql</span> {tr("di Supabase SQL Editor, lalu tekan Segarkan.")}</p></div><Link href="/guide" className="shrink-0 rounded-xl bg-surface px-3 py-2 text-[10px] font-semibold text-textMuted hover:text-accent">{tr("Panduan")}</Link></div></Card>}

    <section className="grid gap-4 lg:grid-cols-2"><Card className="p-4 sm:p-5"><div className="flex items-start gap-3"><span className="rounded-2xl bg-accent/10 p-3 text-accent"><TestTube2 size={18}/></span><div className="min-w-0"><h2 className="text-sm font-semibold text-text">{tr("Tes dari perangkat ini")}</h2><p className="mt-1 text-[10px] leading-relaxed text-textMuted">{tr("Tes browser tidak membutuhkan VAPID. Ini jalur paling cepat untuk memastikan izin notifikasi perangkat berfungsi.")}</p></div></div><div className="mt-4 flex flex-wrap gap-2"><SoftButton onClick={()=>void browserTest()} disabled={testingBrowser}>{testingBrowser?<RefreshCw size={13} className="animate-spin"/>:<Bell size={13}/>} {tr("Tes browser")}</SoftButton><SoftButton onClick={()=>void createTestReminder()} disabled={creatingReminder}>{creatingReminder?<RefreshCw size={13} className="animate-spin"/>:<TimerReset size={13}/>} {tr("Reminder 1 menit")}</SoftButton></div><p className="mt-3 text-[9px] text-textMuted">{tr("Web Push perangkat:")} <span className="font-semibold text-text">{pushState === "subscribed" ? "aktif" : pushState === "unconfigured" ? tr("server belum siap") : pushState === "denied" ? "diblokir" : pushState}</span></p></Card>
      <Card className="p-4 sm:p-5"><div className="flex items-start gap-3"><span className="rounded-2xl bg-accent/10 p-3 text-accent"><Bell size={18}/></span><div className="min-w-0"><h2 className="text-sm font-semibold text-text">{tr("Tes Web Push")}</h2><p className="mt-1 text-[10px] leading-relaxed text-textMuted">{tr("Jalur ini membutuhkan HTTPS, VAPID, service-role, subscription perangkat, dan server yang siap mengirim push.")}</p></div></div><div className="mt-4 flex flex-wrap gap-2"><SoftButton onClick={()=>void pushTest()} disabled={testingPush || pushState !== "subscribed"}>{testingPush?<RefreshCw size={13} className="animate-spin"/>:<Bell size={13}/>} {tr("Kirim tes push")}</SoftButton><Link href="/settings" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2 text-[10px] font-semibold text-textMuted hover:text-accent">{tr("Atur perangkat")} <ExternalLink size={12}/></Link></div>{(!push?.sendReady || !push?.workerReady)&&<p className="mt-3 rounded-xl bg-accent/10 p-3 text-[9px] leading-relaxed text-accent">{!push?.sendReady ? tr("Server pengirim Web Push belum lengkap; periksa VAPID dan SUPABASE_SERVICE_ROLE_KEY.") : tr("Web Push server sudah siap, tetapi worker/cron reminder belum aktif. Reminder tetap tersimpan di server dan dapat tampil di Notification Center.")}</p>}</Card></section>

    <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]"><Card className="p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-textMuted">{tr("Reminder engine")}</p><h2 className="mt-1 font-display text-2xl text-text">{tr("Uji alur dari awal sampai akhir")}</h2></div><Link href="/reminders" className="text-xs font-semibold text-accent">{tr("Buka Pengingat →")}</Link></div><div className="mt-4 grid gap-2 sm:grid-cols-3"><div className="rounded-2xl bg-bg p-3"><p className="text-[9px] text-textMuted">{tr("1. Data")}</p><p className="mt-1 text-xs font-semibold text-text">{tr("Reminder tersimpan")}</p></div><div className="rounded-2xl bg-bg p-3"><p className="text-[9px] text-textMuted">{tr("2. Dispatch")}</p><p className="mt-1 text-xs font-semibold text-text">{tr("Engine memeriksa jatuh tempo")}</p></div><div className="rounded-2xl bg-bg p-3"><p className="text-[9px] text-textMuted">{tr("3. Delivery")}</p><p className="mt-1 text-xs font-semibold text-text">{tr("Browser event atau Web Push")}</p></div></div>{lastDispatch&&<div className="mt-3 rounded-2xl border border-accent/15 bg-accent/5 p-3 text-[10px] text-textMuted">{tr("Dispatch terakhir:")} <span className="font-semibold text-text">{lastDispatch.delivered ?? 0} {tr("terkirim")}</span> · {lastDispatch.waiting ?? 0} {tr("menunggu ·")} {lastDispatch.failed ?? 0} {tr("gagal.")}</div>}</Card>
      <Card className="p-4 sm:p-5"><div className="flex items-center justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-textMuted">{tr("Server setup")}</p><h2 className="mt-1 text-sm font-semibold text-text">{tr("Environment push")}</h2></div><button type="button" onClick={()=>void copySetup()} className="rounded-lg p-2 text-textMuted hover:bg-bg hover:text-accent" title={tr("Salin konfigurasi")}><Copy size={14}/></button></div><pre className="mt-3 overflow-x-auto rounded-xl bg-bg p-3 text-[9px] leading-relaxed text-textMuted">{setupText}</pre><p className="mt-3 text-[9px] leading-relaxed text-textMuted">{tr("Secret hanya di VPS. Jangan masukkan nilai sebenarnya ke Git atau ZIP.")}</p><div className="mt-3 flex flex-wrap gap-2"><Link href="/guide" className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-accent">{tr("Lihat Panduan")} <ArrowRight size={11}/></Link></div></Card></section>

    <Card className="border-accent/15 bg-accent/5 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-start gap-3"><span className="rounded-xl bg-accent/10 p-2.5 text-accent"><ShieldCheck size={16}/></span><div className="min-w-0"><p className="text-sm font-semibold text-text">{tr("Jalur aman")}</p><p className="mt-1 text-[10px] leading-relaxed text-textMuted">{tr("Browser test → Reminder test → Dispatch manual → Web Push test. Jalankan berurutan untuk mencari titik yang bermasalah.")}</p></div></div><Link href="/settings" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-surface px-3 py-2 text-[10px] font-semibold text-textMuted hover:text-accent">{tr("Pengaturan")} <ArrowRight size={12}/></Link></div></Card>

    <Card id="conflicts" className="scroll-mt-24 p-4 sm:p-5"><div className="mb-3"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-textMuted">{tr("Sinkronisasi")}</p><h2 className="mt-1 font-display text-2xl text-text">{tr("Konflik perubahan")}</h2><p className="mt-1 text-xs text-textMuted">{tr("Pilih versi server, versi perangkat, atau gabungkan field yang aman.")}</p></div><ConflictCenter /></Card>
    <Card className="border-accent/15 bg-accent/5 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-text">{tr("Pusat sinkronisasi lengkap")}</p><p className="mt-1 text-[10px] text-textMuted">{tr("Pantau perangkat, antrean offline, cursor, dan pemulihan sinkronisasi.")}</p></div><Link href="/sync" className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-[10px] font-semibold text-white">{tr("Buka Pusat Sinkronisasi")} <ArrowRight size={12}/></Link></div></Card>

  </div>;
}
