import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin } from "@/lib/security";
import {
  dateStrInTimezone,
  endOfDayIsoForTimezone,
  startOfDayIsoForTimezone,
  startOfMonthIsoForTimezone,
} from "@/lib/date";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const { data: profile } = await supabase.from("users").select("timezone,preferences").eq("id", user.id).maybeSingle();
  const preferences = (profile?.preferences || {}) as Record<string, unknown>;
  if (preferences.dailySnapshot === false) return NextResponse.json({ ok: true, disabled: true, snapshot: null });

  const timezone = String(profile?.timezone || "Asia/Jakarta");
  const now = new Date();
  const snapshotDate = dateStrInTimezone(now, timezone);
  const dayStart = startOfDayIsoForTimezone(now, timezone);
  const dayEnd = endOfDayIsoForTimezone(now, timezone);
  const monthStart = startOfMonthIsoForTimezone(now, timezone);

  const [tasks, agenda, goals, inbox, reminders, habits, focus, expenses, incomes] = await Promise.all([
    supabase.from("tasks").select("id,status,due_at").eq("user_id", user.id).neq("status", "done").limit(1000),
    supabase.from("schedule_blocks").select("id").eq("user_id", user.id).eq("block_date", snapshotDate).limit(100),
    supabase.from("goals").select("id,progress,target_date").eq("user_id", user.id).eq("status", "active").limit(200),
    supabase.from("smart_inbox_items").select("id").eq("user_id", user.id).eq("status", "open").limit(500),
    supabase
      .from("reminders")
      .select("id")
      .eq("user_id", user.id)
      .eq("enabled", true)
      .in("status", ["pending", "waiting_for_device", "failed"])
      .gte("remind_at", now.toISOString())
      .lte("remind_at", new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString())
      .limit(100),
    supabase.from("habits").select("id").eq("user_id", user.id).eq("active", true).limit(200),
    supabase
      .from("pomodoro_sessions")
      .select("focus_minutes")
      .eq("user_id", user.id)
      .gte("started_at", dayStart)
      .lte("started_at", dayEnd)
      .limit(200),
    supabase.from("expenses").select("amount").eq("user_id", user.id).gte("occurred_at", monthStart).limit(2000),
    supabase.from("incomes").select("amount").eq("user_id", user.id).gte("occurred_at", monthStart).limit(2000),
  ]);

  const taskRows = tasks.data || [];
  const overdueTasks = taskRows.filter((task) => task.due_at && new Date(task.due_at).getTime() < now.getTime()).length;
  const dueToday = taskRows.filter(
    (task) =>
      task.due_at &&
      new Date(task.due_at).getTime() >= new Date(dayStart).getTime() &&
      new Date(task.due_at).getTime() <= new Date(dayEnd).getTime(),
  ).length;
  const goalRows = goals.data || [];
  const averageGoalProgress = goalRows.length
    ? Math.round(goalRows.reduce((sum, goal) => sum + Number(goal.progress || 0), 0) / goalRows.length)
    : 0;
  const focusMinutes = (focus.data || []).reduce((sum, row) => sum + Number(row.focus_minutes || 0), 0);
  const expenseTotal = (expenses.data || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const incomeTotal = (incomes.data || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const snapshot = {
    generated_at: now.toISOString(),
    timezone,
    tasks: { open: taskRows.length, overdue: overdueTasks, due_today: dueToday },
    agenda: { today: agenda.data?.length || 0 },
    goals: { active: goalRows.length, average_progress: averageGoalProgress },
    inbox: { open: inbox.data?.length || 0 },
    reminders: { next_48h: reminders.data?.length || 0 },
    habits: { active: habits.data?.length || 0 },
    focus: { minutes_today: focusMinutes },
    finance: { month_income: incomeTotal, month_expense: expenseTotal, month_net: incomeTotal - expenseTotal },
  };

  const { data, error } = await supabase
    .from("life_os_daily_snapshots")
    .upsert(
      {
        user_id: user.id,
        snapshot_date: snapshotDate,
        timezone,
        data: snapshot,
        generated_at: now.toISOString(),
        source_version: "v33",
      },
      { onConflict: "user_id,snapshot_date" },
    )
    .select("snapshot_date,timezone,data,generated_at,source_version")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(
    { ok: true, snapshotDate, snapshot: data },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
