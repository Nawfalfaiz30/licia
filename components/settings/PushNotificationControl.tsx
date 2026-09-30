"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, CheckCircle2, RefreshCw, Send } from "lucide-react";
import { getPushStatus, subscribeToLiciaPush, unsubscribeFromLiciaPush, requestBrowserNotifications, disableBrowserNotifications, type PushClientState } from "@/lib/notifications/client";
import { SoftButton, notifyToast } from "@/components/ui";

export function PushNotificationControl() {
  const [state, setState] = useState<PushClientState>("permission");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [browserEnabled, setBrowserEnabled] = useState(false);
  const [serverStatus, setServerStatus] = useState<{enabled:boolean;missing:string[]}>({enabled:false,missing:[]});

  async function refresh() {
    const [nextState, config] = await Promise.all([getPushStatus(), fetch("/api/push/vapid-public", { cache: "no-store" }).then(async r => r.ok ? r.json() : ({})).catch(() => ({}))]);
    setState(nextState);
    setServerStatus({ enabled: Boolean(config?.enabled), missing: Array.isArray(config?.missing) ? config.missing : [] });
    try { setBrowserEnabled(localStorage.getItem("licia-browser-notifications") === "true"); } catch {}
  }
  useEffect(() => {
    void refresh();
    const handler = () => void refresh();
    window.addEventListener("licia:push-status-change", handler);
    return () => window.removeEventListener("licia:push-status-change", handler);
  }, []);

  async function enable() {
    setBusy(true);
    const result = await subscribeToLiciaPush();
    setBusy(false);
    setState(result.state);
    if (result.ok) {
      try { localStorage.setItem("licia-browser-notifications", "true"); setBrowserEnabled(true); } catch {}
      notifyToast({ title: "Notifikasi aktif", message: "Licia sekarang dapat mengirim pengingat ke perangkat ini.", tone: "success" });
    } else {
      notifyToast({ title: "Notifikasi belum aktif", message: result.error || "Periksa izin browser dan konfigurasi push server.", tone: "error" });
    }
  }
  async function disable() { setBusy(true); const result = await unsubscribeFromLiciaPush(); setBusy(false); await refresh(); if (!result.ok) notifyToast({ title: "Gagal mematikan push", message: result.error, tone: "error" }); }
  async function toggleBrowser() { if (browserEnabled) { disableBrowserNotifications(); setBrowserEnabled(false); return; } const result = await requestBrowserNotifications(); if (!result.ok) notifyToast({ title: "Notifikasi browser belum aktif", message: result.error || "Izin belum diberikan.", tone: "error" }); else { setBrowserEnabled(true); notifyToast({ title: "Notifikasi browser aktif", message: "Licia dapat menampilkan notifikasi saat web sedang terbuka.", tone: "success" }); } }
  async function test() { setTesting(true); try { const res = await fetch("/api/push/test", { method: "POST" }); const data = await res.json().catch(() => ({})); if (!res.ok || !data.ok) { if (data?.repairable) { const repair = await subscribeToLiciaPush({ forceRenew: true }); await refresh(); if (repair.ok) { const retry = await fetch("/api/push/test", { method: "POST" }); const retryData = await retry.json().catch(() => ({})); if (retry.ok && retryData.ok) { notifyToast({ title: "Push diperbaiki", message: "Subscription perangkat diperbarui dan tes berhasil dikirim.", tone: "success" }); return; } } } throw new Error(data.error || "Notifikasi test belum terkirim."); } notifyToast({ title: "Tes berhasil", message: "Periksa notifikasi perangkat Anda.", tone: "success" }); } catch (error) { notifyToast({ title: "Tes gagal", message: error instanceof Error ? error.message : "Push belum berhasil dikirim.", tone: "error" }); } finally { setTesting(false); } }

  const text = state === "subscribed" ? "Terhubung ke perangkat ini" : state === "error" ? "Perlu diperbaiki" : state === "denied" ? "Diblokir browser" : state === "unconfigured" ? "Server push belum disiapkan" : state === "unsupported" ? "Browser tidak mendukung" : "Belum aktif";
  return <div className="rounded-2xl border border-border bg-bg/65 p-4">
    <div className="flex items-start gap-3"><span className="rounded-xl bg-accent/10 p-2.5 text-accent">{state === "subscribed" ? <CheckCircle2 size={17}/> : <Bell size={17}/>}</span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-text">Notifikasi perangkat</p><p className="mt-1 text-[10px] leading-relaxed text-textMuted">{text}. Pengingat agenda dan reminder tetap tersimpan di Pusat Notifikasi.</p></div><button type="button" onClick={()=>void refresh()} className="rounded-lg p-2 text-textMuted hover:bg-surface hover:text-accent" aria-label="Segarkan status"><RefreshCw size={14}/></button></div>
    <div className="mt-3 flex flex-wrap gap-2">{state !== "subscribed" && state !== "unsupported" && state !== "denied" && <SoftButton onClick={()=>void enable()} disabled={busy}>{busy?<RefreshCw size={13} className="animate-spin"/>:<Bell size={13}/>} {busy?"Menghubungkan…":"Aktifkan push"}</SoftButton>}{state === "subscribed" && <><SoftButton onClick={()=>void test()} disabled={testing}>{testing?<RefreshCw size={13} className="animate-spin"/>:<Send size={13}/>} {testing?"Mengirim…":"Kirim tes"}</SoftButton><SoftButton onClick={()=>void disable()}><BellOff size={13}/> Matikan perangkat ini</SoftButton></>}<SoftButton onClick={()=>void toggleBrowser()}><Bell size={13}/> {browserEnabled?"Browser: aktif":"Browser: aktifkan"}</SoftButton></div>
    <div className="mt-3 rounded-xl border border-border bg-surface/60 p-3"><div className="grid gap-2 sm:grid-cols-3"><div><p className="text-[8px] uppercase tracking-wider text-textMuted">VAPID</p><p className={serverStatus.missing.some(x=>x.startsWith("VAPID_"))?"text-[10px] font-semibold text-warning":"text-[10px] font-semibold text-success"}>{serverStatus.missing.some(x=>x.startsWith("VAPID_"))?"Belum lengkap":"Siap"}</p></div><div><p className="text-[8px] uppercase tracking-wider text-textMuted">Service role</p><p className={serverStatus.missing.includes("SUPABASE_SERVICE_ROLE_KEY")?"text-[10px] font-semibold text-warning":"text-[10px] font-semibold text-success"}>{serverStatus.missing.includes("SUPABASE_SERVICE_ROLE_KEY")?"Belum ada":"Siap"}</p></div><div><p className="text-[8px] uppercase tracking-wider text-textMuted">Worker auth</p><p className={serverStatus.missing.includes("LICIA_CRON_SECRET")?"text-[10px] font-semibold text-warning":"text-[10px] font-semibold text-success"}>{serverStatus.missing.includes("LICIA_CRON_SECRET")?"Belum ada":"Siap"}</p></div></div>{!serverStatus.enabled&&serverStatus.missing.length>0&&<p className="mt-2 break-words text-[9px] leading-relaxed text-textMuted">Server belum siap: {serverStatus.missing.join(", ")}. Jalankan <code>npm run setup:push</code> di VPS, isi service-role, lalu restart worker.</p>}</div>
    {state === "denied" && <p className="mt-2 text-[9px] leading-relaxed text-textMuted">Ubah izin Notifications dari pengaturan browser untuk mengaktifkannya kembali.</p>}
  </div>;
}
