import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin, assertJsonSize } from "@/lib/security";
import { isClientNewer, mergeIfSafe, safeStrategy, type ConflictStrategy } from "@/lib/sync/conflict";
import { invalidateUserContext } from "@/lib/ai/contextCache";

export const dynamic = "force-dynamic";

const ALLOWED: Record<string, { table: string; create: boolean; update: boolean; remove: boolean }> = {
  task: { table: "tasks", create: true, update: true, remove: true },
  schedule: { table: "schedule_blocks", create: true, update: true, remove: true },
  project: { table: "projects", create: true, update: true, remove: true },
  goal: { table: "goals", create: true, update: true, remove: true },
  note: { table: "brain_dump_notes", create: true, update: true, remove: true },
  inbox: { table: "smart_inbox_items", create: true, update: true, remove: true },
  reminder: { table: "reminders", create: true, update: true, remove: true },
  memory: { table: "user_memories", create: true, update: true, remove: true },
  subtask: { table: "subtasks", create: true, update: true, remove: true },
  milestone: { table: "goal_milestones", create: true, update: true, remove: true },
  decision: { table: "decisions", create: true, update: true, remove: true },
  skill: { table: "skills", create: true, update: true, remove: true },
  expense: { table: "expenses", create: true, update: true, remove: true },
  income: { table: "incomes", create: true, update: true, remove: true },
  subscription: { table: "subscriptions", create: true, update: true, remove: true },
  sleep: { table: "sleep_logs", create: true, update: true, remove: true },
  hydration: { table: "hydration_logs", create: true, update: true, remove: true },
  caffeine: { table: "caffeine_logs", create: true, update: true, remove: true },
  meal: { table: "meal_logs", create: true, update: true, remove: true },
  medication: { table: "medication_logs", create: true, update: true, remove: true },
  fatigue: { table: "fatigue_logs", create: true, update: true, remove: true },
  movement: { table: "movement_logs", create: true, update: true, remove: true },
  healthMetric: { table: "health_metrics", create: true, update: true, remove: true },
  pomodoro: { table: "pomodoro_sessions", create: true, update: true, remove: true },
  habit: { table: "habits", create: true, update: true, remove: true },
  habitCheckin: { table: "habit_checkins", create: true, update: true, remove: true },
  reading: { table: "reading_logs", create: true, update: true, remove: true },
  readingSession: { table: "reading_sessions", create: true, update: true, remove: true },
  relation: { table: "social_relations", create: true, update: true, remove: true },
  interaction: { table: "social_interactions", create: true, update: true, remove: true },
  budget: { table: "budgets", create: true, update: true, remove: true },
  account: { table: "accounts", create: true, update: true, remove: true },
  accountTransfer: { table: "account_transfers", create: true, update: true, remove: true },
  automation: { table: "automations", create: true, update: true, remove: true },
  vault: { table: "vault_items", create: true, update: true, remove: true },
  link: { table: "life_os_entity_links", create: true, update: true, remove: true },
};

const RESERVED = new Set(["id", "user_id", "version", "created_at", "updated_at", "deleted_at"]);

function sanitizePayload(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!RESERVED.has(key)) out[key] = value;
  }
  return out;
}

async function writeMutationStatus(admin: ReturnType<typeof createAdminClient>, mutationId: string, userId: string, patch: Record<string, unknown>) {
  await admin.from("life_os_sync_mutations").update({ ...patch, updated_at: new Date().toISOString() }).eq("mutation_id", mutationId).eq("user_id", userId);
}

async function createConflict(admin: ReturnType<typeof createAdminClient>, input: {
  userId: string;
  deviceId: string;
  mutationId: string;
  entityType: string;
  entityId: string;
  strategy: ConflictStrategy;
  clientVersion: number | null;
  serverVersion: number;
  clientPayload: Record<string, unknown>;
  serverPayload: Record<string, unknown>;
  conflictingFields: string[];
}) {
  const { data } = await admin.from("life_os_sync_conflicts").upsert({
    user_id: input.userId,
    device_id: input.deviceId,
    mutation_id: input.mutationId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    strategy: input.strategy,
    client_version: input.clientVersion,
    server_version: input.serverVersion,
    client_payload: input.clientPayload,
    server_payload: input.serverPayload,
    conflicting_fields: input.conflictingFields,
    status: "open",
  }, { onConflict: "user_id,mutation_id" }).select("id").single();
  return data?.id ? String(data.id) : null;
}

async function getServerChangedFields(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  entityType: string,
  entityId: string,
  baseVersion: number,
  serverVersion: number,
): Promise<{ fields: string[]; historyComplete: boolean }> {
  const { data, error } = await admin
    .from("life_os_sync_events")
    .select("sequence,payload,changed_fields")
    .eq("user_id", userId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("sequence", { ascending: true })
    .limit(200);

  if (error || !data?.length) return { fields: [], historyComplete: false };

  const postBase = data.filter((event) => Number((event.payload as Record<string, unknown> | null)?.version ?? 0) > baseVersion);
  if (!postBase.length) return { fields: [], historyComplete: false };

  const versions = data.map((event) => Number((event.payload as Record<string, unknown> | null)?.version ?? 0)).filter((version) => Number.isFinite(version) && version > 0);
  const latestKnownVersion = versions.length ? Math.max(...versions) : 0;
  const hasBaseVersion = baseVersion === 0 || versions.includes(baseVersion);
  const historyComplete = hasBaseVersion && latestKnownVersion >= serverVersion;
  const fields = [...new Set(postBase.flatMap((event) => Array.isArray(event.changed_fields) ? event.changed_fields.map(String) : []))];
  return { fields, historyComplete };
}



export async function POST(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const sizeError = assertJsonSize(req, 1_000_000);
  if (sizeError) return sizeError;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const admin = createAdminClient();

  const body = await req.json().catch(() => ({}));
  const mutationId = String(body?.mutationId || randomUUID()).trim().slice(0, 180);
  const deviceId = String(body?.deviceId || "unknown").trim().slice(0, 160);
  const entityType = String(body?.entityType || "").trim();
  const operation = String(body?.operation || "create").trim();
  const payload = sanitizePayload(body?.payload);
  const entityId = body?.entityId ? String(body.entityId) : "";
  const baseVersion = body?.baseVersion == null ? null : Number(body.baseVersion);
  const clientUpdatedAt = body?.clientUpdatedAt ? String(body.clientUpdatedAt) : null;
  const conflictStrategy = safeStrategy(body?.conflictStrategy);
  const definition = ALLOWED[entityType];
  const supported = definition && ((operation === "create" && definition.create) || (operation === "update" && definition.update && entityId) || (operation === "delete" && definition.remove && entityId));
  if (!supported) return NextResponse.json({ error: "Mutation belum didukung untuk operasi ini." }, { status: 400 });

  const { data: existing } = await admin.from("life_os_sync_mutations").select("mutation_id,status,response,error_message,created_at,updated_at").eq("mutation_id", mutationId).eq("user_id", user.id).maybeSingle();
  if (existing?.status === "done") return NextResponse.json({ ok: true, replayed: true, response: existing.response ?? null });
  let reclaimed = false;
  if (existing?.status === "processing") {
    const staleBefore = new Date(Date.now() - 5 * 60_000).toISOString();
    const { data: claimed } = await admin.from("life_os_sync_mutations").update({ updated_at: new Date().toISOString() }).eq("mutation_id", mutationId).eq("user_id", user.id).eq("status", "processing").lt("updated_at", staleBefore).select("mutation_id").maybeSingle();
    if (claimed?.mutation_id === mutationId) reclaimed = true;
    else {
      const { data: current } = await admin.from("life_os_sync_mutations").select("status,response").eq("mutation_id", mutationId).eq("user_id", user.id).maybeSingle();
      if (current?.status === "done") return NextResponse.json({ ok: true, replayed: true, response: current.response ?? null });
      return NextResponse.json({ ok: false, pending: true }, { status: 409 });
    }
  }

  const { error: claimError } = reclaimed ? { error: null } : await admin.from("life_os_sync_mutations").insert({
    mutation_id: mutationId,
    user_id: user.id,
    device_id: deviceId,
    entity_type: entityType,
    entity_id: entityId || null,
    operation,
    payload,
    status: "processing",
  });
  if (claimError) {
    const retry = await admin.from("life_os_sync_mutations").select("status,response,error_message").eq("mutation_id", mutationId).eq("user_id", user.id).maybeSingle();
    if (retry.data?.status === "done") return NextResponse.json({ ok: true, replayed: true, response: retry.data.response ?? null });
    if (retry.data?.status === "processing") return NextResponse.json({ ok: false, pending: true }, { status: 409 });
    return NextResponse.json({ error: claimError.message }, { status: 500 });
  }

  try {
    let data: any = null;
    let response: any;

    if (operation === "create") {
      if (entityType === "accountTransfer") {
        const fromId = String(payload.from_account_id || "");
        const toId = String(payload.to_account_id || "");
        const amount = Number(payload.amount);
        if (!fromId || !toId || fromId === toId || !Number.isFinite(amount) || amount <= 0) {
          throw new Error("Transfer tidak valid. Sumber, tujuan, dan jumlah wajib benar.");
        }
        const { data: ownedAccounts, error: accountError } = await supabase
          .from("accounts")
          .select("id")
          .eq("user_id", user.id)
          .in("id", [fromId, toId]);
        if (accountError) throw new Error(accountError.message);
        if ((ownedAccounts ?? []).length !== 2) throw new Error("Sumber dan tujuan transfer harus merupakan dompet milik pengguna.");

        const { data: transferResult, error: transferError } = await supabase.rpc("licia_transfer_money", {
          p_from_account_id: fromId,
          p_to_account_id: toId,
          p_amount: amount,
          p_note: payload.note ?? null,
          p_occurred_at: payload.occurred_at ? String(payload.occurred_at) : new Date().toISOString(),
        });
        if (transferError) throw new Error(transferError.message);
        data = transferResult;
        response = transferResult;
      } else {
        const record = { ...(entityId ? { id: entityId } : {}), ...payload, user_id: user.id };
        const result = await supabase.from(definition.table).insert(record).select("*").single();
        if (result.error) throw new Error(result.error.message);
        data = result.data;
        response = { entityType, entityId: data?.id ?? null, record: data };
      }
    } else {
      const currentResult = await supabase.from(definition.table).select("*").eq("id", entityId).eq("user_id", user.id).maybeSingle();
      if (currentResult.error) throw new Error(currentResult.error.message);
      if (!currentResult.data) {
        const responseBody = { error: "Data target tidak ditemukan.", mutationId };
        await writeMutationStatus(admin, mutationId, user.id, { status: "failed", error_message: "TARGET_NOT_FOUND", response: responseBody, completed_at: new Date().toISOString() });
        return NextResponse.json(responseBody, { status: 404 });
      }
      const current = currentResult.data as Record<string, unknown>;
      const serverVersion = Number(current.version || 1);

      if (baseVersion != null && Number.isFinite(baseVersion) && serverVersion !== baseVersion) {
        const currentUpdatedAt = current.updated_at ? String(current.updated_at) : null;
        const history = conflictStrategy === "smart"
          ? await getServerChangedFields(admin, user.id, entityType, entityId, Number(baseVersion), serverVersion)
          : { fields: [], historyComplete: false };
        const merged = mergeIfSafe({ current, incoming: payload, clientVersion: baseVersion, serverVersion, clientUpdatedAt }, history.historyComplete ? history.fields : null);
        let allow = false;
        let resolvedPayload = payload;

        if (conflictStrategy === "latest") {
          allow = isClientNewer(clientUpdatedAt, currentUpdatedAt);
        } else if (conflictStrategy === "smart" && history.historyComplete && merged.safe) {
          allow = true;
          resolvedPayload = merged.payload;
        }

        if (!allow) {
          const conflictId = await createConflict(admin, {
            userId: user.id,
            deviceId,
            mutationId,
            entityType,
            entityId,
            strategy: conflictStrategy,
            clientVersion: Number.isFinite(baseVersion) ? baseVersion : null,
            serverVersion,
            clientPayload: payload,
            serverPayload: current,
            conflictingFields: merged.fields,
          });
          const responseBody = { conflict: true, conflictId, current, serverVersion, clientVersion: baseVersion, conflictingFields: merged.fields, strategy: conflictStrategy, smartMerge: history.historyComplete ? "available" : "unavailable" };
          await writeMutationStatus(admin, mutationId, user.id, { status: "failed", error_message: "SYNC_CONFLICT", response: responseBody, completed_at: new Date().toISOString() });
          return NextResponse.json({ ok: false, ...responseBody }, { status: 409 });
        }

        const patch = resolvedPayload;
        if (operation === "update") {
          const result = await supabase.from(definition.table).update(patch).eq("id", entityId).eq("user_id", user.id).select("*").single();
          if (result.error) throw new Error(result.error.message);
          data = result.data;
          response = { entityType, entityId, record: data, conflictResolved: true, strategy: conflictStrategy };
        }
      } else if (operation === "update") {
        const result = await supabase.from(definition.table).update(payload).eq("id", entityId).eq("user_id", user.id).select("*").single();
        if (result.error) throw new Error(result.error.message);
        data = result.data;
        response = { entityType, entityId, record: data };
      }

      if (operation === "delete") {
        const result = await supabase.from(definition.table).delete().eq("id", entityId).eq("user_id", user.id).select("id").maybeSingle();
        if (result.error) throw new Error(result.error.message);
        response = { entityType, entityId, deleted: true, record: result.data ?? null };
      }
    }

    invalidateUserContext(user.id);
    await writeMutationStatus(admin, mutationId, user.id, { status: "done", response, completed_at: new Date().toISOString(), error_message: null });
    return NextResponse.json({ ok: true, replayed: false, response });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mutation gagal.";
    await writeMutationStatus(admin, mutationId, user.id, { status: "failed", error_message: message, completed_at: new Date().toISOString() });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
