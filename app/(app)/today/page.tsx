import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3, Droplets, Inbox, Sparkles, Timer, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { dateStrInTimezone, formatTimeInTimezone, startOfDayIsoForTimezone, endOfDayIsoForTimezone } from "@/lib/date";
import { getServerT } from "@/lib/i18n-server";

function minutesLabel(n:number){ if(n<60)return `${n} m`; return `${Math.floor(n/60)}j ${n%60?`${n%60}m`:""}`.trim(); }
function time(v:string){ return v?.slice(0,5)||v; }

export default async function TodayPage(){
  const {t:tr}=await getServerT();
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return null;
  const {data:profile}=await supabase.from("users").select("display_name,timezone").eq("id",user.id).single();
  const timezone=profile?.timezone||"Asia/Jakarta";
  const now=new Date();
  const today=dateStrInTimezone(now,timezone);
  const start=startOfDayIsoForTimezone(now,timezone);
  const end=endOfDayIsoForTimezone(now,timezone);
  const [{data:tasks},{data:agenda},{data:focus},{data:inbox},{data:habits},{data:hydration}]=await Promise.all([
    supabase.from("tasks").select("id,title,status,priority,due_at,estimated_minutes,project_id").eq("user_id",user.id).neq("status","done").order("due_at",{ascending:true,nullsFirst:false}).limit(25),
    supabase.from("schedule_blocks").select("id,title,start_time,end_time,location,task_id").eq("user_id",user.id).eq("block_date",today).order("start_time"),
    supabase.from("pomodoro_sessions").select("focus_minutes,completed,started_at").eq("user_id",user.id).gte("started_at",start).lte("started_at",end).order("started_at",{ascending:false}),
    supabase.from("smart_inbox_items").select("id,content,status,created_at").eq("user_id",user.id).eq("status","open").order("created_at",{ascending:false}).limit(6),
    supabase.from("habit_checkins").select("id,habit_id,checkin_date").eq("user_id",user.id).eq("checkin_date",today),
    supabase.from("hydration_logs").select("amount_ml").eq("user_id",user.id).gte("logged_at",start).lte("logged_at",end),
  ]);
  const openTasks=(tasks||[]) as any[];
  const agendaRows=(agenda||[]) as any[];
  const focusMinutes=(focus||[]).filter((x:any)=>x.completed!==false).reduce((s:number,x:any)=>s+Number(x.focus_minutes||0),0);
  const water=(hydration||[]).reduce((s:number,x:any)=>s+Number(x.amount_ml||0),0);
  const overdue=openTasks.filter((t:any)=>t.due_at&&new Date(t.due_at).getTime()<now.getTime());
  const dueSoon=openTasks.filter((t:any)=>t.due_at&&new Date(t.due_at).getTime()<=now.getTime()+48*60*60*1000);
  const priorities=(overdue.length?[...overdue,...openTasks.filter((x)=>!overdue.includes(x))]:dueSoon.length?dueSoon:openTasks).slice(0,3);
  const clock=new Intl.DateTimeFormat("en-GB",{timeZone:timezone,hour:"2-digit",minute:"2-digit",hour12:false}).format(now);
  const hour=Number(clock.slice(0,2));
  const greeting=hour<12?tr("Selamat pagi"):hour<18?tr("Selamat siang"):tr("Selamat malam");
  const currentAgenda=agendaRows.find((a:any)=>String(a.start_time).slice(0,5)<=clock&&clock<String(a.end_time).slice(0,5));
  const hydrationPct=Math.min(100,Math.round(water/2000*100));
  return <div className="today-page space-y-4 animate-licia-page-in">
    <section className="rounded-2xl border border-accent/15 bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xs font-semibold text-accent">{today}</p>
          <h1 className="mt-0.5 truncate font-display text-2xl text-text sm:text-3xl">{greeting}{profile?.display_name?tr(", {display_name}.",{display_name:profile.display_name}):"."}</h1>
          <p className="mt-1 truncate text-xs text-textMuted">{tr("{tasks} tugas aktif · {agenda} agenda · {focus} fokus",{tasks:openTasks.length,agenda:agendaRows.length,focus:minutesLabel(focusMinutes)})}</p>
        </div>
      </div>
    </section>

    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" aria-label={tr("Aksi cepat")}>
      <Link href="/tasks" className="shrink-0 rounded-xl border border-border bg-surface px-3 py-2.5 text-xs font-semibold text-text">+ {tr("Tugas")}</Link>
      <Link href="/capture" className="shrink-0 rounded-xl border border-border bg-surface px-3 py-2.5 text-xs font-semibold text-text">+ {tr("Catatan")}</Link>
      <Link href="/finance" className="shrink-0 rounded-xl border border-border bg-surface px-3 py-2.5 text-xs font-semibold text-text">+ {tr("Pengeluaran")}</Link>
      <Link href="/search" className="shrink-0 rounded-xl border border-border bg-surface px-3 py-2.5 text-xs font-semibold text-text">{tr("Cari")}</Link>
    </div>

    {currentAgenda&&<Link href="/calendar" className="flex items-center gap-3 rounded-2xl border border-accent/20 bg-accent/5 p-3.5 transition-colors duration-150 hover:border-accent/30">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white"><Clock3 size={16}/></span>
      <span className="min-w-0 flex-1"><span className="block text-2xs font-semibold text-accent">{tr("Sedang berlangsung")}</span>
        <span className="mt-0.5 block truncate text-sm font-semibold text-text">{currentAgenda.title}</span>
        <span className="mt-0.5 block text-2xs text-textMuted">{tr("Mulai {time}",{time:time(currentAgenda.start_time)})} · {tr("Selesai {time}",{time:time(currentAgenda.end_time)})}</span>
      </span><ArrowRight size={14} className="shrink-0 text-accent"/>
    </Link>}

    <section className="grid gap-3 lg:grid-cols-[1.1fr_.9fr]">
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2"><div><p className="text-2xs font-semibold text-accent">{tr("Prioritas sekarang")}</p><h2 className="mt-0.5 font-display text-xl text-text">{tr("Tiga hal berikutnya")}</h2></div><Link href="/tasks" className="text-2xs font-semibold text-accent">{tr("Semua tugas")}</Link></div>
        <div className="mt-3 space-y-2">{priorities.length?priorities.map((task:any)=><Link key={task.id} href="/tasks" className="flex items-start gap-3 rounded-xl border border-border bg-bg p-3 transition-colors duration-150 hover:border-accent/25">
          <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${task.priority==="high"?"bg-danger":task.priority==="medium"?"bg-accentSoft":"bg-accent"}`}/>
          <span className="min-w-0 flex-1"><span className="block line-clamp-2 text-sm font-semibold text-text">{task.title}</span>
            <span className={`mt-1 block text-2xs ${task.due_at&&new Date(task.due_at).getTime()<now.getTime()?"text-danger":"text-textMuted"}`}>{task.due_at?tr("Tenggat {time}",{time:formatTimeInTimezone(task.due_at,timezone)}):tr("Tanpa tenggat")}</span>
          </span><ArrowRight size={13} className="mt-1 shrink-0 text-textMuted"/>
        </Link>):<div className="rounded-xl border border-dashed border-border p-4 text-sm text-textMuted">{tr("Belum ada tugas prioritas.")}
        </div>}</div>
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2"><div><p className="text-2xs font-semibold text-accent">{tr("Jadwal hari ini")}</p><h2 className="mt-0.5 font-display text-xl text-text">{tr("Agenda terdekat")}</h2></div><CalendarDays size={17} className="text-accent"/></div>
        <div className="mt-3 space-y-2">{agendaRows.slice(0,5).map((a:any)=><Link key={a.id} href="/calendar" className="grid grid-cols-[48px_minmax(0,1fr)] gap-3 rounded-xl bg-bg p-3">
          <span className="text-xs font-bold tabular-nums text-accent">{time(a.start_time)}</span><span className="min-w-0"><span className="block truncate text-xs font-semibold text-text">{a.title}</span><span className="mt-0.5 block truncate text-2xs text-textMuted">{tr("Mulai {time}",{time:time(a.start_time)})}{a.task_id?tr(" · terhubung tugas"):""}</span></span>
        </Link>)}
        {!agendaRows.length&&<div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-textMuted">{tr("Belum ada agenda hari ini.")}</div>}</div>
      </Card>
    </section>

    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card className="p-4"><p className="text-xs text-textMuted">{tr("Tugas aktif")}</p><p className="mt-1 font-display text-2xl text-text">{openTasks.length}</p><p className="mt-1 text-2xs text-textMuted">{overdue.length?tr("{n} terlambat",{n:overdue.length}):tr("Tidak ada yang terlambat")}</p></Card>
      <Card className="p-4"><p className="text-xs text-textMuted">{tr("Fokus")}</p><p className="mt-1 font-display text-2xl text-accent">{minutesLabel(focusMinutes)}</p><p className="mt-1 text-2xs text-textMuted">{tr("Fokus selesai hari ini")}</p></Card>
      <Card className="p-4"><p className="text-xs text-textMuted">{tr("Hidrasi")}</p><p className="mt-1 font-display text-2xl text-accent">{water?tr("{water} ml",{water}):tr("0 / 2 L")}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg"><div className="h-full rounded-full bg-accent" style={{width:`${hydrationPct}%`}}/></div><Link href="/health" className="mt-2 inline-flex text-2xs font-semibold text-accent">+250 ml <ArrowRight size={10} className="ml-1"/></Link></Card>
      <Card className="p-4"><p className="text-xs text-textMuted">{tr("Rutinitas")}</p><p className="mt-1 font-display text-2xl text-text">{habits?.length||0}</p><p className="mt-1 text-2xs text-textMuted">{habits?.length?tr("check-in hari ini"):tr("Belum ada check-in hari ini")}</p><Link href="/habits" className="mt-2 inline-flex text-2xs font-semibold text-accent">{tr("Buka rutinitas")}</Link></Card>
    </section>

    <section className="rounded-2xl border border-accent/15 bg-accent/5 p-4">
      <div className="flex items-start gap-3"><span className="rounded-xl bg-accent/10 p-2.5 text-accent"><Sparkles size={16}/></span><div className="min-w-0 flex-1">
        <p className="text-2xs font-semibold text-accent">{tr("Saran Licia")}</p>
        <p className="mt-1 line-clamp-2 text-sm font-semibold text-text">{overdue.length?tr("Ada {n} tugas yang sudah lewat tenggat.",{n:overdue.length}):priorities[0]?tr("Mulai dari “{title}” agar langkah berikutnya jelas.",{title:priorities[0].title}):tr("Hari masih longgar. Kamu bisa merapikan rencana atau menangkap hal baru.")}</p>
        <Link href={overdue.length?"/tasks":"/plan"} className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-accent px-2.5 text-2xs font-semibold text-white">{overdue.length?tr("Buka tugas"):tr("Buka rencana")}<ArrowRight size={11}/></Link>
      </div></div>
    </section>
  </div>;
}
