"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, Database, Download, Monitor, Palette, Save, ShieldCheck, Smartphone, Sparkles, UserRound, Wand2 } from "lucide-react";
import { clsx } from "clsx";
import { createClient } from "@/lib/supabase/client";
import { Card, PrimaryButton, SoftButton, TextInput, notifyToast } from "@/components/ui";
import { PushNotificationControl } from "@/components/settings/PushNotificationControl";
import { MobileAccountAction } from "@/components/layout/MobileAccountAction";
import { TIMEZONE_OPTIONS } from "@/lib/date";
import { accentPresets, applyAccent, applyBackground, applyFont, BG_DEFAULT_DARK, BG_DEFAULT_LIGHT, bgPresetsDark, bgPresetsLight, fontPresets, getStoredFont, ACCENT_STORAGE_KEY, BG_DARK_STORAGE_KEY, BG_LIGHT_STORAGE_KEY, FONT_DEFAULT } from "@/lib/theme";
import { DataExportButton } from "@/components/settings/DataExportButton";
import { DataBackupButton } from "@/components/settings/DataBackupButton";
import { applyLanguage, resolveLanguage, type Language } from "@/lib/i18n";
import { ThemeModeControl } from "@/components/settings/ThemeModeControl";
import type { ThemeMode } from "@/lib/theme";
import { useLanguage } from "@/components/LanguageProvider";

type SettingsState = {
  theme: ThemeMode;
  language: Language;
  name: string;
  timezone: string;
  startPage: string;
  density: string;
  textScale: string;
  defaultAiMode: string;
  aiResponseStyle: string;
  aiReadAllData: boolean;
  aiAutoLink: boolean;
  aiProactive: boolean;
  aiSuggestActions: boolean;
  aiConfirmDestructive: boolean;
  aiConfirmMassive: boolean;
  aiDomainPermissions: Record<string, boolean>;
  confirmDelete: boolean;
  confirmBulkActions: boolean;
  browserNotifications: boolean;
  notificationLeadDays: number;
  reducedMotion: boolean;
  haptics: boolean;
  offlineCapture: boolean;
  syncEnabled: boolean;
  syncIntervalSeconds: number;
  conflictStrategy: string;
  compactSidebar: boolean;
  chatEnterToSend: boolean;
};

const DEFAULTS: SettingsState = {
  theme: "system", language: "id", name: "", timezone: "Asia/Jakarta", startPage: "dashboard", density: "comfortable", textScale: "normal",
  defaultAiMode: "assistant", aiResponseStyle: "normal",
  aiReadAllData: false, aiAutoLink: true, aiProactive: true, aiSuggestActions: true, aiConfirmDestructive: true, aiConfirmMassive: true,
  aiDomainPermissions: { tasks: true, calendar: true, goals: true, projects: true, notes: true, memory: true, finance: false, health: false, vault: false, learning: true, reading: true, habits: true },
  confirmDelete: true, confirmBulkActions: true, browserNotifications: false, notificationLeadDays: 7, reducedMotion: false, haptics: true,
  offlineCapture: true, syncEnabled: true, syncIntervalSeconds: 15, conflictStrategy: "server", compactSidebar: false, chatEnterToSend: true,
};

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: () => void }) {
  return <button type="button" onClick={onChange} className={clsx("flex min-w-0 items-center justify-between gap-3 rounded-2xl border p-3 text-left", checked ? "border-accent/25 bg-accent/5" : "border-border bg-bg hover:border-accent/15")}><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-text">{label}</span>{hint && <span className="mt-1 block text-[10px] leading-relaxed text-textMuted">{hint}</span>}</span><span className={clsx("relative h-6 w-11 shrink-0 rounded-full p-0.5", checked ? "bg-accent" : "bg-border")}><span className={clsx("block h-5 w-5 rounded-full bg-white shadow-sm transition", checked ? "translate-x-5" : "translate-x-0")} /></span></button>;
}

const sections = [
  { id: "appearance", label: "Tampilan" },
  { id: "workspace", label: "Workspace" },
  { id: "ai", label: "AI & Privasi" },
  { id: "behavior", label: "Interaksi" },
  { id: "sync", label: "Perangkat & Notifikasi" },
  { id: "data", label: "Data & Akun" },
] as const;

type SectionId = typeof sections[number]["id"];

function normalizeStartPage(value: unknown) {
  const v = String(value || "dashboard");
  const map: Record<string, string> = { goals: "dashboard", projects: "dashboard", health: "wellbeing", habits: "wellbeing", learning: "knowledge", notes: "knowledge", memory: "knowledge", vault: "knowledge", reading: "knowledge", subscriptions: "finance", copilot: "chat", command: "chat", pulse: "insights", review: "insights", review_center: "insights", analytics: "insights", timeline: "insights", planner: "plan", inbox: "capture", reminders: "plan", automations: "insights" };
  return map[v] || (v === "dashboard" || v === "plan" || v === "chat" || v === "capture" || v === "insights" ? v : "dashboard");
}

export default function SettingsPage() {
  const { tr } = useLanguage();
  const supabase = createClient();
  const [section, setSection] = useState<SectionId>("appearance");
  const [state, setState] = useState<SettingsState>(DEFAULTS);
  const [legacy, setLegacy] = useState<Record<string, unknown>>({});
  const [accent, setAccent] = useState("#3d5fd9");
  const [font, setFont] = useState(FONT_DEFAULT);
  const [background, setBackground] = useState(BG_DEFAULT_LIGHT);
  const [dark, setDark] = useState(false);
  const [saving, setSaving] = useState(false);
  const [health, setHealth] = useState<any>(null);
  const [healthBusy, setHealthBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    setDark(root.classList.contains("dark"));
    setAccent(localStorage.getItem(ACCENT_STORAGE_KEY) || "#3d5fd9");
    setFont(getStoredFont());
    setBackground(localStorage.getItem(root.classList.contains("dark") ? BG_DARK_STORAGE_KEY : BG_LIGHT_STORAGE_KEY) || (root.classList.contains("dark") ? BG_DEFAULT_DARK : BG_DEFAULT_LIGHT));
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("users").select("display_name,timezone,preferences").eq("id", user.id).maybeSingle();
      const prefs = ((data?.preferences || {}) as Record<string, unknown>);
      setLegacy(prefs);
      setState({
        ...DEFAULTS,
        theme: (["light", "dark", "system"].includes(String(localStorage.getItem("licia-theme") || prefs.theme)) ? String(localStorage.getItem("licia-theme") || prefs.theme) : "system") as ThemeMode,
        name: String(data?.display_name || ""),
        timezone: String(data?.timezone || "Asia/Jakarta"),
        language: resolveLanguage(prefs.language),
        startPage: normalizeStartPage(prefs.startPage),
        density: String(prefs.density || DEFAULTS.density),
        textScale: String(prefs.textScale || DEFAULTS.textScale),
        defaultAiMode: String(prefs.defaultAiMode || DEFAULTS.defaultAiMode),
        aiResponseStyle: String(prefs.aiResponseStyle || DEFAULTS.aiResponseStyle),
        aiReadAllData: prefs.aiReadAllData === true,
        aiAutoLink: prefs.aiAutoLink !== false,
        aiProactive: prefs.aiProactive !== false,
        aiSuggestActions: prefs.aiSuggestActions !== false,
        aiConfirmDestructive: prefs.aiConfirmDestructive !== false,
        aiConfirmMassive: prefs.aiConfirmMassive !== false,
        aiDomainPermissions: { ...DEFAULTS.aiDomainPermissions, ...(typeof prefs.aiDomainPermissions === "object" && prefs.aiDomainPermissions ? prefs.aiDomainPermissions as Record<string, boolean> : {}) },
        confirmDelete: prefs.confirmDelete !== false,
        confirmBulkActions: prefs.confirmBulkActions !== false,
        browserNotifications: prefs.browserNotifications === true,
        notificationLeadDays: Number(prefs.notificationLeadDays || 7),
        reducedMotion: prefs.reducedMotion === true,
        haptics: prefs.haptics !== false,
        offlineCapture: prefs.offlineCapture !== false,
        syncEnabled: prefs.syncEnabled !== false,
        syncIntervalSeconds: Number(prefs.syncIntervalSeconds || 15),
        conflictStrategy: String(prefs.conflictStrategy || "server"),
        compactSidebar: prefs.compactSidebar === true,
        chatEnterToSend: prefs.chatEnterToSend !== false,
      });
      setLoaded(true);
    })();
  }, []);

  const bgOptions = dark ? bgPresetsDark : bgPresetsLight;
  const update = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => setState((s) => ({ ...s, [key]: value }));
  const toggle = (key: keyof SettingsState) => setState((s) => ({ ...s, [key]: !s[key] } as SettingsState));

  async function save() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(tr("Belum masuk."));
      const next = { ...legacy, ...state, aiContextMode: state.aiReadAllData ? "all" : "smart" };
      const { name, timezone, ...prefs } = next;
      const { error } = await supabase.from("users").upsert({ id: user.id, display_name: name, timezone, preferences: prefs });
      if (error) throw new Error(error.message);
      localStorage.setItem("licia-theme", state.theme);
      localStorage.setItem("licia-language", state.language);
      localStorage.setItem("licia-density", state.density);
      localStorage.setItem("licia-reduced-motion", String(state.reducedMotion));
      localStorage.setItem("licia-default-ai-mode", state.defaultAiMode);
      localStorage.setItem("licia-ai-response-style", state.aiResponseStyle);
      localStorage.setItem("licia-ai-read-all-data", String(state.aiReadAllData));
      localStorage.setItem("licia-ai-confirm-destructive", String(state.aiConfirmDestructive));
      localStorage.setItem("licia-ai-confirm-massive", String(state.aiConfirmMassive));
      localStorage.setItem("licia-haptics", String(state.haptics));
      localStorage.setItem("licia-sync-enabled", String(state.syncEnabled));
      localStorage.setItem("licia-sync-interval-seconds", String(state.syncIntervalSeconds));
      localStorage.setItem("licia-conflict-strategy", state.conflictStrategy);
      localStorage.setItem("licia-chat-enter-to-send", String(state.chatEnterToSend));
      const canonicalPermissions = {
        planning: state.aiDomainPermissions.tasks !== false && state.aiDomainPermissions.calendar !== false,
        goals_projects: state.aiDomainPermissions.goals !== false && state.aiDomainPermissions.projects !== false,
        knowledge: ["notes","memory","vault","learning","reading"].every((key) => state.aiDomainPermissions[key] !== false),
        finance: state.aiDomainPermissions.finance !== false,
        wellbeing: state.aiDomainPermissions.health !== false && state.aiDomainPermissions.habits !== false,
        automation: true,
      };
      localStorage.setItem("licia-ai-workspace-permissions", JSON.stringify(canonicalPermissions));
      window.dispatchEvent(new CustomEvent("licia:preferences-change", { detail: { chatEnterToSend: state.chatEnterToSend } }));
      applyLanguage(state.language);
      notifyToast({ title: tr("Pengaturan tersimpan"), message: tr("Perubahan Licia sudah diterapkan."), tone: "success" });
    } catch (error) {
      notifyToast({ title: tr("Pengaturan gagal disimpan"), message: error instanceof Error ? error.message : tr("Coba lagi."), tone: "error" });
    } finally { setSaving(false); }
  }

  async function checkHealth() {
    setHealthBusy(true);
    try { const res = await fetch("/api/health", { cache: "no-store" }); setHealth(await res.json()); }
    catch (error) { setHealth({ ok: false, database: false, user: false, error: error instanceof Error ? error.message : tr("Tidak dapat terhubung") }); }
    finally { setHealthBusy(false); }
  }

  const privacyGroups = useMemo(() => [
    { id: "plan", label: tr("Rencana"), keys: ["tasks", "calendar"], hint: tr("Tugas, kalender, agenda, fokus, dan pengingat terkait pekerjaan.") },
    { id: "goals", label: tr("Target & Proyek"), keys: ["goals", "projects"], hint: tr("Tujuan, proyek, dan hubungan pekerjaan.") },
    { id: "knowledge", label: tr("Knowledge & Belajar"), keys: ["notes", "memory", "vault", "reading", "learning"], hint: tr("Catatan, memory, dokumen, bacaan, dan pembelajaran.") },
    { id: "finance", label: tr("Keuangan"), keys: ["finance"], hint: tr("Transaksi, anggaran, dompet, dan langganan.") },
    { id: "wellbeing", label: tr("Kesehatan & Rutinitas"), keys: ["health", "habits"], hint: tr("Data kesehatan, aktivitas, tidur, nutrisi, dan rutinitas.") },
      ], []);
  function applyAiPreset(preset: "focus" | "balanced" | "proactive") {
    if (preset === "focus") {
      setState((current) => ({ ...current, defaultAiMode: "assistant", aiResponseStyle: "concise", aiReadAllData: false, aiAutoLink: false, aiProactive: false, aiSuggestActions: true }));
    } else if (preset === "proactive") {
      setState((current) => ({ ...current, defaultAiMode: "operator", aiResponseStyle: "normal", aiReadAllData: false, aiAutoLink: true, aiProactive: true, aiSuggestActions: true }));
    } else {
      setState((current) => ({ ...current, defaultAiMode: "assistant", aiResponseStyle: "normal", aiReadAllData: false, aiAutoLink: true, aiProactive: true, aiSuggestActions: true }));
    }
  }

  if (!loaded) return <div className="space-y-4"><div className="h-28 animate-pulse rounded-[2rem] bg-surface" /><div className="h-72 animate-pulse rounded-2xl bg-surface" /></div>;

  return <div className="space-y-5">
    <section className="relative overflow-hidden rounded-[2rem] border border-accent/15 bg-surface p-5 shadow-sm sm:p-7">
      <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-accent">{tr("Pengaturan utama")}</p><h1 className="mt-2 font-display text-3xl text-text sm:text-4xl">{tr("Atur Licia sesuai caramu")}</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-textMuted">{tr("Pilih yang penting. Licia menyesuaikan sisanya.")}</p></div>
        <PrimaryButton onClick={() => void save()} disabled={saving}><Save size={15}/>{saving ? tr("Menyimpan…") : tr("Simpan perubahan")}</PrimaryButton>
      </div>
    </section>

    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">{sections.map((x) => <button key={x.id} onClick={() => setSection(x.id)} className={clsx("shrink-0 rounded-xl border px-3.5 py-2 text-xs font-semibold transition", section === x.id ? "border-accent/25 bg-accent/10 text-accent" : "border-border bg-surface text-textMuted hover:text-text")}>{tr(x.label)}</button>)}</div>

    {section === "appearance" && <div className="space-y-4">
      <Card className="p-4 sm:p-5"><div className="flex items-center gap-2"><Palette size={17} className="text-accent"/><h2 className="font-display text-xl text-text">{tr("Identitas & tampilan")}</h2></div><div className="mt-4 grid gap-4 md:grid-cols-2"><label><span className="text-[10px] font-bold uppercase tracking-[.08em] text-textMuted">{tr("Nama panggilan")}</span><TextInput value={state.name} onChange={(e) => update("name", e.target.value)} className="mt-2" placeholder={tr("Nama yang dipakai Licia")} /></label><label><span className="text-[10px] font-bold uppercase tracking-[.08em] text-textMuted">{tr("Zona waktu")}</span><select value={state.timezone} onChange={(e) => update("timezone", e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-text">{TIMEZONE_OPTIONS.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}</select></label></div></Card>
      <Card className="p-4 sm:p-5"><div className="flex items-center gap-2"><div className="grid h-9 w-9 place-items-center rounded-xl bg-accent/10 text-accent"><Monitor size={17}/></div><div><p className="text-sm font-semibold text-text">{tr("Mode tampilan")}</p><p className="mt-1 text-[10px] text-textMuted">{tr("Pilih terang, gelap, atau ikuti pengaturan perangkat.")}</p></div></div><div className="mt-4"><ThemeModeControl value={state.theme} onChange={(value) => { update("theme", value); setDark(value === "dark" || (value === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)); }} /></div></Card>
      <Card className="p-4 sm:p-5"><div className="flex items-center gap-2"><span className="rounded-xl bg-accent/10 px-2.5 py-2 text-accent text-[11px] font-bold">{tr("Aa")}</span><div><p className="text-sm font-semibold text-text">{tr("Bahasa")}</p><p className="mt-1 text-[10px] text-textMuted">{tr("Pilih bahasa antarmuka yang paling nyaman.")}</p></div></div><select aria-label={tr("Bahasa antarmuka")} value={state.language} onChange={(e) => update("language", e.target.value as Language)} className="mt-4 min-h-11 w-full rounded-xl border border-border bg-bg px-3 text-sm text-text"><option value="id">{tr("Bahasa Indonesia")}</option><option value="en">{tr("English")}</option></select></Card>
      <Card className="p-4 sm:p-5"><p className="text-sm font-semibold text-text">{tr("Font")}</p><p className="mt-1 text-xs text-textMuted">{tr("Pilihan font tetap tersedia sebagai bagian dari identitas Licia.")}</p><div className="mt-4"><label htmlFor="font-select" className="mb-2 block text-[10px] font-bold uppercase tracking-[.08em] text-textMuted">{tr("Pilihan font")}</label><select id="font-select" value={font} onChange={(e) => { setFont(e.target.value); applyFont(e.target.value); }} className="min-h-11 w-full rounded-xl border border-border bg-bg px-3 text-sm text-text">{fontPresets.map((x) => <option key={x.cssVar} value={x.cssVar}>{x.name} · {x.mood}</option>)}</select><p className="mt-2 text-center text-xl text-text" style={{ fontFamily: `var(${font})` }}>Aa</p></div></Card>
      <div className="grid gap-4 lg:grid-cols-3"><Card className="p-4"><p className="text-sm font-semibold text-text">{tr("Aksen")}</p><div className="mt-3 flex flex-wrap gap-2">{accentPresets.map((x) => <button key={x.hex} aria-label={tr(x.name)} onClick={() => { setAccent(x.hex); applyAccent(x.hex); }} className={clsx("h-9 w-9 rounded-full border-2", accent.toLowerCase() === x.hex.toLowerCase() ? "border-text" : "border-transparent")} style={{ backgroundColor: x.hex }} />)}</div></Card><Card className="p-4"><p className="text-sm font-semibold text-text">{tr("Latar")}</p><div className="mt-3 flex flex-wrap gap-2">{bgOptions.map((x) => <button key={x.hex} type="button" aria-label={tr(x.name)} title={tr(x.name)} onClick={() => { setBackground(x.hex); applyBackground(x.hex); }} className={clsx("h-9 w-9 rounded-full border-2", background.toLowerCase() === x.hex.toLowerCase() ? "border-text" : "border-border")} style={{ backgroundColor: x.hex }} />)}</div></Card><Card className="p-4"><p className="text-sm font-semibold text-text">{tr("Kepadatan")}</p><div className="mt-3 grid grid-cols-3 gap-2">{["comfortable", "compact", "spacious"].map((x) => <button key={x} onClick={() => update("density", x)} className={clsx("rounded-xl border px-2 py-2 text-[10px] font-semibold capitalize", state.density === x ? "border-accent/25 bg-accent/10 text-accent" : "border-border text-textMuted")}>{x}</button>)}</div></Card></div>
    </div>}

    {section === "workspace" && <div className="space-y-4">
      <Card className="border-accent/15 bg-accent/5 p-4 sm:p-5"><div className="flex items-start gap-3"><span className="rounded-2xl bg-accent/10 p-3 text-accent"><Sparkles size={18}/></span><div><h2 className="font-display text-xl text-text">{tr("Ruang kerja Licia")}</h2><p className="mt-1 text-xs leading-relaxed text-textMuted">{tr("Desktop dan ponsel memakai susunan yang sama. Setiap pilihan di bawah langsung membuka ruang kerja yang sesuai, tanpa menu ganda.")}</p></div></div></Card>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[
          ["Beranda", "Agenda hari ini, keuangan, target & proyek, dan sinyal penting.", "/dashboard"],
          ["Rencana", "Tugas, Kalender, Fokus, Perencana, Inbox, dan Pengingat.", "/plan"],
          ["Chat Licia", "Percakapan, pertanyaan, analisis, dan aksi berbasis konteks.", "/chat"],
          ["Tangkap", "Simpan teks atau gambar dengan cepat tanpa berpindah-pindah menu.", "/capture"],
          ["Insights", "Review, pola, relasi, aktivitas, dan otomasi.", "/insights"],
          ["Target & Proyek", "Kelola target dan proyek dari satu ruang yang saling terhubung.", "/goals-projects"],
          ["Knowledge & Belajar", "Catatan, memory, vault, bacaan, dan pembelajaran.", "/knowledge"],
          ["Keuangan", "Transaksi, anggaran, saldo, dan langganan dalam satu tempat.", "/finance"],
          ["Kesehatan & Rutinitas", "Kesehatan, aktivitas, tidur, nutrisi, dan rutinitas.", "/wellbeing"],
        ].map(([title, detail, href]) => <Link key={title} href={href} className="group rounded-2xl border border-border bg-surface p-4 transition hover:-translate-y-0.5 hover:border-accent/25 hover:bg-accent/[.03]"><div className="flex items-center gap-2"><p className="text-sm font-semibold text-text">{title}</p><span className="ml-auto text-accent opacity-0 transition group-hover:opacity-100">→</span></div><p className="mt-1 text-[10px] leading-relaxed text-textMuted">{detail}</p></Link>)}
      </div>
      <Card className="p-4 sm:p-5"><p className="text-sm font-semibold text-text">{tr("Di ponsel: Lainnya")}</p><p className="mt-1 text-[10px] leading-relaxed text-textMuted">{tr("Tombol Lainnya menampilkan workspace utama dan subfitur yang benar-benar masih tersedia. Fitur yang sudah digabung tidak dibuat sebagai pilihan kedua.")}</p><div className="mt-3 flex flex-wrap gap-1.5">{["Target & Proyek","Knowledge & Belajar","Keuangan + Langganan","Kesehatan & Rutinitas","Peta & Relasi","Review & Pola","Otomasi"].map((label)=><span key={label} className="rounded-full border border-border bg-bg px-2 py-1 text-[9px] font-semibold text-textMuted">{label}</span>)}</div></Card>
    </div>}

    <div id="ai" />{section === "ai" && <div className="space-y-4">
      <Card className="border-accent/15 bg-accent/5 p-4 sm:p-5"><div className="flex items-start gap-3"><span className="rounded-2xl bg-accent/10 p-3 text-accent"><Sparkles size={18}/></span><div><h2 className="font-display text-xl text-text">{tr("AI lebih pintar, bukan lebih ramai")}</h2><p className="mt-1 text-xs leading-relaxed text-textMuted">{tr("Secara default Licia memakai context bertingkat. Context lintas Life OS dipakai saat memang diperlukan, sedangkan workspace gabungan tetap menjadi sumber utama agar AI tidak membaca data yang tidak relevan.")}</p></div></div><div className="mt-4 grid gap-2 md:grid-cols-2"><Toggle label={tr("Baca konteks lintas ruang kerja")} hint={tr("Aktifkan hanya untuk percakapan yang memang membutuhkan konteks banyak domain. Domain sensitif tetap mengikuti izin per-domain.")} checked={state.aiReadAllData} onChange={() => toggle("aiReadAllData")} /><Toggle label={tr("Hubungkan informasi secara otomatis")} checked={state.aiAutoLink} onChange={() => toggle("aiAutoLink")} /><Toggle label={tr("Beri saran saat memang membantu")} checked={state.aiProactive} onChange={() => toggle("aiProactive")} /><Toggle label={tr("Jalankan permintaan yang jelas")} checked={state.aiSuggestActions} onChange={() => toggle("aiSuggestActions")} /><Toggle label={tr("Tanya dulu sebelum menghapus")} checked={state.aiConfirmDestructive} onChange={() => toggle("aiConfirmDestructive")} /><Toggle label={tr("Tanya dulu untuk perubahan banyak data")} checked={state.aiConfirmMassive} onChange={() => toggle("aiConfirmMassive")} /></div></Card>
      <Card className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-text">{tr("Cara Licia bekerja")}</p><p className="mt-1 text-[10px] leading-relaxed text-textMuted">{tr("Pilih gaya yang paling cocok. Detailnya bisa kamu ubah lagi kapan saja.")}</p></div><Wand2 size={17} className="mt-0.5 text-accent"/></div><div className="mt-4 grid gap-2 md:grid-cols-3"><button type="button" onClick={() => applyAiPreset("focus")} className="rounded-2xl border border-border bg-bg p-3 text-left transition hover:border-accent/25"><p className="text-xs font-semibold text-text">{tr("Fokus")}</p><p className="mt-1 text-[10px] text-textMuted">{tr("Ringkas dan minim saran tambahan.")}</p></button><button type="button" onClick={() => applyAiPreset("balanced")} className="rounded-2xl border border-accent/20 bg-accent/5 p-3 text-left transition hover:border-accent/30"><p className="text-xs font-semibold text-text">{tr("Seimbang")}</p><p className="mt-1 text-[10px] text-textMuted">{tr("Mode nyaman untuk pemakaian harian.")}</p></button><button type="button" onClick={() => applyAiPreset("proactive")} className="rounded-2xl border border-border bg-bg p-3 text-left transition hover:border-accent/25"><p className="text-xs font-semibold text-text">{tr("Proaktif")}</p><p className="mt-1 text-[10px] text-textMuted">{tr("Lebih sigap menawarkan aksi yang relevan.")}</p></button></div></Card>
      <Card className="p-4 sm:p-5"><h2 className="font-display text-xl text-text">{tr("Data yang boleh dibantu Licia")}</h2><p className="mt-1 text-xs leading-relaxed text-textMuted">{tr("Pilih bagian kehidupan yang boleh dibaca dan dibantu Licia. Kamu tetap bisa membatasi area tertentu kapan saja.")}</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{privacyGroups.map((group) => { const checked = group.keys.every((key) => state.aiDomainPermissions[key] !== false); return <Toggle key={group.id} label={group.label} hint={group.hint} checked={checked} onChange={() => update("aiDomainPermissions", { ...state.aiDomainPermissions, ...Object.fromEntries(group.keys.map((key) => [key, checked ? false : true])) })} />; })}</div></Card>
      <Card className="p-4 sm:p-5"><div className="grid gap-4 sm:grid-cols-2"><label><span className="text-[10px] font-bold uppercase tracking-[.08em] text-textMuted">{tr("Mode default")}</span><select value={state.defaultAiMode} onChange={(e) => update("defaultAiMode", e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-text"><option value="assistant">{tr("Assistant")}</option><option value="planner">{tr("Planner")}</option><option value="analyst">{tr("Analyst")}</option><option value="operator">{tr("Operator")}</option><option value="reflector">{tr("Reflector")}</option></select></label><label><span className="text-[10px] font-bold uppercase tracking-[.08em] text-textMuted">{tr("Gaya jawaban")}</span><select value={state.aiResponseStyle} onChange={(e) => update("aiResponseStyle", e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-text"><option value="concise">{tr("Ringkas")}</option><option value="normal">{tr("Normal")}</option><option value="detailed">{tr("Detail")}</option></select></label></div></Card>
    </div>}

    {section === "behavior" && <div className="space-y-4"><Card className="p-4 sm:p-5"><div className="grid gap-4 sm:grid-cols-2"><label><span className="text-[10px] font-bold uppercase tracking-[.08em] text-textMuted">{tr("Halaman awal")}</span><select value={state.startPage} onChange={(e) => update("startPage", e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-text"><option value="dashboard">{tr("Beranda")}</option><option value="plan">{tr("Rencana")}</option><option value="chat">{tr("Chat Licia")}</option><option value="capture">{tr("Tangkap")}</option><option value="insights">{tr("Insights")}</option></select></label><div className="rounded-2xl border border-border bg-bg p-3"><p className="text-xs font-semibold text-text">{tr("Licia mengatur default secara otomatis")}</p><p className="mt-1 text-[10px] leading-relaxed text-textMuted">{tr("Prioritas, durasi fokus, dan waktu reminder ditentukan berdasarkan konteks aksi, tanpa menambah menu pengaturan khusus untuk hal tersebut.")}</p></div></div></Card><div className="grid gap-2 md:grid-cols-2"><Toggle label={tr("Konfirmasi sebelum menghapus")} checked={state.confirmDelete} onChange={() => toggle("confirmDelete")} /><Toggle label={tr("Tanya dulu untuk perubahan banyak data")} checked={state.confirmBulkActions} onChange={() => toggle("confirmBulkActions")} /><Toggle label={tr("Getaran / haptic")} checked={state.haptics} onChange={() => toggle("haptics")} /><Toggle label={tr("Kurangi animasi")} checked={state.reducedMotion} onChange={() => toggle("reducedMotion")} /><Toggle label={tr("Sidebar ringkas")} checked={state.compactSidebar} onChange={() => toggle("compactSidebar")} /><Toggle label={tr("Enter langsung mengirim chat")} hint={tr("Matikan jika lebih nyaman memakai Enter untuk baris baru dan Ctrl/Cmd+Enter untuk mengirim.")} checked={state.chatEnterToSend} onChange={() => toggle("chatEnterToSend")} /></div></div>}

    <div id="sync" />{section === "sync" && <div className="space-y-4"><Card className="p-4 sm:p-5"><div className="flex items-center gap-2"><Smartphone size={17} className="text-accent"/><h2 className="font-display text-xl text-text">{tr("Perangkat & offline")}</h2></div><div className="mt-4 grid gap-2 md:grid-cols-2"><Toggle label={tr("Sinkronisasi perangkat")} checked={state.syncEnabled} onChange={() => toggle("syncEnabled")} /><Toggle label={tr("Capture offline")} checked={state.offlineCapture} onChange={() => toggle("offlineCapture")} /></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><label><span className="text-[10px] font-bold uppercase tracking-[.08em] text-textMuted">{tr("Interval sync")}</span><select value={state.syncIntervalSeconds} onChange={(e) => update("syncIntervalSeconds", Number(e.target.value))} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-text"><option value={10}>{tr("10 detik")}</option><option value={15}>{tr("15 detik")}</option><option value={30}>{tr("30 detik")}</option><option value={60}>{tr("60 detik")}</option></select></label><label><span className="text-[10px] font-bold uppercase tracking-[.08em] text-textMuted">{tr("Strategi konflik")}</span><select value={state.conflictStrategy} onChange={(e) => update("conflictStrategy", e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-text"><option value="server">{tr("Server")}</option><option value="smart">{tr("Smart merge")}</option><option value="latest">{tr("Terbaru")}</option><option value="manual">{tr("Manual")}</option></select></label></div></Card><PushNotificationControl /><Card className="p-4"><div className="flex items-start gap-3"><Activity size={17} className="text-accent"/><div><p className="text-sm font-semibold text-text">{tr("Pemeriksaan sistem")}</p><p className="mt-1 text-[10px] text-textMuted">{tr("Satu tombol untuk melihat status sesi, database, dan latency.")}</p><div className="mt-3"><SoftButton onClick={() => void checkHealth()} disabled={healthBusy}>{healthBusy ? tr("Memeriksa…") : tr("Cek sistem")}</SoftButton></div></div></div>{health && <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{[["Status", health.ok ? "OK" : "Gagal"], ["Database", health.database ? "OK" : "Gagal"], ["User", health.user ? "OK" : "—"], ["Latency", health.latency_ms ? `${health.latency_ms}ms` : "—"]].map(([a,b]) => <div key={a} className="rounded-xl bg-bg p-3"><p className="text-[9px] text-textMuted">{a}</p><p className="mt-1 text-xs font-semibold text-text">{b}</p></div>)}</div>}</Card></div>}

    {section === "data" && <div className="space-y-4"><div className="grid gap-3 md:grid-cols-2"><Card className="p-4 sm:p-5"><div className="flex items-start gap-3"><Download size={18} className="text-accent"/><div><p className="text-sm font-semibold text-text">{tr("Ekspor data")}</p><p className="mt-1 text-[10px] leading-relaxed text-textMuted">{tr("Simpan salinan data Life OS untuk arsip pribadi.")}</p></div></div><div className="mt-4"><DataExportButton/></div></Card><Card className="p-4 sm:p-5"><div className="flex items-start gap-3"><Database size={18} className="text-accent"/><div><p className="text-sm font-semibold text-text">{tr("Backup & restore")}</p><p className="mt-1 text-[10px] leading-relaxed text-textMuted">{tr("Backup JSON dapat dipulihkan sebagai merge tanpa menghapus data lain.")}</p></div></div><div className="mt-4"><DataBackupButton/></div></Card></div><Card className="p-4 sm:p-5"><div className="flex items-start gap-3"><ShieldCheck size={18} className="text-accent"/><div><p className="text-sm font-semibold text-text">{tr("Akun & sesi")}</p><p className="mt-1 text-[10px] leading-relaxed text-textMuted">{tr("Keluar akun tetap tersedia dari halaman ini atau menu mobile.")}</p><div className="mt-4"><MobileAccountAction/></div></div></div></Card><Card className="p-4 sm:p-5"><p className="text-sm font-semibold text-text">{tr("Data & akses lanjutan")}</p><p className="mt-1 text-xs text-textMuted">{tr("Workspace yang sudah digabung memakai satu pengaturan bersama. Kontrol privasi, perangkat, notifikasi, dan pemeriksaan sistem dikelola dari bagian ini tanpa menu duplikat.")}</p><div className="mt-3 flex flex-wrap gap-2"><a href="/insights" className="rounded-xl bg-bg px-3 py-2 text-[10px] font-semibold text-textMuted hover:text-accent">{tr("Riwayat & review AI")}</a><a href="#sync" className="rounded-xl bg-bg px-3 py-2 text-[10px] font-semibold text-textMuted hover:text-accent">{tr("Perangkat & Notifikasi")}</a><a href="#ai" className="rounded-xl bg-bg px-3 py-2 text-[10px] font-semibold text-textMuted hover:text-accent">{tr("Privasi AI")}</a></div></Card></div>}

    <Card className="p-4 sm:p-5"><div className="flex items-start gap-3"><Sparkles size={17} className="mt-0.5 text-accent"/><div className="min-w-0"><p className="text-sm font-semibold text-text">{tr("Struktur Licia")}</p><p className="mt-1 text-[10px] leading-relaxed text-textMuted">{tr("Desktop dan ponsel memakai struktur workspace yang sama. Target & Proyek, Knowledge & Belajar, Keuangan, Kesehatan & Rutinitas, serta pusat Insights tidak menghidupkan kembali menu lama yang sudah digabung.")}</p><div className="mt-3 flex flex-wrap gap-1.5">{["Beranda","Rencana","Chat Licia","Tangkap","Insights","Target & Proyek","Knowledge & Belajar","Keuangan","Kesehatan & Rutinitas"].map((label)=><span key={label} className="rounded-full border border-border bg-bg px-2 py-1 text-[9px] font-semibold text-textMuted">{label}</span>)}</div></div></div></Card>

<div className="rounded-2xl border border-accent/15 bg-accent/5 p-3 text-[10px] leading-relaxed text-textMuted"><UserRound size={12} className="mr-1 inline text-accent"/>{tr("Semua ruang kerja memakai susunan yang sama di desktop dan ponsel. Perubahan yang kamu simpan berlaku untuk perangkatmu secara konsisten.")}</div>
  </div>;
}
