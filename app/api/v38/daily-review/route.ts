import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authenticatedRateLimit, enforceSameOrigin } from "@/lib/security";
import { dateStrInTimezone, endOfDayIsoForTimezone, startOfDayIsoForTimezone } from "@/lib/date";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sameOrigin = enforceSameOrigin(req);
  if (sameOrigin) return sameOrigin;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const gate = await authenticatedRateLimit(supabase, user.id, "v38-daily-review", 30, 60_000);
  if (gate) return gate;
  const { data: profile } = await supabase.from("users").select("timezone").eq("id", user.id).maybeSingle();
  const timezone = String(profile?.timezone || "Asia/Jakarta");
  const now = new Date();
  const date = dateStrInTimezone(now, timezone);
  const start = startOfDayIsoForTimezone(now, timezone);
  const end = endOfDayIsoForTimezone(now, timezone);
  const [doneRes, openRes, agendaRes, focusRes, goalsRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id,title,priority,due_at,updated_at")
      .eq("user_id", user.id)
      .eq("status", "done")
      .gte("updated_at", start)
      .lte("updated_at", end)
      .limit(200),
    supabase
      .from("tasks")
      .select("id,title,priority,due_at")
      .eq("user_id", user.id)
      .neq("status", "done")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(30),
    supabase
      .from("schedule_blocks")
      .select("id,title,start_time,end_time,completed_at")
      .eq("user_id", user.id)
      .eq("block_date", date)
      .order("start_time", { ascending: true })
      .limit(100),
    supabase
      .from("pomodoro_sessions")
      .select("focus_minutes")
      .eq("user_id", user.id)
      .gte("started_at", start)
      .lte("started_at", end)
      .limit(200),
    supabase
      .from("goals")
      .select("title,progress,target_date")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("progress", { ascending: true })
      .limit(6),
  ]);
  const done = doneRes.data || [];
  const open = openRes.data || [];
  const agenda = agendaRes.data || [];
  const focus = (focusRes.data || []).reduce((s: any, x: any) => s + Number(x.focus_minutes || 0), 0);
  const completedAgenda = agenda.filter((x: any) => Boolean(x.completed_at)).length;
  const overdue = open.filter((x: any) => x.due_at && new Date(x.due_at).getTime() < now.getTime()).length;
  const carryOver = open
    .filter((x: any) => x.due_at && new Date(x.due_at).getTime() <= now.getTime() + 72 * 3600000)
    .slice(0, 4)
    .map((x: any) => x.title);
  const wins = done.slice(0, 4).map((x: any) => x.title);
  const tomorrow = open.slice(0, 4).map((x: any) => x.title);
  const avgGoal = (goalsRes.data || []).length
    ? Math.round(
        (goalsRes.data || []).reduce((s: any, g: any) => s + Number(g.progress || 0), 0) / (goalsRes.data || []).length,
      )
    : 0;
  const narrative =
    done.length || focus || completedAgenda
      ? `Hari ini kamu menyelesaikan ${done.length} task, ${completedAgenda}/${agenda.length || 0} agenda tercatat selesai, dan mengumpulkan ${focus} menit fokus. Besok cukup bawa beberapa prioritas terdekat; tidak perlu memindahkan semuanya sekaligus.`
      : "Belum banyak aktivitas tercatat hari ini. Tidak masalah—gunakan hasil ini sebagai titik awal untuk besok.";
  return NextResponse.json(
    {
      ok: true,
      review: {
        date,
        completed_tasks: done.length,
        overdue_tasks: overdue,
        focus_minutes: focus,
        agenda_completed: completedAgenda,
        agenda_total: agenda.length,
        goals_progress: avgGoal,
        carry_over: carryOver,
        wins,
        tomorrow,
        narrative,
      },
      generatedAt: now.toISOString(),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
