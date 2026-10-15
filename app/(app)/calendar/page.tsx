"use client";

import { SmartCaptureHint } from "@/components/ui/SmartCaptureHint";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock3, Plus, Trash2, CalendarDays, ListChecks, X } from "lucide-react";
import { clsx } from "clsx";
import { createClient } from "@/lib/supabase/client";
import { Card, EmptyState, PrimaryButton, SectionTitle, TextInput, notifyToast } from "@/components/ui";
import { localDateTimeToIso } from "@/lib/date";
import { createDefaultScheduleReminder, getDefaultReminderMinutes } from "@/lib/reminders/schedule";
import { mutateEntity } from "@/lib/sync/client";
import { CalendarIntelligence } from "@/components/v36/CalendarIntelligence";

import { useLanguage } from "@/components/LanguageProvider";
type Block = {
  id: string;
  block_date: string;
  start_time: string;
  end_time: string;
  title: string;
  location: string | null;
  description: string | null;
  task_id: string | null;
  project_id: string | null;
  version?: number;
  updated_at?: string;
};
type Task = { id: string; title: string };
const pad = (n: number) => String(n).padStart(2, "0");
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
function monthDays(d: Date, weekStart: "monday" | "sunday") {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const start = weekStart === "sunday" ? first.getDay() : (first.getDay() + 6) % 7;
  const count = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const out: Date[] = [];
  for (let i = 0; i < start; i++) out.push(new Date(d.getFullYear(), d.getMonth(), -start + i + 1));
  for (let i = 1; i <= count; i++) out.push(new Date(d.getFullYear(), d.getMonth(), i));
  while (out.length % 7) out.push(new Date(d.getFullYear(), d.getMonth() + 1, out.length - (start + count) + 1));
  return out;
}
export default function CalendarPage() {
  const { t: tr, locale } = useLanguage();
  const supabase = createClient();
  const [today, setToday] = useState(new Date());
  const [selected, setSelected] = useState(new Date());
  const [timezone, setTimezone] = useState("Asia/Jakarta");
  const [view, setView] = useState<"day" | "month">("day");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [form, setForm] = useState({
    title: "",
    date: dateKey(new Date()),
    start: "09:00",
    end: "10:00",
    location: "",
    description: "",
    task_id: "",
  });
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState<"monday" | "sunday">("monday");
  const days = useMemo(() => monthDays(selected, weekStart), [selected, weekStart]);
  async function load() {
    setLoading(true);
    const start = new Date(selected.getFullYear(), selected.getMonth(), 1);
    const end = new Date(selected.getFullYear(), selected.getMonth() + 1, 0);
    const [startRes, t] = await Promise.all([
      supabase
        .from("schedule_blocks")
        .select("id,block_date,start_time,end_time,title,location,description,task_id,project_id,version,updated_at")
        .gte("block_date", dateKey(start))
        .lte("block_date", dateKey(end))
        .order("block_date")
        .order("start_time"),
      supabase
        .from("tasks")
        .select("id,title")
        .neq("status", "done")
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(120),
    ]);
    setBlocks((startRes.data as Block[]) || []);
    setTasks((t.data as Task[]) || []);
    setLoading(false);
  }
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("users").select("preferences,timezone").eq("id", user.id).single();
      setTimezone(data?.timezone ?? "Asia/Jakarta");
      const prefs = (data?.preferences as { weekStart?: string; calendarView?: string } | null) || {};
      setWeekStart(prefs.weekStart === "sunday" ? "sunday" : "monday");
      if (prefs.calendarView === "month" || prefs.calendarView === "day") setView(prefs.calendarView);
    })();
  }, []);
  useEffect(() => {
    load();
  }, [selected.getFullYear(), selected.getMonth()]);
  async function uid() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error(tr("Belum masuk"));
    return user.id;
  }
  async function add() {
    if (!form.title.trim()) return;
    const result = await mutateEntity({
      entityType: "schedule",
      operation: "create",
      payload: {
        block_date: form.date,
        start_time: form.start,
        end_time: form.end,
        title: form.title.trim(),
        location: form.location.trim() || null,
        description: form.description.trim() || null,
        task_id: form.task_id || null,
        created_by: "manual",
      },
    });
    if (!result.ok) {
      notifyToast({
        title: "Agenda belum tersimpan",
        message: result.error || "Perubahan gagal disimpan.",
        tone: "error",
      });
      return;
    }
    const createdId = result.response?.entityId || null;
    if (createdId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const defaultMinutes = await getDefaultReminderMinutes(supabase, user.id);
        if (defaultMinutes > 0)
          await createDefaultScheduleReminder(
            supabase,
            user.id,
            timezone,
            {
              id: String(createdId),
              title: form.title.trim(),
              block_date: form.date,
              start_time: form.start,
              end_time: form.end,
            },
            defaultMinutes,
          );
      }
    }
    notifyToast({ title: "Agenda ditambahkan", message: form.title.trim(), tone: "success" });
    setOpen(false);
    setForm((x) => ({ ...x, title: "", description: "", location: "", task_id: "" }));
    load();
  }
  async function remove(id: string) {
    const block = blocks.find((x) => x.id === id);
    const result = await mutateEntity({
      entityType: "schedule",
      operation: "delete",
      entityId: id,
      baseVersion: block?.version ?? null,
      clientUpdatedAt: block?.updated_at,
    });
    if (!result.ok) {
      notifyToast({
        title: "Agenda belum terhapus",
        message: result.error || "Perubahan gagal disimpan.",
        tone: "error",
      });
      return;
    }
    notifyToast({ title: "Agenda dihapus", tone: "success" });
    load();
  }
  async function convertToTask(block: Block) {
    try {
      if (block.task_id) {
        notifyToast({
          title: "Agenda sudah terhubung",
          message: "Agenda ini sudah memiliki tugas terkait.",
          tone: "info",
        });
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error(tr("Belum masuk"));
      const startMin = Number(block.start_time.slice(0, 2)) * 60 + Number(block.start_time.slice(3, 5));
      const endMin = Number(block.end_time.slice(0, 2)) * 60 + Number(block.end_time.slice(3, 5));
      const desc = [
        block.description,
        block.location ? `Lokasi: ${block.location}` : null,
        tr("Dibuat dari agenda {block_date} {slice}–{slice2}.", {
          block_date: block.block_date,
          slice: block.start_time.slice(0, 5),
          slice2: block.end_time.slice(0, 5),
        }),
      ]
        .filter(Boolean)
        .join("\n");
      const taskMutation = await mutateEntity({
        entityType: "task",
        operation: "create",
        payload: {
          title: block.title,
          description: desc || null,
          priority: "medium",
          status: "todo",
          due_at: localDateTimeToIso(block.block_date, block.end_time.slice(0, 5), timezone),
          estimated_minutes: Math.max(1, endMin - startMin),
          project_id: block.project_id || null,
        },
      });
      if (!taskMutation.ok || !taskMutation.response?.entityId)
        throw new Error(taskMutation.error || tr("Task gagal dibuat"));
      const linkMutation = await mutateEntity({
        entityType: "schedule",
        operation: "update",
        entityId: block.id,
        baseVersion: block.version ?? null,
        clientUpdatedAt: block.updated_at,
        payload: { task_id: taskMutation.response.entityId },
      });
      if (!linkMutation.ok) {
        await mutateEntity({
          entityType: "task",
          operation: "delete",
          entityId: String(taskMutation.response.entityId),
        });
        throw new Error(linkMutation.error || tr("Agenda gagal dihubungkan"));
      }
      notifyToast({
        title: "Agenda menjadi tugas",
        message: tr("{block_title} sekarang punya deadline sesuai akhir agenda.", { block_title: block.title }),
        tone: "success",
      });
      setSelectedBlock(null);
      load();
    } catch (error) {
      notifyToast({
        title: "Belum berhasil",
        message: error instanceof Error ? error.message : tr("Terjadi kesalahan."),
        tone: "error",
      });
    }
  }
  const selectedKey = dateKey(selected);
  const selectedBlocks = blocks.filter((b) => b.block_date === selectedKey);
  const weekLabels =
    weekStart === "sunday"
      ? ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]
      : ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
  function move(n: number) {
    setSelected((d) => new Date(d.getFullYear(), d.getMonth() + n, 1));
  }
  function goToday() {
    setToday(new Date());
    setSelected(new Date());
    setView("day");
    setForm((f) => ({ ...f, date: dateKey(new Date()) }));
  }
  return (
    <div className="licia-v33-page-in space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            <CalendarDays size={14} /> {tr("WAKTU PRIBADI")}
          </p>
          <h1 className="font-display text-3xl text-text">{tr("Kalender")}</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-textMuted">
            {tr(
              "Buka ke hari terlebih dahulu supaya cepat dipakai. Mode bulan dibuat responsif 7 kolom tanpa perlu menggeser layar.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setView("day")}
            className={clsx(
              "rounded-xl border px-3 py-2 text-xs font-semibold",
              view === "day" ? "border-accent bg-accent text-white" : "border-border bg-surface text-textMuted",
            )}
          >
            {tr("Hari")}
          </button>
          <button
            onClick={() => setView("month")}
            className={clsx(
              "rounded-xl border px-3 py-2 text-xs font-semibold",
              view === "month" ? "border-accent bg-accent text-white" : "border-border bg-surface text-textMuted",
            )}
          >
            {tr("Bulan")}
          </button>
          <button
            onClick={goToday}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-textMuted hover:text-accent"
          >
            {tr("Hari ini")}
          </button>
          <PrimaryButton onClick={() => setOpen((v) => !v)}>
            <Plus size={15} /> {tr("Jadwal")}
          </PrimaryButton>
        </div>
      </header>
      <CalendarIntelligence />
      {open && (
        <Card className="border-accent/20 bg-accent/5">
          <SectionTitle>{tr("Tambah jadwal")}</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2">
            <TextInput
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={tr("Judul agenda")}
            />
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="min-h-11 rounded-xl border border-border bg-surface px-3 text-sm text-text"
            />
            <input
              type="time"
              value={form.start}
              onChange={(e) => setForm({ ...form, start: e.target.value })}
              className="min-h-11 rounded-xl border border-border bg-surface px-3 text-sm text-text"
            />
            <input
              type="time"
              value={form.end}
              onChange={(e) => setForm({ ...form, end: e.target.value })}
              className="min-h-11 rounded-xl border border-border bg-surface px-3 text-sm text-text"
            />
            <TextInput
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder={tr("Lokasi (opsional)")}
            />
            <select
              value={form.task_id}
              onChange={(e) => setForm({ ...form, task_id: e.target.value })}
              className="min-h-11 rounded-xl border border-border bg-surface px-3 text-sm text-text"
            >
              <option value="">{tr("Tidak terkait tugas")}</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <div className="sm:col-span-2">
              <SmartCaptureHint
                text={form.title}
                onApplySchedule={(r) =>
                  setForm((f) => ({
                    ...f,
                    title: r.title,
                    date: r.date || f.date,
                    start: r.start || f.start,
                    end: r.end || (r.start ? f.end : f.end),
                  }))
                }
              />
            </div>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="sm:col-span-2 resize-none rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:ring-2 focus:ring-accent/30"
              placeholder={tr("Catatan singkat…")}
            />
          </div>
          <div className="mt-3 flex justify-end">
            <PrimaryButton onClick={add}>{tr("Simpan agenda")}</PrimaryButton>
          </div>
        </Card>
      )}
      {view === "day" ? (
        <div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
          <Card>
            <SectionTitle>{tr("Hari terpilih")}</SectionTitle>
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => setSelected((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1))}
                className="touch-target rounded-xl border border-border text-textMuted hover:text-accent"
              >
                <ChevronLeft size={17} />
              </button>
              <div className="text-center">
                <p className="font-display text-2xl text-text">
                  {selected.toLocaleDateString(locale, { weekday: "long" })}
                </p>
                <p className="text-sm text-textMuted">
                  {selected.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
              <button
                onClick={() => setSelected((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1))}
                className="touch-target rounded-xl border border-border text-textMuted hover:text-accent"
              >
                <ChevronRight size={17} />
              </button>
            </div>
            <button
              onClick={() => {
                setForm((f) => ({ ...f, date: selectedKey }));
                setOpen(true);
              }}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-accent/30 bg-accent/5 py-4 text-xs font-semibold text-accent"
            >
              <Plus size={14} /> {tr("Tambah pada hari ini")}
            </button>
          </Card>
          <Card>
            <SectionTitle
              action={
                <span className="text-xs text-textMuted">
                  {tr("{selectedBlocks_lengt} agenda", { selectedBlocks_lengt: selectedBlocks.length })}
                </span>
              }
            >
              {tr("Agenda")}
            </SectionTitle>
            {loading ? (
              <p className="text-sm text-textMuted">{tr("Memuat…")}</p>
            ) : !selectedBlocks.length ? (
              <EmptyState
                title={tr("Hari masih lapang")}
                description={tr(
                  "Gunakan ruang kosong untuk fokus atau jadwalkan sesuatu yang memang perlu waktu khusus.",
                )}
              />
            ) : (
              <div className="space-y-2">
                {selectedBlocks.map((b) => (
                  <div
                    key={b.id}
                    className="group flex w-full gap-3 rounded-xl border border-border bg-bg p-3 text-left transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-sm"
                  >
                    <button
                      onClick={() => setSelectedBlock(b)}
                      className="flex min-w-0 flex-1 gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    >
                      <div className="w-16 shrink-0 text-center">
                        <p className="text-xs font-semibold text-accent">{b.start_time.slice(0, 5)}</p>
                        <p className="text-2xs text-textMuted">{b.end_time.slice(0, 5)}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-semibold text-text">{b.title}</p>
                        {(b.location || b.description) && (
                          <p className="mt-1 break-words text-xs text-textMuted">{b.location || b.description}</p>
                        )}
                        <p className="mt-2 text-2xs font-medium text-accent opacity-0 transition group-hover:opacity-100">
                          {tr("Klik untuk melihat detail")}
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={() => remove(b.id)}
                      className="touch-target flex shrink-0 items-center justify-center rounded-lg text-textMuted hover:text-danger"
                      aria-label={tr("Hapus agenda")}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : (
        <Card className="min-w-0 overflow-hidden p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              onClick={() => move(-1)}
              className="touch-target rounded-xl border border-border text-textMuted hover:text-accent"
              aria-label={tr("Bulan sebelumnya")}
            >
              <ChevronLeft size={17} />
            </button>
            <div className="text-center">
              <p className="font-display text-xl text-text sm:text-2xl">
                {selected.toLocaleDateString(locale, { month: "long", year: "numeric" })}
              </p>
              <p className="text-2xs text-textMuted sm:text-xs">
                {tr("{blocks_length} agenda bulan ini", { blocks_length: blocks.length })}
              </p>
            </div>
            <button
              onClick={() => move(1)}
              className="touch-target rounded-xl border border-border text-textMuted hover:text-accent"
              aria-label={tr("Bulan berikutnya")}
            >
              <ChevronRight size={17} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {weekLabels.map((x) => (
              <div key={x} className="py-1 text-center text-2xs font-semibold text-textMuted sm:text-xs">
                {x}
              </div>
            ))}
            {days.map((d, i) => {
              const key = dateKey(d);
              const ev = blocks.filter((b) => b.block_date === key);
              const inMonth = d.getMonth() === selected.getMonth();
              const isToday = key === dateKey(today);
              const isSelected = key === selectedKey;
              return (
                <button
                  key={`${key}-${i}`}
                  onClick={() => setSelected(d)}
                  aria-label={`${d.getDate()} ${d.toLocaleDateString(locale, { month: "long" })}${ev.length ? `, ${ev.length} agenda` : ""}`}
                  className={clsx(
                    "min-w-0 min-h-[58px] rounded-xl border p-1.5 text-center transition sm:min-h-[72px] sm:p-2",
                    inMonth
                      ? "border-border bg-surface hover:border-accent/40"
                      : "border-transparent bg-bg/40 opacity-45",
                    isSelected && "border-accent/40 bg-accent/5 ring-1 ring-accent/30",
                  )}
                >
                  <span
                    className={clsx(
                      "mx-auto grid h-7 w-7 place-items-center rounded-full text-xs font-semibold sm:h-8 sm:w-8 sm:text-sm",
                      isToday ? "bg-accent text-white" : isSelected ? "bg-accent/15 text-accent" : "text-text",
                    )}
                  >
                    {d.getDate()}
                  </span>
                  <span className="mt-1.5 flex min-h-2 justify-center gap-1 overflow-hidden">
                    {ev.slice(0, 4).map((b) => (
                      <span key={b.id} className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                    ))}
                  </span>
                  {ev.length > 4 && (
                    <span className="mt-0.5 block text-[11px] leading-none text-textMuted">+{ev.length - 4}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-4 border-t border-border pt-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-accent">{tr("Hari terpilih")}</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-text">
                  {selected.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setForm((f) => ({ ...f, date: selectedKey }));
                  setOpen(true);
                }}
                className="min-h-10 shrink-0 rounded-xl bg-accent px-3 text-2xs font-semibold text-white"
              >
                <Plus size={13} className="mr-1 inline" /> {tr("Jadwal")}
              </button>
            </div>
            {selectedBlocks.length ? (
              <div className="space-y-1.5">
                {selectedBlocks.slice(0, 4).map((b) => (
                  <button
                    type="button"
                    key={b.id}
                    onClick={() => setSelectedBlock(b)}
                    className="flex w-full items-center gap-2.5 rounded-xl bg-bg p-2.5 text-left hover:bg-accent/5"
                  >
                    <span className="w-16 shrink-0 text-xs font-semibold text-accent">
                      {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-text">{b.title}</span>
                    <ChevronRight size={12} className="shrink-0 text-textMuted" />
                  </button>
                ))}
                {selectedBlocks.length > 4 && (
                  <p className="pt-1 text-2xs text-textMuted">
                    +{selectedBlocks.length - 4} {tr("agenda lainnya")}
                  </p>
                )}
              </div>
            ) : (
              <p className="rounded-xl bg-bg p-3 text-xs text-textMuted">{tr("Hari masih lapang")}</p>
            )}
          </div>
        </Card>
      )}
      {selectedBlock && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onMouseDown={() => setSelectedBlock(null)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-accent">{tr("Detail agenda")}</p>
                <h3 className="mt-1 break-words font-display text-xl text-text">{selectedBlock.title}</h3>
              </div>
              <button
                onClick={() => setSelectedBlock(null)}
                className="touch-target rounded-xl border border-border text-textMuted hover:text-text"
                aria-label={tr("Tutup")}
              >
                ×
              </button>
            </div>
            <div className="space-y-3 p-5">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-bg p-3">
                  <p className="text-2xs text-textMuted">{tr("Tanggal")}</p>
                  <p className="mt-1 text-xs font-semibold text-text">
                    {new Date(`${selectedBlock.block_date}T12:00:00`).toLocaleDateString(locale, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="rounded-xl bg-bg p-3">
                  <p className="text-2xs text-textMuted">{tr("Waktu")}</p>
                  <p className="mt-1 text-xs font-semibold text-text">
                    {selectedBlock.start_time.slice(0, 5)}–{selectedBlock.end_time.slice(0, 5)}
                  </p>
                </div>
              </div>
              {selectedBlock.location && (
                <div className="rounded-xl bg-bg p-3">
                  <p className="text-2xs text-textMuted">{tr("Lokasi")}</p>
                  <p className="mt-1 break-words text-xs text-text">{selectedBlock.location}</p>
                </div>
              )}
              {selectedBlock.description && (
                <div className="rounded-xl bg-bg p-3">
                  <p className="text-2xs text-textMuted">{tr("Catatan")}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-text">
                    {selectedBlock.description}
                  </p>
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                {!selectedBlock.task_id && (
                  <button
                    onClick={() => convertToTask(selectedBlock)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-accent/20 bg-accent/5 px-3 py-2 text-xs font-semibold text-accent hover:bg-accent/10"
                  >
                    <ListChecks size={13} /> {tr("Jadikan tugas")}
                  </button>
                )}
                <button
                  onClick={() => {
                    setForm((f) => ({
                      ...f,
                      date: selectedBlock.block_date,
                      title: selectedBlock.title,
                      start: selectedBlock.start_time.slice(0, 5),
                      end: selectedBlock.end_time.slice(0, 5),
                      location: selectedBlock.location || "",
                      description: selectedBlock.description || "",
                      task_id: selectedBlock.task_id || "",
                    }));
                    setSelectedBlock(null);
                    setOpen(true);
                  }}
                  className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-textMuted hover:border-accent hover:text-accent"
                >
                  {tr("Gunakan sebagai template")}
                </button>
                <button
                  onClick={() => {
                    remove(selectedBlock.id);
                    setSelectedBlock(null);
                  }}
                  className="rounded-xl border border-danger/20 bg-danger/5 px-3 py-2 text-xs font-semibold text-danger hover:bg-danger/10"
                >
                  {tr("Hapus agenda")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
