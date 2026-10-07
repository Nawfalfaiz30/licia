import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin } from "@/lib/security";
import { invalidateUserContext } from "@/lib/ai/contextCache";

export const dynamic = "force-dynamic";

const TABLES: Record<string, string> = {
  task: "tasks",
  schedule: "schedule_blocks",
  project: "projects",
  goal: "goals",
  note: "brain_dump_notes",
  inbox: "smart_inbox_items",
  reminder: "reminders",
  memory: "user_memories",
  subtask: "subtasks",
  milestone: "goal_milestones",
  decision: "decisions",
  skill: "skills",
  expense: "expenses",
  income: "incomes",
  subscription: "subscriptions",
  sleep: "sleep_logs",
  hydration: "hydration_logs",
  caffeine: "caffeine_logs",
  meal: "meal_logs",
  medication: "medication_logs",
  fatigue: "fatigue_logs",
  movement: "movement_logs",
  healthMetric: "health_metrics",
  pomodoro: "pomodoro_sessions",
  habit: "habits",
  habitCheckin: "habit_checkins",
  reading: "reading_logs",
  readingSession: "reading_sessions",
  relation: "social_relations",
  interaction: "social_interactions",
  budget: "budgets",
  account: "accounts",
  accountTransfer: "account_transfers",
  automation: "automations",
  vault: "vault_items",
};

export async function POST(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = String(body?.conflictId || "").trim();
  const resolution = String(body?.resolution || "server");
  if (!id || !["server", "client", "merge", "discard"].includes(resolution))
    return NextResponse.json({ error: "Resolusi tidak valid." }, { status: 400 });

  const admin = createAdminClient();
  const { data: conflict, error: conflictError } = await admin
    .from("life_os_sync_conflicts")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "open")
    .maybeSingle();
  if (conflictError) return NextResponse.json({ error: conflictError.message }, { status: 500 });
  if (!conflict) return NextResponse.json({ error: "Konflik tidak ditemukan atau sudah selesai." }, { status: 404 });

  if (resolution === "discard" || resolution === "server") {
    const { error } = await admin
      .from("life_os_sync_conflicts")
      .update({
        status: resolution === "discard" ? "discarded" : "resolved",
        resolution,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    invalidateUserContext(user.id);
    return NextResponse.json({ ok: true, resolution });
  }

  const table = TABLES[String(conflict.entity_type)] || null;
  if (!table || !conflict.entity_id)
    return NextResponse.json({ error: "Konflik ini tidak dapat dipulihkan otomatis." }, { status: 400 });
  const clientPayload = (conflict.client_payload || {}) as Record<string, unknown>;
  const serverPayload = (conflict.server_payload || {}) as Record<string, unknown>;
  const conflictFields = new Set<string>(
    Array.isArray(conflict.conflicting_fields) ? conflict.conflicting_fields.map(String) : [],
  );
  let payload: Record<string, unknown>;
  if (resolution === "merge") {
    payload = { ...serverPayload };
    for (const [key, value] of Object.entries(clientPayload)) {
      if (!conflictFields.has(key)) payload[key] = value;
    }
  } else {
    payload = clientPayload;
  }
  const patch = { ...(payload || {}) } as Record<string, unknown>;
  delete patch.id;
  delete patch.user_id;
  delete patch.version;
  delete patch.created_at;
  delete patch.updated_at;
  const { data, error } = await authClient
    .from(table)
    .update(patch)
    .eq("id", conflict.entity_id)
    .eq("user_id", user.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { error: markError } = await admin
    .from("life_os_sync_conflicts")
    .update({ status: "resolved", resolution, resolved_payload: data, resolved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (markError) return NextResponse.json({ error: markError.message }, { status: 500 });
  invalidateUserContext(user.id);
  return NextResponse.json({ ok: true, resolution, record: data });
}
