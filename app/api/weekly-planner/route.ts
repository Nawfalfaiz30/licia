import { NextResponse } from "next/server";

import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateProfile } from "@/lib/getOrCreateProfile";
import { dateStrInTimezone, startOfWeekIsoForTimezone } from "@/lib/date";
import { enforceSameOrigin, rateLimit } from "@/lib/security";
import { withOpenAIRetry } from "@/lib/ai/runtime";

export const runtime = "nodejs";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (openaiClient) return openaiClient;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY belum dikonfigurasi di server.");
  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function minutesBetween(start: string, end: string) {
  const a = start.split(":").map(Number);
  const b = end.split(":").map(Number);
  return Math.max(0, (b[0] * 60 + b[1]) - (a[0] * 60 + a[1]));
}

async function resolveContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, timezone: "Asia/Jakarta", weekStart: "", weekEnd: "" };
  const { data: profile } = await supabase.from("users").select("display_name, timezone").eq("id", user.id).single();
  const resolved = profile ?? await getOrCreateProfile(supabase, user.id, user.user_metadata?.display_name);
  const timezone = (resolved as any)?.timezone ?? "Asia/Jakarta";
  const now = new Date();
  const weekStart = dateStrInTimezone(new Date(startOfWeekIsoForTimezone(now, timezone)), timezone);
  const weekEnd = shiftDate(weekStart, 6);
  return { supabase, user, timezone, weekStart, weekEnd };
}

export async function GET() {
  const { supabase, user, timezone, weekStart, weekEnd } = await resolveContext();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const gate = rateLimit(`weekly-planner-read:${user.id}`, 60, 60_000); if (gate) return gate;
  const { data, error } = await supabase.from("daily_plans").select("plan, updated_at").eq("user_id", user.id).eq("week_start", weekStart).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ weekStart, weekEnd, timezone, plan: data?.plan ?? null, savedAt: data?.updated_at ?? null });
}

export async function POST(req: Request) {
  const originError = enforceSameOrigin(req); if (originError) return originError;
  const { supabase, user, timezone, weekStart, weekEnd } = await resolveContext();
  const now = new Date();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const gate = rateLimit(`weekly-planner-write:${user.id}`, 6, 60_000); if (gate) return gate;

  const [tasksRes, scheduleRes, goalsRes, habitsRes, focusRes, lastPlanRes] = await Promise.all([
    supabase.from("tasks").select("id,title,status,priority,due_at").eq("user_id", user.id).neq("status", "done").order("due_at", { ascending: true, nullsFirst: false }).limit(24),
    supabase.from("schedule_blocks").select("id,block_date,start_time,end_time,title,task_id").eq("user_id", user.id).gte("block_date", weekStart).lte("block_date", weekEnd).order("block_date").order("start_time").limit(60),
    supabase.from("goals").select("id,title,progress,target_date,category").eq("user_id", user.id).eq("status", "active").limit(10),
    supabase.from("habits").select("id,name,target_per_week").eq("user_id", user.id).limit(10),
    supabase.from("pomodoro_sessions").select("focus_minutes").eq("user_id", user.id).gte("started_at", startOfWeekIsoForTimezone(now, timezone)),
    supabase.from("daily_plans").select("plan,updated_at").eq("user_id", user.id).eq("week_start", weekStart).maybeSingle(),
  ]);

  const payload = {
    week_start: weekStart,
    week_end: weekEnd,
    tasks: tasksRes.data ?? [],
    schedule: scheduleRes.data ?? [],
    goals: goalsRes.data ?? [],
    habits: habitsRes.data ?? [],
    focus_minutes: (focusRes.data ?? []).reduce((s, r) => s + Number(r.focus_minutes), 0),
    previous_plan: lastPlanRes.data?.plan ? {
      summary: lastPlanRes.data.plan.summary ?? "",
      risks: Array.isArray(lastPlanRes.data.plan.risks) ? lastPlanRes.data.plan.risks.slice(0, 5) : [],
    } : null,
  };

  try {
    const completion = await withOpenAIRetry(() => getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      max_tokens: 1200,
      messages: [
        {
          role: "system",
          content: `Buat rencana minggu yang realistis, bukan jadwal yang penuh. Zona waktu ${timezone}. Minggu ${weekStart} sampai ${weekEnd}. Gunakan tugas, agenda, target, kebiasaan, dan fokus yang diberikan. Utamakan deadline yang dekat, sisakan ruang kosong, jangan membuat acara sebelum jam 07:00 atau setelah 22:00. Hasil harus JSON {"summary":string,"days":[{"date":"YYYY-MM-DD","focus":string,"blocks":[{"start_time":"HH:MM","end_time":"HH:MM","title":string,"task_id":string|null,"reason":string}]}],"risks":[string]}. Maksimal 3 blok rekomendasi per hari dan total jangan terlalu padat. Gunakan task_id hanya bila blok memang untuk tugas tersebut.`,
        },
        { role: "user", content: JSON.stringify(payload) },
      ],
    }), 2);
    const plan = JSON.parse(completion.choices[0]?.message?.content || "{}");
    await supabase.from("daily_plans").upsert({ user_id: user.id, week_start: weekStart, plan }, { onConflict: "user_id,week_start" });
    return NextResponse.json({ weekStart, weekEnd, timezone, plan, savedAt: new Date().toISOString() });
  } catch {
    // Deterministic fallback so the feature remains useful without the model.
    type PlannerBlock = {
      start_time: string;
      end_time: string;
      title: string;
      task_id: string | null;
      reason: string;
    };
    type PlannerDay = {
      date: string;
      focus: string;
      blocks: PlannerBlock[];
    };

    const days: PlannerDay[] = Array.from({ length: 7 }, (_, i) => ({
      date: shiftDate(weekStart, i),
      focus: i < 5 ? "Satu prioritas utama" : "Ruang pemulihan & review",
      blocks: [],
    }));
    const openTasks = tasksRes.data ?? [];
    openTasks.slice(0, 7).forEach((task, index) => {
      const date = shiftDate(weekStart, Math.min(6, index));
      const day = days.find((d) => d.date === date);
      if (day) day.blocks.push({ start_time: "09:00", end_time: "10:00", title: task.title, task_id: task.id, reason: "Memberi satu slot fokus pada tugas terbuka." });
    });
    const plan = { summary: "Rencana dasar yang menjaga minggu tetap longgar dan memberi satu blok fokus per hari.", days, risks: [] };
    await supabase.from("daily_plans").upsert({ user_id: user.id, week_start: weekStart, plan }, { onConflict: "user_id,week_start" });
    return NextResponse.json({
      weekStart,
      weekEnd,
      timezone,
      plan,
      savedAt: new Date().toISOString(),
      fallback: true,
      fallbackReason: "AI tidak tersedia; Licia menggunakan rencana dasar dari data yang tersimpan."
    });
  }
}


export async function DELETE(req: Request) {
  const originError = enforceSameOrigin(req); if (originError) return originError;
  const { supabase, user, weekStart } = await resolveContext();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const gate = rateLimit(`weekly-planner-delete:${user.id}`, 12, 60_000); if (gate) return gate;
  const { error } = await supabase.from("daily_plans").delete().eq("user_id", user.id).eq("week_start", weekStart);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
