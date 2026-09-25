"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CalendarDays, CircleDot, Pause, Play, RotateCcw, Timer, Volume2, VolumeX, Sparkles, Target, Gauge } from "lucide-react";
import { clsx } from "clsx";
import { createClient } from "@/lib/supabase/client";
import { Card, PrimaryButton, SectionTitle } from "@/components/ui";
import { startOfDayIsoForTimezone } from "@/lib/date";
import { LiveClock } from "@/components/LiveClock";

type Task = { id: string; title: string; status: string; priority: string; due_at: string | null; estimated_minutes?: number | null };
type Skill = { id: string; name: string; level: number; target_level: number };
type Agenda = { id: string; title: string; block_date: string; start_time: string; end_time: string; location: string | null; task_id: string | null };
type SoundKind = "off" | "chime" | "bells" | "pulse";

const sounds: Array<{ v: Exclude<SoundKind, "off">; l: string; notes: number[]; duration: number }> = [
  { v: "chime", l: "Chime", notes: [880, 1175, 1480], duration: 0.22 },
  { v: "bells", l: "Bells", notes: [660, 880, 1047], duration: 0.35 },
  { v: "pulse", l: "Pulse", notes: [740, 740, 988, 740], duration: 0.14 },
];

function fmt(v: number) {
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
}

export default function FocusPage() {
  const supabase = createClient();
  const sp = useSearchParams();
  const [presetTask] = useState(sp.get("task") || "");
  const [presetSkill] = useState(sp.get("skill") || "");
  const [timezone, setTimezone] = useState("Asia/Jakarta");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [agenda, setAgenda] = useState<Agenda[]>([]);
  const [selectedTask, setSelectedTask] = useState("");
  const [selectedSkill, setSelectedSkill] = useState("");
  const [minutes, setMinutes] = useState(25);
  const [customMinutes, setCustomMinutes] = useState("25");
  const [remaining, setRemaining] = useState(1500);
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [sound, setSound] = useState<SoundKind>("chime");
  const [soundRepeats, setSoundRepeats] = useState(5);
  const [autoCompleteFocus, setAutoCompleteFocus] = useState(false);
  const [focusToday, setFocusToday] = useState(0);
  const [message, setMessage] = useState("");
  const endAtRef = useRef<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const finishedRef = useRef(false);
  const STORAGE = "licia-focus-session-v6";

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: p } = await supabase.from("users").select("timezone,preferences").eq("id", user.id).single();
    const tz = p?.timezone || "Asia/Jakarta";
    const prefs = (p as any)?.preferences || {};
    setTimezone(tz);
    if (prefs.focusSound) setSound(prefs.focusSound as SoundKind);
    setSoundRepeats(Math.max(1, Math.min(10, Number(prefs.focusSoundRepeats) || 5)));
    setAutoCompleteFocus(Boolean(prefs.autoCompleteFocus));
    if (prefs.defaultFocus) {
      const d = Math.max(1, Math.min(240, Number(prefs.defaultFocus) || 25));
      setMinutes(d);
      setCustomMinutes(String(d));
      setRemaining(d * 60);
    }
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
    const [a, b, c, d] = await Promise.all([
      supabase.from("tasks").select("id,title,status,priority,due_at,estimated_minutes").neq("status", "done").order("due_at", { ascending: true, nullsFirst: false }).limit(80),
      supabase.from("schedule_blocks").select("id,title,block_date,start_time,end_time,location,task_id").eq("block_date", today).order("start_time"),
      supabase.from("pomodoro_sessions").select("focus_minutes").gte("started_at", startOfDayIsoForTimezone(new Date(), tz)),
      supabase.from("skills").select("id,name,level,target_level").order("updated_at", { ascending: false }).limit(80),
    ]);
    const ts = (a.data as Task[]) || [];
    const sk = (d.data as Skill[]) || [];
    setTasks(ts);
    setAgenda((b.data as Agenda[]) || []);
    setSkills(sk);
    setFocusToday((c.data || []).reduce((sum: number, row: any) => sum + Number(row.focus_minutes || 0), 0));
    if (presetTask && ts.some((x) => x.id === presetTask)) setSelectedTask(presetTask);
    if (presetSkill && sk.some((x) => x.id === presetSkill)) setSelectedSkill(presetSkill);
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (!raw) return;
      const x = JSON.parse(raw);
      if (x.paused) {
        setMinutes(Number(x.minutes) || 25);
        setCustomMinutes(String(Number(x.minutes) || 25));
        setRemaining(Math.max(0, Number(x.remaining) || 0));
        setSelectedTask(x.taskId || "");
        setSelectedSkill(x.skillId || "");
        setStartedAt(x.startedAt || null);
        endAtRef.current = null;
        finishedRef.current = false;
        setRunning(false);
        return;
      }
      if (x.endAt > Date.now()) {
        setMinutes(x.minutes);
        setCustomMinutes(String(x.minutes));
        setRemaining(Math.ceil((x.endAt - Date.now()) / 1000));
        setSelectedTask(x.taskId || "");
        setSelectedSkill(x.skillId || "");
        setStartedAt(x.startedAt || null);
        endAtRef.current = x.endAt;
        finishedRef.current = false;
        setRunning(true);
      } else {
        localStorage.removeItem(STORAGE);
      }
    } catch {}
  }, []);

  useEffect(() => {
    // Jangan mengembalikan countdown ke awal ketika sesi sedang dijeda.
    if (!running && !startedAt) setRemaining(minutes * 60);
  }, [minutes, running, startedAt]);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const ms = (endAtRef.current || Date.now()) - Date.now();
      setRemaining(Math.max(0, Math.ceil(ms / 1000)));
      if (ms <= 0 && !finishedRef.current) {
        finishedRef.current = true;
        void finish(true);
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  function getAudioContext() {
    try {
      const ctx = audioRef.current || new AudioContext();
      audioRef.current = ctx;
      if (ctx.state === "suspended") void ctx.resume();
      return ctx;
    } catch {
      return null;
    }
  }

  function playSound(kind: SoundKind = sound, repeats = 1) {
    if (kind === "off") return;
    const ctx = getAudioContext();
    if (!ctx) return;
    const config = sounds.find((item) => item.v === kind) || sounds[0];
    const safeRepeats = Math.max(1, Math.min(10, repeats));
    const step = config.duration * 0.72;
    const sequenceLength = Math.max(0.4, config.notes.length * step + config.duration);
    for (let repeat = 0; repeat < safeRepeats; repeat++) {
      config.notes.forEach((freq, i) => {
        const start = ctx.currentTime + repeat * (sequenceLength + 0.18) + i * step;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(0.04, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, start + config.duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + config.duration + 0.02);
      });
    }
  }

  function choose(v: number) {
    const safe = Math.max(1, Math.min(240, Math.round(v)));
    setMinutes(safe);
    setCustomMinutes(String(safe));
    setRemaining(safe * 60);
    setMessage("");
  }

  async function begin() {
    // Tombol utama berganti fungsi menjadi Jeda/Lanjutkan. Saat jeda,
    // sisa waktu disimpan apa adanya agar countdown tidak kembali ke awal.
    if (running) {
      const pausedRemaining = Math.max(0, remaining);
      setRemaining(pausedRemaining);
      setRunning(false);
      endAtRef.current = null;
      try {
        localStorage.setItem(STORAGE, JSON.stringify({
          paused: true,
          remaining: pausedRemaining,
          minutes,
          startedAt,
          taskId: selectedTask,
          skillId: selectedSkill,
        }));
      } catch {}
      setMessage(`Sesi dijeda di ${fmt(pausedRemaining)}. Tekan Lanjutkan untuk meneruskan.`);
      return;
    }

    const safe = Math.max(1, Math.min(240, Math.round(Number(customMinutes) || minutes)));
    const current = remaining > 0 && remaining <= safe * 60 ? remaining : safe * 60;
    setMinutes(safe);
    setCustomMinutes(String(safe));
    const start = startedAt || new Date().toISOString();
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") void ctx.resume();
    setStartedAt(start);
    setMessage("");
    if (selectedTask) await supabase.from("tasks").update({ status: "in_progress", updated_at: new Date().toISOString() }).eq("id", selectedTask);
    endAtRef.current = Date.now() + current * 1000;
    finishedRef.current = false;
    try { localStorage.setItem(STORAGE, JSON.stringify({ endAt: endAtRef.current, remaining: current, minutes: safe, startedAt: start, taskId: selectedTask, skillId: selectedSkill })); } catch {}
    setRunning(true);
  }

  async function finish(auto = false) {
    setRunning(false);
    endAtRef.current = null;
    try { localStorage.removeItem(STORAGE); } catch {}
    if (auto) {
      playSound(sound, soundRepeats);
      setMessage(`Sesi selesai. Suara ${sound === "off" ? "dimatikan" : `diputar ${soundRepeats}×`}.`);
    }
    if (!startedAt) {
      setRemaining(minutes * 60);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from("pomodoro_sessions").insert({ user_id: user.id, focus_minutes: minutes, task_id: selectedTask || null, skill_id: selectedSkill || null, completed: true, started_at: startedAt });
    if (autoCompleteFocus && selectedTask) await supabase.from("tasks").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", selectedTask);
    setStartedAt(null);
    setRemaining(minutes * 60);
    await load();
  }

  function reset() {
    setRunning(false);
    endAtRef.current = null;
    finishedRef.current = false;
    setStartedAt(null);
    setRemaining(minutes * 60);
    setMessage("");
    try { localStorage.removeItem(STORAGE); } catch {}
  }

  async function saveSound(v: SoundKind) {
    setSound(v);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: p } = await supabase.from("users").select("preferences").eq("id", user.id).single();
      await supabase.from("users").update({ preferences: { ...((p as any)?.preferences || {}), focusSound: v } }).eq("id", user.id);
    }
  }

  const selectedTaskTitle = useMemo(() => tasks.find((x) => x.id === selectedTask)?.title, [tasks, selectedTask]);
  const selectedSkillTitle = useMemo(() => skills.find((x) => x.id === selectedSkill)?.name, [skills, selectedSkill]);
  const progress = Math.max(0, Math.min(100, 100 - (remaining / Math.max(1, minutes * 60)) * 100));

  return (
    <div className="space-y-6 sm:space-y-8 animate-licia-in">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent"><Timer size={14}/> EXECUTE</p>
          <h1 className="font-display text-3xl text-text">Ruang Fokus</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-textMuted">Satu ruang untuk satu pekerjaan. Atur durasi sendiri, pilih konteks yang relevan, lalu biarkan Licia mencatat hasilnya.</p>
        </div>
        <LiveClock timezone={timezone}/>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,.75fr)]">
        <Card className="relative overflow-hidden p-4 sm:p-7 lg:p-9">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgb(var(--accent-rgb)/.12),transparent_35%)]" />
          <div className="relative mx-auto max-w-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className={clsx("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition", running ? "animate-licia-glow border-accent/30 bg-accent/10 text-accent" : "border-border bg-bg text-textMuted")}>
                <CircleDot size={13}/>{running ? "Sedang fokus" : "Siap fokus"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg px-3 py-1.5 text-[11px] text-textMuted"><Gauge size={13} className="text-accent"/>{minutes} menit</span>
            </div>

            <div className="mx-auto my-7 grid w-full max-w-[min(84vw,410px)] place-items-center">
              <div className={clsx("relative aspect-square w-full rounded-full p-[7px] transition duration-700", running && "animate-licia-breathe")} style={{ background: `conic-gradient(rgb(var(--accent-rgb)) ${progress}%, rgb(var(--border)) ${progress}% 100%)` }}>
                <div className="grid h-full w-full place-items-center rounded-full bg-surface shadow-inner">
                  <div className="px-4 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-textMuted">WAKTU TERSISA</p>
                    <p className="mt-2 font-display text-[clamp(4.5rem,16vw,7.5rem)] leading-none tracking-tight text-text tabular-nums">{fmt(remaining)}</p>
                    <p className="mx-auto mt-3 max-w-[18rem] break-words text-xs leading-relaxed text-textMuted">{selectedTaskTitle || "Belum memilih tugas"}{selectedSkillTitle ? ` · ${selectedSkillTitle}` : ""}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="min-w-0">
                <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-textMuted"><Target size={12}/> Tugas</span>
                <select value={selectedTask} onChange={(e) => setSelectedTask(e.target.value)} disabled={running} className="min-h-12 w-full min-w-0 rounded-xl border border-border bg-bg px-3 text-sm text-text outline-none focus:ring-2 focus:ring-accent/30"><option value="">Opsional — pilih tugas</option>{tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select>
              </label>
              <label className="min-w-0">
                <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-textMuted"><Sparkles size={12}/> Skill</span>
                <select value={selectedSkill} onChange={(e) => setSelectedSkill(e.target.value)} disabled={running} className="min-h-12 w-full min-w-0 rounded-xl border border-border bg-bg px-3 text-sm text-text outline-none focus:ring-2 focus:ring-accent/30"><option value="">Opsional — pilih skill</option>{skills.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.level}%</option>)}</select>
              </label>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label className="min-w-0">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-textMuted">Durasi manual · 1–240 menit</span>
                <div className="flex min-w-0 items-center rounded-xl border border-border bg-bg px-3">
                  <input aria-label="Durasi fokus dalam menit" type="number" min={1} max={240} value={customMinutes} disabled={running} onChange={(e) => setCustomMinutes(e.target.value)} onBlur={() => choose(Number(customMinutes) || 1)} onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); }} className="min-h-12 min-w-0 flex-1 bg-transparent text-center text-base font-semibold text-text outline-none"/>
                  <span className="text-xs text-textMuted">menit</span>
                </div>
              </label>
              <div className="flex items-end gap-2">
                <PrimaryButton onClick={begin} className="min-h-12 min-w-32">{running ? <><Pause size={16}/> Jeda</> : <><Play size={16}/> {startedAt && remaining > 0 ? "Lanjutkan" : "Mulai"}</>}</PrimaryButton>
                <button onClick={reset} className="touch-target rounded-xl border border-border px-3 text-textMuted transition hover:-translate-y-0.5 hover:text-text" title="Reset sesi" aria-label="Reset sesi"><RotateCcw size={17}/></button>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-border bg-bg/55 p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0"><p className="text-xs font-semibold text-text">Suara saat selesai</p><p className="mt-0.5 text-[11px] leading-relaxed text-textMuted">Pilihan suara akan diputar <strong className="text-text">{sound === "off" ? 0 : soundRepeats}×</strong> saat timer selesai.</p></div>
                <div className="flex shrink-0 items-center gap-1 rounded-xl border border-border bg-surface p-1 overflow-x-auto no-scrollbar">
                  <button onClick={() => { void saveSound("off"); }} className={clsx("touch-target flex items-center justify-center rounded-lg px-2.5 text-textMuted transition", sound === "off" && "bg-bg text-text")} title="Tanpa suara"><VolumeX size={15}/></button>
                  {sounds.map((item) => <button key={item.v} onClick={() => { void saveSound(item.v); playSound(item.v, 1); }} className={clsx("min-h-11 shrink-0 rounded-lg px-3 text-[11px] font-medium transition hover:-translate-y-0.5", sound === item.v ? "bg-bg text-accent" : "text-textMuted")} title={`Preview ${item.l}`}>{item.l}</button>)}
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-[11px] text-textMuted"><Volume2 size={13} className="text-accent"/> Pengulangan: <strong className="text-text">{soundRepeats}×</strong></div>
                <input aria-label="Jumlah pengulangan suara" type="range" min={1} max={10} value={soundRepeats} onChange={async (e) => { const v = Number(e.target.value); setSoundRepeats(v); const { data: { user } } = await supabase.auth.getUser(); if (user) { const { data: p } = await supabase.from("users").select("preferences").eq("id", user.id).single(); await supabase.from("users").update({ preferences: { ...((p as any)?.preferences || {}), focusSoundRepeats: v } }).eq("id", user.id); } }} className="w-full accent-[rgb(var(--accent-rgb))] sm:max-w-52"/>
              </div>
            </div>

            {message && <div className="mt-3 rounded-xl border border-accent/20 bg-accent/5 px-3 py-2 text-xs text-text animate-licia-in">{message}</div>}
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="animate-licia-fade-delay-1"><SectionTitle><span className="flex items-center gap-2"><Timer size={17} className="text-accent"/>Sesi hari ini</span></SectionTitle><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-bg p-4"><p className="text-xs text-textMuted">Fokus tercatat</p><p className="mt-1 font-display text-2xl text-accent tabular-nums">{focusToday}<span className="ml-1 text-sm text-textMuted">mnt</span></p></div><div className="rounded-xl bg-bg p-4"><p className="text-xs text-textMuted">Tugas aktif</p><p className="mt-1 font-display text-2xl text-text tabular-nums">{tasks.length}</p></div></div></Card>
          <Card className="animate-licia-fade-delay-2">
            <SectionTitle action={<a href="/calendar" className="inline-flex items-center gap-1 text-xs text-textMuted hover:text-accent">Kalender <ArrowRight size={12}/></a>}>Agenda terdekat</SectionTitle>
            {agenda[0] ? <div className="rounded-xl bg-bg p-4"><div className="flex gap-2"><CalendarDays size={16} className="mt-0.5 shrink-0 text-accent"/><div className="min-w-0"><p className="break-words text-sm font-semibold text-text">{agenda[0].title}</p><p className="mt-1 text-xs text-textMuted">{agenda[0].start_time.slice(0, 5)}–{agenda[0].end_time.slice(0, 5)}{agenda[0].location ? ` · ${agenda[0].location}` : ""}</p></div></div></div> : <p className="text-sm leading-relaxed text-textMuted">Tidak ada agenda berikutnya. Gunakan ruang kosong ini untuk satu sesi fokus yang tenang.</p>}
          </Card>
          <Card className="border-accent/15 bg-accent/5 animate-licia-fade-delay-3"><div className="flex gap-3"><Sparkles size={18} className="mt-0.5 shrink-0 text-accent"/><div><p className="text-sm font-semibold text-text">Tips Focus</p><p className="mt-1 text-xs leading-relaxed text-textMuted">Pilih satu tugas besar, tentukan durasinya, lalu mulai. Tidak ada preset waktu yang memaksa ritmemu.</p></div></div></Card>
        </div>
      </div>
    </div>
  );
}
