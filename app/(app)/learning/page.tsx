"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ExternalLink,
  GraduationCap,
  Plus,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { clsx } from "clsx";
import { createClient } from "@/lib/supabase/client";
import { Card, EmptyState, PrimaryButton, SectionTitle, TextInput } from "@/components/ui";
import { mutateEntity } from "@/lib/sync/client";

import { useLanguage } from "@/components/LanguageProvider";
import { documentLocale } from "@/lib/format";
type Skill = {
  id: string;
  name: string;
  category: string | null;
  level: number;
  target_level: number;
  goal_id: string | null;
  resource_url: string | null;
  notes: string | null;
  target_date: string | null;
  learning_mode: string | null;
  hours_spent: number;
  next_action: string | null;
  version?: number;
  updated_at?: string;
};
type Goal = { id: string; title: string };
type Session = { skill_id: string | null; focus_minutes: number; started_at: string };
const modes = [
  ["practice", "Latihan"],
  ["course", "Kursus"],
  ["proyek", "Proyek"],
  ["reading", "Membaca"],
  ["mentoring", "Bimbingan"],
];
function days(d: string | null) {
  if (!d) return null;
  return Math.ceil((new Date(`${d}T12:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
}

export default function LearningPage() {
  const { t: tr } = useLanguage();
  const supabase = createClient();
  const [rows, setRows] = useState<Skill[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "",
    goal_id: "",
    url: "",
    mode: "practice",
    target: "100",
    date: "",
    next_action: "",
  });
  const [query, setQuery] = useState("");
  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: s }, { data: g }, { data: fs }] = await Promise.all([
      supabase
        .from("skills")
        .select(
          "id,name,category,level,target_level,goal_id,resource_url,notes,target_date,learning_mode,hours_spent,next_action,version,updated_at",
        )
        .order("updated_at", { ascending: false }),
      supabase.from("goals").select("id,title").eq("status", "active").order("title"),
      supabase
        .from("pomodoro_sessions")
        .select("skill_id,focus_minutes,started_at")
        .eq("user_id", user.id)
        .not("skill_id", "is", null)
        .order("started_at", { ascending: false })
        .limit(500),
    ]);
    setRows((s as Skill[]) ?? []);
    setGoals((g as Goal[]) ?? []);
    setSessions((fs as Session[]) ?? []);
  }
  useEffect(() => {
    load();
  }, []);
  async function uid() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error(tr("Belum masuk"));
    return user.id;
  }
  async function add() {
    if (!form.name.trim()) return;
    await mutateEntity({
      entityType: "skill",
      operation: "create",
      payload: {
        name: form.name.trim(),
        category: form.category.trim() || null,
        goal_id: form.goal_id || null,
        resource_url: form.url.trim() || null,
        learning_mode: form.mode,
        target_level: Number(form.target) || 100,
        target_date: form.date || null,
        level: 0,
        hours_spent: 0,
        next_action: form.next_action.trim() || null,
      },
    });
    setForm({
      name: "",
      category: "",
      goal_id: "",
      url: "",
      mode: "practice",
      target: "100",
      date: "",
      next_action: "",
    });
    setOpen(false);
    load();
  }
  async function update(id: string, patch: Record<string, unknown>) {
    const row = rows.find((x) => x.id === id);
    await mutateEntity({
      entityType: "skill",
      operation: "update",
      entityId: id,
      baseVersion: row?.version ?? null,
      clientUpdatedAt: row?.updated_at,
      payload: patch,
    });
    load();
  }
  async function remove(id: string) {
    await mutateEntity({ entityType: "skill", operation: "delete", entityId: id });
    load();
  }
  const focusHours = useMemo(
    () =>
      sessions.reduce(
        (m, s) => {
          if (!s.skill_id) return m;
          m[s.skill_id] = (m[s.skill_id] || 0) + Number(s.focus_minutes || 0) / 60;
          return m;
        },
        {} as Record<string, number>,
      ),
    [sessions],
  );
  const focusCount = useMemo(
    () =>
      sessions.reduce(
        (m, s) => {
          if (!s.skill_id) return m;
          m[s.skill_id] = (m[s.skill_id] || 0) + 1;
          return m;
        },
        {} as Record<string, number>,
      ),
    [sessions],
  );
  const lastFocus = useMemo(
    () =>
      sessions.reduce(
        (m, s) => {
          if (!s.skill_id) return m;
          if (!m[s.skill_id] || new Date(s.started_at) > new Date(m[s.skill_id])) m[s.skill_id] = s.started_at;
          return m;
        },
        {} as Record<string, string>,
      ),
    [sessions],
  );
  const avg = rows.length ? Math.round(rows.reduce((s, x) => s + x.level, 0) / rows.length) : 0;
  const totalHours =
    Math.round(
      (rows.reduce((s, x) => s + Number(x.hours_spent || 0), 0) +
        sessions.reduce((s, x) => s + Number(x.focus_minutes || 0) / 60, 0)) *
        10,
    ) / 10;
  const close = rows.filter((x) => x.level >= x.target_level).length;
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return rows.filter((x) => !q || `${x.name} ${x.category || ""} ${x.next_action || ""}`.toLowerCase().includes(q));
  }, [rows, query]);
  const targetSoon = rows
    .filter(
      (s) =>
        s.target_date &&
        days(s.target_date) !== null &&
        days(s.target_date)! >= 0 &&
        days(s.target_date)! <= 14 &&
        s.level < s.target_level,
    )
    .sort((a, b) => (days(a.target_date) ?? 999) - (days(b.target_date) ?? 999));
  return (
    <div className="licia-v33-page-in space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            <GraduationCap size={14} /> {tr("Belajar · Latih · Buktikan")}
          </p>
          <h1 className="font-display text-3xl text-text">{tr("Belajar & Keahlian")}</h1>
          <p className="mt-1 max-w-3xl text-sm text-textMuted">
            {tr(
              "Keahlian bukan sekadar persentase. Hubungkan dengan target, latih lewat Ruang Fokus, simpan langkah berikutnya, dan lihat bukti waktu yang benar-benar kamu habiskan.",
            )}
          </p>
        </div>
        <PrimaryButton onClick={() => setOpen((v) => !v)}>
          <Plus size={16} /> {tr("Skill baru")}
        </PrimaryButton>
      </header>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-textMuted">{tr("Skill aktif")}</p>
          <p className="mt-1 font-display text-2xl text-accent">{rows.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-textMuted">{tr("Progress rata-rata")}</p>
          <p className="mt-1 font-display text-2xl text-text">{avg}%</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-textMuted">{tr("Waktu terekam")}</p>
          <p className="mt-1 font-display text-2xl text-text">{totalHours}j</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-textMuted">{tr("Target tercapai")}</p>
          <p className="mt-1 font-display text-2xl text-success">{close}</p>
        </Card>
      </div>
      {open && (
        <Card className="border-accent/20 bg-accent/5">
          <SectionTitle>{tr("Bangun jalur belajar")}</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <TextInput
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={tr("Skill, mis. Kotlin Android")}
            />
            <TextInput
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder={tr("Kategori")}
            />
            <select
              value={form.mode}
              onChange={(e) => setForm({ ...form, mode: e.target.value })}
              className="min-h-11 rounded-xl border border-border bg-surface px-3 text-sm text-text"
            >
              {modes.map((m) => (
                <option key={m[0]} value={m[0]}>
                  {m[1]}
                </option>
              ))}
            </select>
            <select
              value={form.goal_id}
              onChange={(e) => setForm({ ...form, goal_id: e.target.value })}
              className="min-h-11 rounded-xl border border-border bg-surface px-3 text-sm text-text"
            >
              <option value="">{tr("Tanpa target")}</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="min-h-11 rounded-xl border border-border bg-surface px-3 text-sm text-text"
            />
            <TextInput
              type="number"
              min="1"
              max="100"
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
              placeholder={tr("Target level")}
            />
            <TextInput
              value={form.next_action}
              onChange={(e) => setForm({ ...form, next_action: e.target.value })}
              placeholder={tr("Langkah latihan berikutnya")}
            />
            <TextInput
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder={tr("Materi / link (opsional)")}
            />
          </div>
          <div className="mt-3 flex justify-end">
            <PrimaryButton onClick={add}>
              <Plus size={15} /> {tr("Mulai jalur")}
            </PrimaryButton>
          </div>
        </Card>
      )}
      {targetSoon.length > 0 && (
        <Card className="border-accent/20 bg-accent/5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-accent/10 p-2.5 text-accent">
              <CalendarClock size={17} />
            </div>
            <div>
              <p className="text-sm font-semibold text-text">{tr("Ada skill yang mendekati tenggat")}</p>
              <p className="mt-1 text-xs text-textMuted">
                {targetSoon
                  .slice(0, 3)
                  .map((x) =>
                    tr("{x_name} · {max} hari lagi", { x_name: x.name, max: Math.max(0, days(x.target_date) ?? 0) }),
                  )
                  .join(" · ")}
              </p>
            </div>
          </div>
        </Card>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr("Cari skill, kategori, atau langkah berikutnya…")}
            className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-text outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <Link
          href="/focus"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-xs font-semibold text-textMuted hover:border-accent hover:text-accent"
        >
          {tr("Buka Fokus")} <ArrowRight size={13} />
        </Link>
      </div>
      <SectionTitle>{tr("Jalur yang sedang dibangun")}</SectionTitle>
      {!filtered.length ? (
        <EmptyState
          title={tr("Belum ada skill yang cocok")}
          description={tr("Tambahkan satu kemampuan yang bisa dibuktikan lewat praktik nyata.")}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((s) => {
            const pct = Math.min(100, Math.round((s.level / Math.max(1, s.target_level)) * 100));
            const d = days(s.target_date);
            const recorded = focusHours[s.id] ?? 0;
            return (
              <Card key={s.id} className="min-w-0 overflow-hidden p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-accent/10 p-2.5 text-accent">
                    <GraduationCap size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-bg px-2 py-1 text-2xs text-textMuted">
                        {modes.find((m) => m[0] === s.learning_mode)?.[1] || "Belajar"}
                      </span>
                      {s.category && (
                        <span className="rounded-full bg-bg px-2 py-1 text-2xs text-textMuted">{s.category}</span>
                      )}
                    </div>
                    <p className="mt-2 break-words font-display text-lg text-text">{s.name}</p>
                    <p className="mt-0.5 text-xs text-textMuted">
                      {tr("Level {level} / {target_level} · {toFixed}j dari Focus", {
                        level: s.level,
                        target_level: s.target_level,
                        toFixed: recorded.toFixed(1),
                      })}
                    </p>
                  </div>
                  <button onClick={() => remove(s.id)} className="shrink-0 text-textMuted hover:text-danger">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="mt-4 flex justify-between text-xs">
                  <span className="text-textMuted">{tr("Kemajuan menuju target")}</span>
                  <span className="font-semibold text-accent">{pct}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={s.target_level}
                  value={s.level}
                  onChange={(e) => update(s.id, { level: Number(e.target.value) })}
                  className="mt-1.5 w-full accent-accent"
                />
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-xl bg-bg p-2.5 text-center">
                    <p className="text-sm font-semibold text-text">{Number(s.hours_spent || 0).toFixed(1)}j</p>
                    <p className="text-2xs text-textMuted">{tr("manual")}</p>
                  </div>
                  <div className="rounded-xl bg-bg p-2.5 text-center">
                    <p className="text-sm font-semibold text-accent">{recorded.toFixed(1)}j</p>
                    <p className="text-2xs text-textMuted">{tr("Focus")}</p>
                  </div>
                  <div className="rounded-xl bg-bg p-2.5 text-center">
                    <p className="text-sm font-semibold text-text">{focusCount[s.id] || 0}</p>
                    <p className="text-2xs text-textMuted">{tr("sesi")}</p>
                  </div>
                  <div className="rounded-xl bg-bg p-2.5 text-center">
                    <p className="text-sm font-semibold text-text">
                      {Number(s.hours_spent || 0) + recorded > 0
                        ? Math.round((Number(s.hours_spent || 0) + recorded) * 10) / 10
                        : 0}
                      j
                    </p>
                    <p className="text-2xs text-textMuted">{tr("total")}</p>
                  </div>
                </div>
                <div className="mt-3 rounded-xl border border-border bg-bg/45 p-3">
                  <p className="text-2xs uppercase tracking-wider text-textMuted">{tr("Langkah berikutnya")}</p>
                  <p className="mt-1 text-xs leading-relaxed text-text">
                    {s.next_action || tr("Tulis satu praktik konkret supaya sesi berikutnya punya arah.")}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-2xs text-textMuted">
                  {s.target_date && (
                    <span className={clsx("flex items-center gap-1", d !== null && d < 0 ? "text-danger" : "")}>
                      <CalendarClock size={11} />{" "}
                      {d !== null && d < 0 ? tr("{abs} hari lewat", { abs: Math.abs(d) }) : tr("{d} hari lagi", { d })}
                    </span>
                  )}
                  {s.goal_id && (
                    <Link href="/goals" className="flex items-center gap-1 text-accent">
                      <Target size={11} /> {goals.find((g) => g.id === s.goal_id)?.title || "Target"}
                    </Link>
                  )}
                  {lastFocus[s.id] && (
                    <span className="text-textMuted">
                      {tr("Latihan terakhir")}{" "}
                      {new Date(lastFocus[s.id]).toLocaleDateString(documentLocale(), {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  )}
                  {s.level >= s.target_level && (
                    <span className="flex items-center gap-1 text-success">
                      <CheckCircle2 size={11} /> {tr("Target tercapai")}
                    </span>
                  )}
                  {s.resource_url && (
                    <a
                      href={s.resource_url}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto inline-flex items-center gap-1 text-accent hover:underline"
                    >
                      <ExternalLink size={11} /> {tr("Materi")}
                    </a>
                  )}
                </div>
                <div className="mt-4 flex justify-end">
                  <Link
                    href={`/focus?skill=${s.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-accent/20 bg-accent/5 px-3 py-2 text-xs font-semibold text-accent"
                  >
                    <TrendingUp size={13} /> {tr("Latih skill ini")}
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <Card className="border-border/70 bg-surfaceRaised/40">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <Clock3 size={15} className="text-accent" />
              <p className="text-sm font-semibold text-text">{tr("Bukti waktu")}</p>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-textMuted">
              {tr(
                "Ruang Fokus bisa ditautkan langsung ke skill. Jam yang tercatat membantu melihat latihan nyata tanpa mengandalkan perkiraan saja.",
              )}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-accent" />
              <p className="text-sm font-semibold text-text">{tr("Langkah berikutnya")}</p>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-textMuted">
              {tr("Setiap skill punya satu aksi konkret berikutnya agar kamu tidak berhenti di angka progres.")}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <BookOpen size={15} className="text-accent" />
              <p className="text-sm font-semibold text-text">{tr("Hubungkan sumber")}</p>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-textMuted">
              {tr("Bacaan, proyek, target, dan Ruang Fokus bisa menjadi sumber bukti belajar yang saling terhubung.")}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
