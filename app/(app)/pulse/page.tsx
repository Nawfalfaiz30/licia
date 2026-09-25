
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Activity, ArrowRight, BarChart3, CalendarDays, CheckCircle2, CircleAlert, Clock3, Flame, Inbox, Sparkles, Target, Timer, Wand2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateProfile } from "@/lib/getOrCreateProfile";
import { dateStrInTimezone } from "@/lib/date";
import { Card } from "@/components/ui";

export default async function LifePulsePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("users").select("display_name,timezone").eq("id", user.id).single();
  const resolved = profile ?? (await getOrCreateProfile(supabase, user.id, user.user_metadata?.display_name));
  const timezone = profile?.timezone ?? (resolved as any)?.timezone ?? "Asia/Jakarta";
  const today = dateStrInTimezone(new Date(), timezone);
  const tomorrow = dateStrInTimezone(new Date(Date.now()+86400000), timezone);
  const [tasks, agenda, goals, projects, inbox, habits, focus, automations, memories, notes, subs] = await Promise.all([
    supabase.from("tasks").select("id,title,status,priority,due_at,estimated_minutes,project_id").eq("user_id", user.id),
    supabase.from("schedule_blocks").select("id,title,block_date,start_time,end_time,task_id").eq("user_id", user.id).gte("block_date", today).lte("block_date", tomorrow).order("block_date").order("start_time").limit(8),
    supabase.from("goals").select("id,title,status,progress,target_date,next_step").eq("user_id", user.id).in("status", ["active","paused"]).order("updated_at", { ascending: false }).limit(8),
    supabase.from("projects").select("id,name,status,target_date,updated_at").eq("user_id", user.id).in("status", ["active","paused"]).order("updated_at", { ascending: false }).limit(8),
    supabase.from("smart_inbox_items").select("id,content,status,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(12),
    supabase.from("habits").select("id,name,target_per_week").eq("user_id", user.id).limit(8),
    supabase.from("pomodoro_sessions").select("focus_minutes,started_at").eq("user_id", user.id).gte("started_at", new Date(Date.now()-7*86400000).toISOString()),
    supabase.from("automations").select("id,name,enabled,last_run_at").eq("user_id", user.id).limit(8),
    supabase.from("user_memories").select("id,memory_key,enabled").eq("user_id", user.id).eq("enabled", true).limit(8),
    supabase.from("brain_dump_notes").select("id,title,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(6),
    supabase.from("subscriptions").select("id,name,next_billing_date,active").eq("user_id", user.id).eq("active", true).order("next_billing_date").limit(6),
  ]);
  const taskRows = tasks.data ?? []; const active = taskRows.filter(t=>t.status!=="done"); const done = taskRows.filter(t=>t.status==="done");
  const overdue = active.filter(t=>t.due_at && new Date(t.due_at).getTime()<Date.now());
  const todayTasks = active.filter(t=>t.due_at && dateStrInTimezone(new Date(t.due_at),timezone)===today);
  const focus7d = (focus.data??[]).reduce((s,x)=>s+Number(x.focus_minutes||0),0);
  const staleProjects = (projects.data??[]).filter(p=>p.updated_at && Date.now()-new Date(p.updated_at).getTime()>7*86400000);
  const scoreParts = [overdue.length===0, todayTasks.length<=5, staleProjects.length<=1, (inbox.data??[]).filter(i=>i.status==="open").length<=5, (goals.data??[]).some(g=>Number(g.progress)>0)];
  const pulse = Math.round(scoreParts.filter(Boolean).length/scoreParts.length*100);
  return <div className="space-y-6 animate-licia-page-in">
    <header className="life-pulse-hero rounded-[2rem] border border-accent/15 bg-surface p-5 sm:p-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><div className="mb-2 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-accent"><Activity size={13}/> Life Pulse</div><h1 className="font-display text-3xl text-text sm:text-4xl">Bagaimana keadaan Life OS-mu sekarang?</h1><p className="mt-2 max-w-3xl text-sm leading-relaxed text-textMuted">Pulse menyatukan sinyal tugas, waktu, target, project, Inbox, fokus, dan memori menjadi satu tampilan untuk membantu kamu menentukan langkah berikutnya.</p></div><div className="flex shrink-0 items-center gap-4 rounded-[1.5rem] border border-border bg-bg p-4"><div className="relative flex h-24 w-24 items-center justify-center rounded-full" style={{ background:`conic-gradient(rgb(var(--accent-rgb)) ${pulse*3.6}deg, rgb(var(--border-rgb)) ${pulse*3.6}deg)` }}><div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface"><div className="text-center"><p className="font-display text-2xl text-text">{pulse}</p><p className="text-[9px] text-textMuted">pulse</p></div></div></div><div><p className="text-xs font-semibold text-text">Sinyal utama</p><p className="mt-1 text-[10px] leading-relaxed text-textMuted">{overdue.length ? `${overdue.length} tugas terlambat perlu dilihat.` : "Tidak ada tugas terlambat."}</p></div></div></div></header>

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{([
      ["Tugas aktif", active.length, CheckCircle2, "text-accent"],
      ["Terlambat", overdue.length, CircleAlert, "text-danger"],
      ["Agenda 2 hari", (agenda.data ?? []).length, CalendarDays, "text-accentSoft"],
      ["Fokus 7 hari", `${focus7d} mnt`, Timer, "text-success"],
      ["Inbox terbuka", (inbox.data ?? []).filter(i => i.status === "open").length, Inbox, "text-text"],
    ] as const satisfies ReadonlyArray<[string, number | string, LucideIcon, string]>).map(([label, value, Icon, cn]) => (
      <Card key={label} className="p-4"><span className={`inline-flex rounded-xl bg-bg p-2 ${cn}`}><Icon size={15}/></span><p className="mt-2 text-[10px] text-textMuted">{label}</p><p className="mt-1 font-display text-xl text-text">{value}</p></Card>
    ))}</div>

    <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
      <Card className="p-4 sm:p-5"><div className="flex items-center justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-accent">Attention radar</p><h2 className="mt-1 font-display text-xl text-text">Hal yang layak diperhatikan</h2></div><Sparkles size={18} className="text-accent"/></div><div className="mt-4 space-y-2.5">{overdue.slice(0,4).map(t=><Link href="/tasks" key={t.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-danger/15 bg-danger/5 p-3 transition hover:border-danger/30"><CircleAlert size={15} className="shrink-0 text-danger"/><span className="min-w-0 flex-1"><b className="block break-words text-xs text-text">{t.title}</b><span className="mt-0.5 text-[10px] text-danger">Terlambat</span></span><ArrowRight size={13} className="shrink-0 text-textMuted"/></Link>)}{staleProjects.slice(0,3).map(p=><Link href="/projects" key={p.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-bg p-3 transition hover:border-accent/25"><Flame size={15} className="shrink-0 text-accentSoft"/><span className="min-w-0 flex-1"><b className="block break-words text-xs text-text">Project {p.name} belum aktif lebih dari seminggu.</b><span className="mt-0.5 text-[10px] text-textMuted">Pertimbangkan review atau tandai paused.</span></span><ArrowRight size={13} className="shrink-0 text-textMuted"/></Link>)}{(inbox.data??[]).filter(i=>i.status==="open").slice(0,3).map(i=><Link href="/inbox" key={i.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-bg p-3"><Inbox size={15} className="shrink-0 text-accent"/><span className="min-w-0 flex-1"><b className="block break-words text-xs text-text">{String(i.content).slice(0,120)}</b><span className="mt-0.5 text-[10px] text-textMuted">Masih ada di Inbox</span></span><ArrowRight size={13} className="shrink-0 text-textMuted"/></Link>)}{!overdue.length&&!staleProjects.length&&!(inbox.data??[]).some(i=>i.status==="open")&&<div className="rounded-2xl border border-success/15 bg-success/5 p-4 text-xs text-success">Life OS relatif tenang. Gunakan waktu ini untuk fokus atau review target.</div>}</div></Card>
      <Card className="p-4 sm:p-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-accent">Quick recovery</p><h2 className="mt-1 font-display text-xl text-text">Perlu beres-beres?</h2><p className="mt-2 text-xs leading-relaxed text-textMuted">Licia bisa membaca seluruh konteks dan membuat usulan pemulihan tanpa langsung menerapkan perubahan massal.</p><div className="mt-4 space-y-2"><Link href="/command" className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-accent px-4 text-sm font-semibold text-white"><span className="flex items-center gap-2"><Wand2 size={15}/> Buat recovery plan</span><ArrowRight size={14}/></Link><Link href="/brief" className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-border bg-bg px-4 text-xs font-semibold text-textMuted hover:border-accent/30 hover:text-accent"><span>Daily / weekly review</span><ArrowRight size={14}/></Link><Link href="/analytics" className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-border bg-bg px-4 text-xs font-semibold text-textMuted hover:border-accent/30 hover:text-accent"><span>Lihat analitik pribadi</span><BarChart3 size={14}/></Link></div></Card>
    </section>

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{([
      ["Target",`${(goals.data??[]).filter(g=>g.status==='active').length} aktif`,"Tetapkan hasil yang ingin dicapai.",Target,"/goals"],
      ["Project",`${(projects.data??[]).length} aktif/paused`,"Tempat kerja besar berlangsung.",Activity,"/projects"],
      ["Rutinitas",`${(habits.data??[]).length} kebiasaan`,"Jaga ritme kecil yang berulang.",Clock3,"/habits"],
      ["Memori",`${(memories.data??[]).length} aktif`,"Fakta yang sengaja diingat Licia.",Sparkles,"/memory"],
    ] as const satisfies ReadonlyArray<[string, string, string, LucideIcon, string]>).map(([title,value,desc,Icon,href])=>(<Link href={href} key={title} className="group rounded-2xl border border-border bg-surface p-4 transition hover:-translate-y-1 hover:border-accent/30"><Icon size={16} className="text-accent"/><p className="mt-3 text-xs font-semibold text-text">{title}</p><p className="mt-1 font-display text-lg text-text">{value}</p><p className="mt-1 text-[10px] leading-relaxed text-textMuted">{desc}</p></Link>))}</section>
  </div>;
}
