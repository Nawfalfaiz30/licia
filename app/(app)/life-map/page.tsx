import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, BrainCircuit, CalendarDays, CheckCircle2, CircleAlert, Compass, FolderKanban, Inbox, Target, Timer, Waypoints } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, SectionTitle, StatTile } from "@/components/ui";
import { getOrCreateProfile } from "@/lib/getOrCreateProfile";
import { dateStrInTimezone } from "@/lib/date";

export default async function LifeMapPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await getOrCreateProfile(supabase, user.id);
  const now = new Date();
  const timezone = profile?.timezone ?? "Asia/Jakarta";
  const todayISO = dateStrInTimezone(now, timezone);
  const next14ISO = dateStrInTimezone(new Date(now.getTime() + 14 * 86400000), timezone);

  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
  const [{ data: goals }, { data: projects }, { data: tasks }, { data: schedule }, { data: inbox }, { data: focus }, { data: completedTasks }] = await Promise.all([
    supabase.from("goals").select("id,title,progress,target_date,status").eq("user_id", user.id).neq("status", "completed").order("target_date", { ascending: true, nullsFirst: false }).limit(100),
    supabase.from("projects").select("id,name,status,target_date,goal_id").eq("user_id", user.id).in("status", ["active", "paused"]).order("target_date", { ascending: true, nullsFirst: false }).limit(100),
    supabase.from("tasks").select("id,title,status,due_at,project_id").eq("user_id", user.id).neq("status", "done").limit(300),
    supabase.from("schedule_blocks").select("id,title,block_date,start_time,project_id").eq("user_id", user.id).gte("block_date", todayISO).limit(200),
    supabase.from("smart_inbox_items").select("id,status,content,created_at").eq("user_id", user.id).eq("status", "open").order("created_at", { ascending: false }).limit(200),
    supabase.from("pomodoro_sessions").select("id,focus_minutes").eq("user_id", user.id).gte("started_at", sevenDaysAgo),
    supabase.from("tasks").select("id").eq("user_id", user.id).eq("status", "done").gte("updated_at", sevenDaysAgo).limit(300),
  ]);

  const goalRows = goals ?? [];
  const projectRows = projects ?? [];
  const taskRows = tasks ?? [];
  const scheduleRows = schedule ?? [];
  const inboxRows = inbox ?? [];
  const focusMinutes = (focus ?? []).reduce((s, x) => s + Number(x.focus_minutes), 0);
  const completed7d = completedTasks?.length ?? 0;
  const overdueTasks = taskRows.filter((t) => t.due_at && dateStrInTimezone(new Date(t.due_at), timezone) < todayISO).length;
  const attentionDebt = overdueTasks + inboxRows.filter((x) => x.status === "open").length;
  const projectsWithoutTasks = projectRows.filter((p) => !taskRows.some((t) => t.project_id === p.id));
  const goalsWithoutProjects = goalRows.filter((g) => !projectRows.some((p) => p.goal_id === g.id));
  const tasksWithoutDue = taskRows.filter((t) => !t.due_at).length;
  const nextDeadline = [...goalRows.map(g => ({ label: g.title, date: g.target_date })), ...projectRows.map(p => ({ label: p.name, date: p.target_date }))]
    .filter((x): x is { label: string; date: string } => Boolean(x.date) && x.date! >= todayISO && x.date! <= next14ISO).sort((a, b) => a.date.localeCompare(b.date))[0];

  const nodes: Array<{ href: string; icon: LucideIcon; title: string; meta: string; desc: string }> = [
    { href: "/goals", icon: Target, title: "Target", meta: `${goalRows.length} target aktif`, desc: "Arah jangka menengah yang memberi konteks pada project dan rutinitas." },
    { href: "/projects", icon: FolderKanban, title: "Proyek", meta: `${projectRows.length} proyek berjalan`, desc: "Tempat mengubah target menjadi pekerjaan nyata." },
    { href: "/tasks", icon: CheckCircle2, title: "Tugas", meta: `${taskRows.length} tugas terbuka`, desc: "Unit eksekusi terkecil yang bisa diberi deadline, project, dan fokus." },
    { href: "/calendar", icon: CalendarDays, title: "Kalender", meta: `${scheduleRows.length} agenda mendatang`, desc: "Waktu nyata tempat rencana benar-benar mendapat ruang." },
    { href: "/inbox", icon: Inbox, title: "Smart Inbox", meta: `${inboxRows.length} item menunggu`, desc: "Menangkap ide cepat lalu mengubahnya menjadi aksi atau pengetahuan." },
    { href: "/focus", icon: Timer, title: "Fokus", meta: `${focusMinutes} menit / 7 hari`, desc: "Bukti waktu yang benar-benar diberikan pada pekerjaanmu." },
  ];

  return <div className="space-y-7 animate-licia-in">
    <header className="relative overflow-hidden rounded-3xl border border-border bg-surface p-5 sm:p-7">
      <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent"><Compass size={14}/> PERSONAL OS</p>
        <h1 className="font-display text-3xl text-text sm:text-4xl">Life Map</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-textMuted">Pengganti Relations: bukan mengelola orang, tetapi melihat bagaimana target, project, tugas, waktu, pengetahuan, dan fokus saling terhubung.</p>
      </div>
    </header>

    <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
      <StatTile label="Target aktif" value={String(goalRows.length)} icon={Target} tone="accent" />
      <StatTile label="Project berjalan" value={String(projectRows.length)} icon={FolderKanban} />
      <StatTile label="Tugas terbuka" value={String(taskRows.length)} icon={CheckCircle2} tone={taskRows.length > 0 ? "accent" : "default"} />
      <StatTile label="Fokus 7 hari" value={`${focusMinutes} mnt`} icon={Timer} tone="success" />
      <StatTile label="Momentum" value={`${completed7d} tugas`} icon={CheckCircle2} hint="selesai / 7 hari" />
      <StatTile label="Attention debt" value={String(attentionDebt)} icon={CircleAlert} hint="deadline lewat + inbox baru" tone={attentionDebt > 0 ? "accent" : "default"} />
    </div>

    <div className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
      <Card>
        <SectionTitle>Hubungan antar modul</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {nodes.map((n) => { const Icon = n.icon; return <Link key={n.href} href={n.href} className="group rounded-2xl border border-border bg-bg/50 p-4 transition hover:-translate-y-0.5 hover:border-accent/40 hover:bg-accent/5">
            <div className="flex items-start gap-3"><div className="rounded-xl bg-accent/10 p-2 text-accent transition group-hover:scale-105"><Icon size={17}/></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-text">{n.title}</p><ArrowRight size={14} className="shrink-0 text-textMuted group-hover:text-accent"/></div><p className="mt-1 text-xs font-medium text-accent">{n.meta}</p><p className="mt-2 text-xs leading-relaxed text-textMuted">{n.desc}</p></div></div>
          </Link> })}
        </div>
      </Card>

      <Card className="border-accent/20 bg-accent/5">
        <SectionTitle action={<Waypoints size={16} className="text-accent" />}>Sinyal yang perlu dilihat</SectionTitle>
        <div className="space-y-3">
          {nextDeadline ? <div className="rounded-xl border border-accent/20 bg-surface p-3"><p className="text-[10px] uppercase tracking-wider text-accent">Deadline 14 hari</p><p className="mt-1 text-sm font-semibold text-text">{nextDeadline.label}</p><p className="mt-1 text-xs text-textMuted">Target tanggal {nextDeadline.date}</p></div> : null}
          {goalsWithoutProjects.length > 0 && <div className="flex gap-2 rounded-xl bg-surface p-3"><CircleAlert size={15} className="mt-0.5 shrink-0 text-accent"/><p className="text-xs leading-relaxed text-textMuted"><strong className="text-text">{goalsWithoutProjects.length} target</strong> belum punya project. Buat project saat target sudah cukup jelas untuk dikerjakan.</p></div>}
          {projectsWithoutTasks.length > 0 && <div className="flex gap-2 rounded-xl bg-surface p-3"><CircleAlert size={15} className="mt-0.5 shrink-0 text-accent"/><p className="text-xs leading-relaxed text-textMuted"><strong className="text-text">{projectsWithoutTasks.length} project</strong> belum punya tugas terbuka. Tambahkan satu next action yang konkret.</p></div>}
          {overdueTasks > 0 && <div className="flex gap-2 rounded-xl bg-surface p-3"><CircleAlert size={15} className="mt-0.5 shrink-0 text-danger"/><p className="text-xs leading-relaxed text-textMuted"><strong className="text-text">{overdueTasks} tugas</strong> sudah melewati deadline. Pilih satu untuk dibereskan atau ubah tenggat bila memang bergeser.</p></div>}
          {tasksWithoutDue > 0 && <div className="flex gap-2 rounded-xl bg-surface p-3"><BrainCircuit size={15} className="mt-0.5 shrink-0 text-accent"/><p className="text-xs leading-relaxed text-textMuted"><strong className="text-text">{tasksWithoutDue} tugas</strong> belum punya deadline. Tidak semua tugas perlu deadline, jadi jadikan ini pilihan, bukan kewajiban.</p></div>}
          {!goalsWithoutProjects.length && !projectsWithoutTasks.length && !tasksWithoutDue && !overdueTasks && !nextDeadline && <p className="text-sm leading-relaxed text-textMuted">Belum ada gap besar yang terdeteksi dari data saat ini.</p>}
        </div>
      </Card>
    </div>

    <Card>
      <p className="text-sm font-semibold text-text">Cara memakai Life Map</p>
      <p className="mt-1 text-sm leading-relaxed text-textMuted">Mulai dari <strong className="text-text">Target</strong> ketika menentukan arah, turun ke <strong className="text-text">Project</strong> untuk membuat wadah kerja, pecah menjadi <strong className="text-text">Tugas</strong>, tempatkan ke <strong className="text-text">Kalender</strong>, lalu gunakan <strong className="text-text">Focus</strong> untuk mengeksekusi. Smart Inbox dan Vault menjaga hal-hal yang belum siap dikerjakan tetap tertangani.</p>
    </Card>
  </div>;
}
