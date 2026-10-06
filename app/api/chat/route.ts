// FASE 2 rebuild marker: keep deployment source in sync after CRUD resolver cleanup.
import { NextResponse } from "next/server";

import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateProfile } from "@/lib/getOrCreateProfile";
import { buildSystemPrompt, AiMode } from "@/lib/ai/systemPrompt";
import { languageDirective, languageFromCookieHeader } from "@/lib/ai/language";
import { toolDefs, executeTool } from "@/lib/ai/tools";
import { emitProgress, streamChatResponse, toolLabel } from "@/lib/ai/progress";
import { buildConnectedContext } from "@/lib/ai/context";
import { buildActionableContext } from "@/lib/ai/contextEngine";
import { selectAiModel, selectAiToolModel } from "@/lib/ai/modelRouter";
import { recordAiUsage, checkDailyQuota } from "@/lib/ai/usage";
import { detectAiDomains, selectToolDefs, selectReadToolDefs, selectMutationToolDefs, getDomainToolNames, type AiDomain } from "@/lib/ai/toolRouting";
import { buildTemporalGuard } from "@/lib/ai/temporalGuard";
import { chatCompletion, chatCompletionWithFallback, generationOptions, logCompletionFinish, withOpenAIRetry } from "@/lib/ai/runtime";
import { assertJsonSize, enforceSameOrigin, rateLimit } from "@/lib/security";
import { buildUndoRecord, captureBeforeAction } from "@/lib/ai/actionHistory";
import { loadLatestUndoableAction, undoActionGroup } from "@/lib/ai/actionUndo";
import { detectReminderContinuity } from "@/lib/ai/reminderContinuity";
import { dateStrInTimezone, formatDateTimeInTimezone, formatTimeInTimezone } from "@/lib/date";
import { invalidateUserContext } from "@/lib/ai/contextCache";
import { LICIA_AGENT_POLICY, agentConfidenceFromResult, agentRiskForTool, isMutationToolName } from "@/lib/v35/agent";
import { buildVisionSchedulePrompt, normalizeVisionScheduleBlocks, weekdayFromDate, type VisionScheduleBlock } from "@/lib/ai/visionSchedule";
import { verifyMutationResult } from "@/lib/v35/verify";
import { buildConversationDecision, type ConversationState } from "@/lib/ai/conversationIntelligence";
import { resolveActionScope } from "@/lib/ai/actionScope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Core Life OS discovery tools intentionally remain available to the chat runtime.
const AI_CORE_TOOL_NAMES = ["get_unified_life_snapshot", "get_life_module_data", "search_life_os", "get_life_os_capabilities"] as const;
void AI_CORE_TOOL_NAMES;

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (openaiClient) return openaiClient;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY belum dikonfigurasi di server.");
  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}
async function readServerChatHistory(supabase: any, userId: string): Promise<RawMsg[]> {
  try {
    const result = await supabase
      .from("ai_chat_messages")
      .select("role,content,created_at")
      .eq("user_id", userId)
      .eq("conversation_id", "default")
      .order("created_at", { ascending: false })
      .limit(20);
    if (result.error || !Array.isArray(result.data)) return [];
    return [...result.data]
      .reverse()
      .filter((row: any) => (row?.role === "user" || row?.role === "assistant") && typeof row?.content === "string" && row.content.trim())
      .map((row: any) => ({ role: row.role, content: row.content })) as RawMsg[];
  } catch {
    // Database migration is optional for backward compatibility.
    return [];
  }
}

async function saveServerChatTurn(
  supabase: any,
  userId: string,
  role: "user" | "assistant",
  content: string,
  turnId?: string | null,
  metadata: Record<string, unknown> = {},
) {
  const text = String(content || "").trim();
  if (!text) return;
  try {
    const normalizedTurnId = typeof turnId === "string" && turnId.trim() ? turnId.trim().slice(0, 120) : null;
    if (normalizedTurnId) {
      const existing = await supabase.from("ai_chat_messages")
        .select("id")
        .eq("user_id", userId)
        .eq("conversation_id", "default")
        .eq("turn_id", normalizedTurnId)
        .eq("role", role)
        .maybeSingle();
      if (existing.data?.id) return;
    }
    await supabase.from("ai_chat_messages").insert({
      user_id: userId,
      conversation_id: "default",
      turn_id: normalizedTurnId,
      role,
      content: text.slice(0, 12000),
      metadata,
    });
  } catch {
    // Keep chat usable when migration has not been applied yet.
  }
}

const MAX_TOOL_ITERATIONS = 8;
const MAX_VISION_TOOL_ITERATIONS = 10;
const MAX_MUTATION_TOOL_ITERATIONS = 10;
const MAX_HISTORY_TURNS = 5;
const MAX_HISTORY_CHARS = 18000;
const MAX_CONTEXT_TURNS_WHEN_SWITCHING = 5;
const MAX_CONTEXT_TURNS_DEFAULT = 5;
const MAX_CONTEXT_TURNS_FOLLOW_UP = 5;
const DELETE_CONFIRM_FIELDS: Record<string, string> = {
  delete_expense: "confirm_expense_id",
  delete_task: "confirm_task_id",
  delete_pomodoro_session: "confirm_session_id",
  delete_schedule_block: "confirm_block_id",
  delete_income: "confirm_income_id",
  delete_budget: "confirm_budget_id",
  delete_health_log: "confirm_log_id",
  delete_account: "confirm_account_id",
  delete_goal: "confirm_goal_id",
  delete_note: "confirm_note_id",
  delete_reading: "confirm_reading_id",
  delete_project: "confirm_project_id",
  delete_memory: "confirm_memory_id",
  delete_habit: "confirm_habit_id",
  delete_subscription: "confirm_subscription_id",
  delete_vault_item: "confirm_vault_id",
  delete_automation: "confirm_automation_id",
  delete_decision: "confirm_decision_id",
  delete_skill: "confirm_skill_id",
  delete_reminder: "confirm_reminder_id",
  delete_notification: "confirm_notification_id",
};

type PendingAction = { tool: string; confirmField: string; id: string; label?: string; createdAt: number; pendingId?: string };
type PendingActionRecord = {
  id: string;
  user_id: string;
  user_text: string;
  timezone: string;
  actions: Array<{ tool?: string; arguments?: string; preview?: string }>;
  status: string;
  expires_at: string;
  created_at?: string;
};

type PendingScheduleImport = {
  source: "vision-schedule";
  createdAt: number;
  blocks: VisionScheduleBlock[];
};

type RawMsg = OpenAI.Chat.Completions.ChatCompletionMessageParam;

async function loadServerPendingAction(
  supabase: any,
  userId: string,
  pendingId: string | null | undefined,
): Promise<PendingActionRecord | null> {
  const id = String(pendingId || "").trim();
  if (!id || !ENTITY_UUID_RE.test(id)) return null;
  const query = await supabase
    .from("ai_pending_actions")
    .select("id,user_id,user_text,timezone,actions,status,expires_at,created_at")
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "pending")
    .maybeSingle();
  if (query.error || !query.data) return null;
  const expiresAt = new Date(String(query.data.expires_at || "")).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    await supabase.from("ai_pending_actions")
      .update({ status: "expired" })
      .eq("id", id)
      .eq("user_id", userId)
      .eq("status", "pending");
    return null;
  }
  return query.data as PendingActionRecord;
}

function publicPendingAction(record: PendingActionRecord, fallback?: PendingAction | null): PendingAction | null {
  const first = Array.isArray(record.actions) ? record.actions[0] : null;
  if (!first?.tool || !first.arguments) return fallback ?? null;
  let args: Record<string, unknown> = {};
  try { args = JSON.parse(first.arguments); } catch {}
  const confirmField = Object.keys(args).find((key) => key.startsWith("confirm_")) || fallback?.confirmField || "";
  const id = typeof args[confirmField] === "string" ? String(args[confirmField]) : fallback?.id || "";
  if (!confirmField || !id) return fallback ?? null;
  return {
    pendingId: record.id,
    tool: String(first.tool),
    confirmField,
    id,
    label: fallback?.label,
    createdAt: Date.parse(String(record.created_at || "")) || Date.now(),
  };
}

function extractMassDeleteExceptions(text: string) {
  const match = String(text || "").match(/\b(?:kecuali|selain|pertahankan)\b(.+)$/i);
  if (!match?.[1]) return [];
  const raw = match[1]
    .replace(/[.!?]+$/g, "")
    .replace(/\b(jangan dihapus|jangan hapus|biarkan|tetap ada)\b/gi, "")
    .trim();
  if (!raw) return [];
  return raw.split(/,|\bdan\b/gi).map((x) => x.trim()).filter((x) => x.length >= 3).slice(0, 5);
}

function mutationApplied(tool: string, result: any) {
  if (!isMutationToolName(tool)) return false;
  if (!result?.ok) return false;
  const status = String(result?.status || "").toLowerCase();
  if (["single_candidate_needs_confirmation", "multiple_candidates", "confirmation_required", "preview", "no_match", "no_changes", "account_required", "already_linked"].includes(status)) return false;
  if (result?.requires_confirmation === true) return false;
  if (isMutationToolName(tool) && result?.verified === false) return false;
  if (tool === "delete_schedule_blocks_bulk" || tool === "delete_tasks_bulk") return Number(result?.count || 0) > 0 && result?.verified !== false;
  if (tool === "delete_all_notifications") return Number(result?.deleted || 0) > 0 && result?.verified !== false;
  if (tool === "delete_all_reminders") return Number(result?.deleted || 0) > 0 && result?.verified !== false;
  if (tool.startsWith("delete_")) return Boolean(result?.deleted || result?.archived || Number(result?.deleted_count || 0) > 0) && result?.verified !== false;
  if (tool === "create_daily_schedule") return Number(result?.created || 0) > 0 && result?.verified !== false;
  if (tool === "log_expenses_batch") return Number(result?.created || 0) > 0 && result?.verified !== false;
  return result?.verified !== false;
}

const ENTITY_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function collectResultEntityIds(result: any): string[] {
  const ids: string[] = [];
  const visit = (value: any, depth = 0) => {
    if (depth > 3 || value == null) return;
    if (typeof value === "object" && typeof value.id === "string" && ENTITY_UUID_RE.test(value.id)) ids.push(value.id);
    if (Array.isArray(value)) { for (const item of value.slice(0, 30)) visit(item, depth + 1); }
    else if (typeof value === "object") { for (const item of Object.values(value).slice(0, 30)) visit(item, depth + 1); }
  };
  visit(result);
  return [...new Set(ids)].slice(0, 12);
}


async function enrichFinanceAccountArgs(supabase: any, userId: string, toolName: string, args: any, userText: string) {
  if (!["log_expense", "log_income", "log_expenses_batch"].includes(toolName) || !userText?.trim()) return args;
  if (args.account_id || args.account_name) return args;
  const { data: accounts, error } = await supabase
    .from("accounts")
    .select("id,name,is_default")
    .eq("user_id", userId);
  if (error || !accounts?.length) return args;

  const normalizedText = userText.toLocaleLowerCase("id-ID");
  const matches = accounts
    .filter((account: any) => {
      const name = String(account.name || "").trim().toLocaleLowerCase("id-ID");
      return name && normalizedText.includes(name);
    })
    .sort((a: any, b: any) => String(b.name).length - String(a.name).length);

  if (matches.length === 1) {
    return { ...args, account_id: matches[0].id, account_name: matches[0].name, _account_inferred_from_text: true };
  }
  return args;
}

function sanitizePendingAction(value: unknown): PendingAction | null {
  if (!value || typeof value !== "object") return null;
  const x = value as Record<string, unknown>;
  const tool = typeof x.tool === "string" ? x.tool : "";
  const id = typeof x.id === "string" ? x.id : "";
  const confirmField = DELETE_CONFIRM_FIELDS[tool];
  const createdAt = Number(x.createdAt);
  if (!confirmField || !id || !Number.isFinite(createdAt) || Date.now() - createdAt > 15 * 60 * 1000) return null;
  return {
    tool,
    confirmField,
    id,
    label: typeof x.label === "string" ? x.label.slice(0, 180) : undefined,
    createdAt,
    pendingId: typeof x.pendingId === "string" && ENTITY_UUID_RE.test(x.pendingId) ? x.pendingId : undefined,
  };
}

function labelCandidate(candidate: any): string {
  if (!candidate || typeof candidate !== "object") return "item ini";
  return String(candidate.title ?? candidate.name ?? candidate.note ?? candidate.memory_key ?? candidate.category ?? candidate.id ?? "item ini").slice(0, 180);
}

function isAllReminderDeleteRequest(text: string) {
  const q = String(text || "").toLocaleLowerCase("id-ID").trim();
  if (!q || /\b(tidak|nggak|gak|jangan|batal|cancel|jangan jadi|tidak jadi)\b/i.test(q)) return false;
  return /\b(hapus|hapuskan|hilangkan|batalkan)\b/i.test(q) && /\b(semua|seluruh|semuanya)\b/i.test(q) && /\b(pengingat|reminder)\b/i.test(q);
}

function hasRecentAllReminderDeletePrompt(history: RawMsg[]) {
  const recent = (history || []).slice(-6).filter((m) => m.role === "assistant");
  return recent.some((m) => {
    const text = typeof m.content === "string" ? m.content : "";
    return /\bsemua\s+(?:pengingat|reminder)|(?:menghapus|hapus|menghapus semua).*?(?:pengingat|reminder)/i.test(text)
      && /\b(ingin|mau|melanjutkan|setuju|lanjut)\b/i.test(text);
  });
}

function isExplicitConfirmation(text: string) {
  const q = String(text || "").trim().toLocaleLowerCase("id-ID");
  if (!q) return false;
  if (/\b(tidak|nggak|gak|jangan|batal|cancel|jangan jadi|tidak jadi)\b/i.test(q)) return false;
  return /^(ya|iya|y|oke|ok|siap|gas|setuju|setujui|konfirmasi|confirm|eksekusi|jalankan|terapkan)(?:[\s.!?,]|$)/i.test(q)
    || /\b(hapus sekarang|lanjut(?:kan)?(?: saja)?|jalankan sekarang|eksekusi sekarang|terapkan sekarang|setujui sekarang)\b/i.test(q);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compactToolResult(value: unknown): unknown {
  const walk = (input: unknown, depth = 0): unknown => {
    if (input == null || typeof input === "number" || typeof input === "boolean") return input;
    if (typeof input === "string") return input.length > 700 ? `${input.slice(0, 700)}…` : input;
    if (depth > 4) return "[data dipadatkan]";
    if (Array.isArray(input)) {
      const items = input.slice(0, 20).map((item) => walk(item, depth + 1));
      if (input.length > 20) items.push(`[+${input.length - 20} item lain]`);
      return items;
    }
    if (typeof input === "object") {
      const entries = Object.entries(input as Record<string, unknown>).slice(0, 30);
      return Object.fromEntries(entries.map(([key, item]) => [key, walk(item, depth + 1)]));
    }
    return String(input);
  };
  return walk(value);
}

function decorateTemporalToolResult(result: any, timezone: string): any {
  if (!result || typeof result !== "object") return result;
  const decorateReminder = (reminder: any) => {
    if (!reminder || typeof reminder !== "object" || !reminder.remind_at) return reminder;
    return {
      ...reminder,
      remind_at_local: reminder.remind_at_local || formatDateTimeInTimezone(reminder.remind_at, timezone),
      remind_time_local: reminder.remind_time_local || formatTimeInTimezone(reminder.remind_at, timezone),
      timezone_label: reminder.timezone_label || timezone,
    };
  };
  const out = { ...result };
  if (out.reminder) out.reminder = decorateReminder(out.reminder);
  if (Array.isArray(out.reminders)) out.reminders = out.reminders.map(decorateReminder);
  if (Array.isArray(out.auto_reminders)) out.auto_reminders = out.auto_reminders.map(decorateReminder);
  return out;
}

function trimToLastTurns(messages: RawMsg[], maxTurns: number): RawMsg[] {
  const turns: RawMsg[][] = [];
  let current: RawMsg[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      if (current.length) turns.push(current);
      current = [m];
    } else current.push(m);
  }
  if (current.length) turns.push(current);
  const flattened = turns.slice(-maxTurns).flat();
  let chars = 0;
  const kept: RawMsg[] = [];
  for (let i = flattened.length - 1; i >= 0; i--) {
    const text = JSON.stringify(flattened[i]);
    chars += text.length;
    if (chars > MAX_HISTORY_CHARS) break;
    kept.unshift(flattened[i]);
  }
  return kept;
}

function buildScheduleRangeHint(message: string, timezone: string, referenceDate: Date): string | null {
  const q = String(message || "").toLowerCase();
  if (!/\bsenin\b.*\b(?:besok|selanjutnya)\b.*\bsabtu\b|\bmulai\b.*\bsenin\b.*\bsampai\b.*\bsabtu\b/i.test(q)) return null;
  const local = dateStrInTimezone(referenceDate, timezone);
  const [y, m, d] = local.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const day = base.getUTCDay(); // 0=Min ... 6=Sab
  const deltaToNextMonday = ((1 - day) + 7) % 7 || 7;
  const monday = new Date(base);
  monday.setUTCDate(monday.getUTCDate() + deltaToNextMonday);
  const saturday = new Date(monday);
  saturday.setUTCDate(saturday.getUTCDate() + 5);
  const fmt = (value: Date) => value.toISOString().slice(0, 10);
  return `RENTANG JADWAL YANG SUDAH DIKONFIRMASI: pengguna meminta mulai Senin besok sampai Sabtu. Dalam ${timezone}, gunakan tanggal ${fmt(monday)} (Senin) sampai ${fmt(saturday)} (Sabtu). Jangan menebak rentang lain. Jika sumbernya gambar jadwal mingguan, buat hanya kelas yang memang ada pada hari di gambar; gunakan SATU create_daily_schedule dengan seluruh blok yang sudah diberi tanggal konkret. Jangan gunakan manage_life_os_data untuk kalender.`;
}

function isSupportedImageDataUrl(value: unknown): value is string {
  return typeof value === "string" && /^data:image\/(png|jpe?g|webp);base64,/i.test(value) && value.length <= 8 * 1024 * 1024;
}

async function analyzeScheduleImageStructured(imageDataUrl: string, userInstruction: string, referenceDate: Date, timezone: string, signal?: AbortSignal) {
  const visionModel = selectAiModel({ text: userInstruction, hasImage: true });
  const prompt = buildVisionSchedulePrompt(userInstruction);
  const completion = await withOpenAIRetry(() => chatCompletion(getOpenAI(), {
    model: visionModel,
    messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: imageDataUrl } }] as any }],
    ...generationOptions(visionModel, 0),
    max_completion_tokens: 2200,
    response_format: { type: "json_object" },
  } as any, { signal }), 2, signal);
  const raw = completion.choices[0]?.message?.content?.trim() || "{}";
  let parsed: any = {};
  try { parsed = JSON.parse(raw); } catch { parsed = {}; }
  return {
    model: visionModel,
    usage: completion.usage,
    source_type: String(parsed?.source_type || "unknown"),
    blocks: normalizeVisionScheduleBlocks(parsed?.blocks, referenceDate, timezone),
    notes: Array.isArray(parsed?.notes) ? parsed.notes.map((x: unknown) => String(x)).filter(Boolean).slice(0, 10) : [],
  };
}

function nextWeekdayDate(referenceDate: Date, timezone: string, targetWeekday: number): string {
  const local = dateStrInTimezone(referenceDate, timezone);
  const [y, m, d] = local.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const current = base.getUTCDay();
  let delta = (targetWeekday - current + 7) % 7;
  if (delta === 0) delta = 7;
  base.setUTCDate(base.getUTCDate() + delta);
  return base.toISOString().slice(0, 10);
}

function buildScheduleDateMapForRange(message: string, timezone: string, referenceDate: Date): Map<string, string> | null {
  const q = String(message || "").toLowerCase();
  const isRequestedRange = /\bmulai\b[\s\S]{0,60}\bsenin\b[\s\S]{0,60}\b(?:besok|selanjutnya|minggu depan)\b[\s\S]{0,60}\bsampai\b[\s\S]{0,30}\bsabtu\b/i.test(q)
    || /\bsenin\b[\s\S]{0,60}\bbesok\b[\s\S]{0,60}\bsabtu\b/i.test(q);
  if (!isRequestedRange) return null;
  const monday = nextWeekdayDate(referenceDate, timezone, 1);
  const [y, m, d] = monday.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const map = new Map<string, string>();
  const names = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];
  for (let i = 0; i < 6; i++) {
    const dt = new Date(base);
    dt.setUTCDate(dt.getUTCDate() + i);
    map.set(names[dt.getUTCDay()], dt.toISOString().slice(0, 10));
  }
  return map;
}

function makePendingScheduleActions(blocks: Array<VisionScheduleBlock & { block_date: string }>) {
  const detail = blocks.slice(0, 8).map((b) => `${b.block_date}${b.weekday ? ` (${b.weekday})` : ""} ${b.start_time}–${b.end_time} ${b.title}`).join(" • ");
  return [{
    tool: "create_daily_schedule",
    arguments: JSON.stringify({ blocks }),
    preview: `Membuat ${blocks.length} agenda dari jadwal gambar: ${detail}${blocks.length > 8 ? " …" : ""}`,
  }];
}

async function analyzeImageFirst(imageDataUrl: string, userInstruction: string, signal?: AbortSignal) {
  const isScheduleImage = /jadwal|schedule|kalender|kelas|kuliah|mata kuliah|meeting|rapat|agenda/i.test(userInstruction || "");
  const scheduleInstruction = isScheduleImage
    ? "\n\nKHUSUS ACARA/JADWAL: cari juga EMAIL KONFIRMASI dan undangan. Ekstrak SETIAP acara dengan tanggal kalender absolut bila tertulis, jam mulai/selesai, judul, lokasi, dan detail penting. Contoh ‘tanggal 2 bulan Oktober tahun 2026’ = 2026-10-02. Jangan menebak tanggal/tahun yang tidak terlihat."
    : "";
  const prompt = `Analisis gambar ini dengan teliti untuk Licia. Instruksi pengguna: ${userInstruction || "Baca dan jelaskan gambar ini."}\n\nTugas: (1) baca teks yang terlihat sedapat mungkin, (2) identifikasi data/objek penting, (3) bedakan fakta yang terlihat dari dugaan, (4) bila ada tabel/daftar/angka, pertahankan struktur per baris secara ringkas, (5) jangan mengarang bagian yang tidak terbaca.${scheduleInstruction}\n\nGunakan Bahasa Indonesia.`;
  const visionModel = selectAiModel({ text: userInstruction, hasImage: true });
  const completion = await withOpenAIRetry(() => chatCompletion(getOpenAI(), {
    model: visionModel,
    messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: imageDataUrl } }] as any }],
    ...generationOptions(visionModel, 0.1),
    max_completion_tokens: 1200,
  }, { signal }), 2, signal);
  return { text: completion.choices[0]?.message?.content?.trim() || "Gambar diterima, tetapi bagian yang terlihat belum cukup jelas untuk dibaca dengan yakin.", usage: completion.usage, model: visionModel };
}

function isMutationTool(tool: string, rawArgs = "") {
  if (tool === "manage_life_os_data") {
    try {
      const args = JSON.parse(rawArgs || "{}");
      return String(args?.operation || "read") !== "read";
    } catch {
      return true;
    }
  }
  return /^(create_|update_|delete_|log_|capture_|save_|checkin_|uncheckin_|clear_|mark_)/.test(tool);
}

function plannedActionDetail(tool: string, rawArgs: string) {
  let args: any = {}; try { args = JSON.parse(rawArgs || "{}"); } catch {}
  const candidate = args.title || args.name || args.category || args.note || args.content || args.source;
  if (typeof candidate === "string" && candidate.trim()) return `${actionLabel(tool, { ok: true })}: ${candidate.trim().slice(0, 100)}`;
  if (tool === "log_expenses_batch" && Array.isArray(args.items)) return `Mencatat ${Math.min(args.items.length, 20)} transaksi dari satu batch`;
  if (tool === "delete_tasks_bulk") {
    const status = typeof args.status === "string" && args.status !== "all" ? ` (${args.status})` : "";
    const keyword = typeof args.keyword === "string" && args.keyword.trim() ? ` yang cocok dengan “${args.keyword.trim()}”` : "";
    return `Menghapus seluruh tugas${status}${keyword} dalam satu operasi`;
  }
  if (args.amount != null) return `${actionLabel(tool, { ok: true })}: Rp ${Number(args.amount).toLocaleString("id-ID")}`;
  return actionLabel(tool, { ok: true });
}

function actionLabel(tool:string, result:any){
  const map:Record<string,string>={
    create_task_with_subtasks:"Membuat tugas",create_task_from_schedule:"Mengubah agenda menjadi tugas",create_task_from_inbox:"Mengubah Inbox menjadi tugas",create_task_from_note:"Mengubah catatan menjadi tugas",create_task_from_project:"Mengubah project menjadi tugas",create_task_from_goal:"Mengubah target menjadi tugas",create_schedule_from_task:"Menjadwalkan tugas",create_schedule_reminder:"Membuat pengingat agenda",update_task:"Memperbarui tugas",update_tasks_bulk:"Memperbarui beberapa tugas",delete_task:"Menghapus tugas",delete_tasks_bulk:"Menghapus banyak tugas",create_project:"Membuat proyek",update_project:"Memperbarui proyek",delete_project:"Menghapus proyek",create_goal:"Membuat target",update_goal:"Memperbarui target",delete_goal:"Menghapus target",log_expense:"Mencatat pengeluaran",update_expense:"Memperbarui pengeluaran",delete_expense:"Menghapus pengeluaran",log_income:"Mencatat pemasukan",update_income:"Memperbarui pemasukan",delete_income:"Menghapus pemasukan",create_daily_schedule:"Membuat agenda",update_schedule_block:"Memperbarui agenda",delete_schedule_block:"Menghapus agenda", delete_schedule_blocks_bulk:"Menghapus banyak agenda",capture_inbox_item:"Menambahkan ke Inbox",create_note:"Membuat catatan",update_note:"Memperbarui catatan",delete_note:"Menghapus catatan",save_memory:"Menyimpan memory",delete_memory:"Menghapus memory",create_vault_item:"Membuat item Vault",update_vault_item:"Memperbarui Vault",delete_vault_item:"Menghapus item Vault",create_automation:"Membuat otomasi",update_automation:"Memperbarui otomasi",delete_automation:"Menghapus otomasi",create_habit:"Membuat rutinitas",update_habit:"Memperbarui rutinitas",checkin_habit:"Check-in rutinitas",create_subscription:"Membuat langganan",update_subscription:"Memperbarui langganan",delete_subscription:"Menghapus langganan",log_decision:"Mencatat keputusan",update_decision:"Memperbarui keputusan",delete_decision:"Menghapus keputusan",create_skill:"Membuat skill",update_skill:"Memperbarui skill",delete_skill:"Menghapus skill",create_reminder:"Membuat pengingat",update_reminder:"Memperbarui pengingat",delete_reminder:"Membatalkan pengingat",get_notifications:"Membaca riwayat notifikasi",delete_notification:"Menghapus notifikasi",delete_all_notifications:"Menghapus semua riwayat notifikasi",mark_notification_read:"Menandai notifikasi terbaca",delete_all_reminders:"Menghapus semua pengingat"};
  return map[tool] || (result?.ok ? "Menjalankan aksi" : "Gagal menjalankan aksi");
}


function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

async function executeAndVerifyMutation({
  supabase,
  userId,
  timezone,
  tool,
  args,
}: {
  supabase: any;
  userId: string;
  timezone: string;
  tool: string;
  args: any;
}) {
  const beforeSnapshot = await captureBeforeAction(supabase, userId, tool, args, timezone);
  let result: any;
  try {
    result = await executeTool({ supabase, userId, timezone }, tool, JSON.stringify(args));
  } catch (error) {
    result = { ok: false, error: error instanceof Error ? error.message : "Aksi gagal karena kesalahan sistem.", retryable: true };
  }
  if (result?.ok && isMutationToolName(tool)) {
    result = await verifyMutationResult(supabase, userId, tool, result, args);
    result.confidence = agentConfidenceFromResult(result);
  }
  result = decorateTemporalToolResult(result, timezone);
  const applied = mutationApplied(tool, result);
  let undoActionId: string | null = null;
  if (applied) {
    invalidateUserContext(userId);
    const undo = buildUndoRecord(tool, result, beforeSnapshot);
    if (undo?.undoable && undo.record_ids?.length) {
      const saved = await supabase.from("ai_action_history").insert({
        user_id: userId,
        batch_id: crypto.randomUUID(),
        tool_name: tool,
        label: actionLabel(tool, result),
        operation: undo.operation,
        table_name: undo.table_name,
        record_ids: undo.record_ids,
        before_snapshot: undo.before_snapshot,
        after_snapshot: undo.after_snapshot,
        undoable: true,
      }).select("id").single();
      if (!saved.error && saved.data?.id) undoActionId = saved.data.id;
    }
  }
  await supabase.from("ai_function_call_logs").insert({
    user_id: userId,
    raw_user_text: "[AI recovery]",
    function_name: tool,
    arguments: JSON.stringify(args),
    status: applied ? "success" : "error",
  });
  return { result, applied, undoActionId };
}

export async function GET(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk (unauthorized)." }, { status: 401 });
  const messages = await readServerChatHistory(supabase, user.id);
  return NextResponse.json({ messages });
}

export async function DELETE(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk (unauthorized)." }, { status: 401 });
  const result = await supabase.from("ai_chat_messages")
    .delete()
    .eq("user_id", user.id)
    .eq("conversation_id", "default");
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/**
 * V55: bila klien mengirim `Accept: text/event-stream` (dan LICIA_CHAT_STREAM tidak "false"),
 * jawaban dikirim sebagai SSE (status → tool_start/tool_done → final). Selain itu perilaku JSON lama tidak berubah.
 */
export async function POST(req: Request) {
  const wantsStream = (req.headers.get("accept") || "").includes("text/event-stream")
    && !/^(0|false|no|off)$/i.test((process.env.LICIA_CHAT_STREAM || "").trim());
  if (!wantsStream) return handleChatPost(req);
  return streamChatResponse(() => handleChatPost(req), req.signal);
}

async function handleChatPost(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const sizeError = assertJsonSize(req, 10 * 1024 * 1024);
  if (sizeError) return sizeError;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk (unauthorized)." }, { status: 401 });
  const gate = rateLimit(`ai-chat:${user.id}`, 30, 60_000);
  if (gate) return gate;
  const quota = await checkDailyQuota(supabase, user.id);
  if (quota) return NextResponse.json({ error: quota.message, quota: { used: quota.used, limit: quota.limit } }, { status: 429 });

  const { message, history: clientHistory, imageDataUrl, clientNowIso, turnId, pendingAction: pendingActionInput, pendingActionId, pendingScheduleImport: pendingScheduleImportInput, mode, responseStyle, conversationState: conversationStateInput } = (await req.json()) as {
    message: string;
    history?: RawMsg[];
    imageDataUrl?: string | null;
    clientNowIso?: string | null;
    turnId?: string | null;
    pendingAction?: unknown;
    pendingActionId?: string | null;
    pendingScheduleImport?: unknown;
    mode?: AiMode;
    responseStyle?: "concise" | "normal" | "detailed";
    conversationState?: ConversationState | null;
  };
  const historyFallback = Array.isArray(clientHistory) ? clientHistory : [];
  const persistedHistory = await readServerChatHistory(supabase, user.id);
  const history = persistedHistory.length ? persistedHistory : historyFallback;
  if ((!message || typeof message !== "string") && !imageDataUrl) return NextResponse.json({ error: "Pesan kosong." }, { status: 400 });
  if (imageDataUrl && !isSupportedImageDataUrl(imageDataUrl)) return NextResponse.json({ error: "Format gambar tidak didukung atau ukurannya terlalu besar. Gunakan PNG, JPG, atau WEBP sampai sekitar 8 MB." }, { status: 400 });

  await saveServerChatTurn(
    supabase,
    user.id,
    "user",
    String(message || (imageDataUrl ? "[Gambar]" : "")),
    typeof turnId === "string" ? turnId.slice(0, 120) : null,
    imageDataUrl ? { hasImage: true } : {},
  );

  const { data: profile } = await supabase.from("users").select("display_name, timezone, preferences").eq("id", user.id).single();
  const resolvedProfile = profile ?? (await getOrCreateProfile(supabase, user.id, user.user_metadata?.display_name));
  const timezone = (resolvedProfile as any)?.timezone ?? "Asia/Jakarta";
  const profilePreferences = ((profile as any)?.preferences || {}) as Record<string, unknown>;
  const confirmBulkActions = profilePreferences.confirmBulkActions !== false;
  const hasExplicitContextMode = typeof profilePreferences.aiContextMode === "string";
  const aiReadAllData = profilePreferences.aiContextMode === "all"
    || (!hasExplicitContextMode && profilePreferences.aiReadAllData === true);
  const aiAutoLink = profilePreferences.aiAutoLink !== false;
  const aiProactive = profilePreferences.aiProactive !== false;
  const aiSuggestActions = profilePreferences.aiSuggestActions !== false;
  const aiConfirmDestructive = profilePreferences.aiConfirmDestructive !== false;
  const aiConfirmMassive = profilePreferences.aiConfirmMassive !== false;
  const clientReference = clientNowIso ? new Date(clientNowIso) : new Date();
  const continuityReference = Number.isFinite(clientReference.getTime()) ? clientReference : new Date();
  let visionSummary = "";
  let visionFailed = false;
  let visionScheduleBlocks: VisionScheduleBlock[] = [];
  if (imageDataUrl) {
    try {
      const visionResult = await analyzeImageFirst(imageDataUrl, message || "Baca dan jelaskan gambar ini.", req.signal);
      visionSummary = visionResult.text;
      await recordAiUsage(supabase, user.id, { model: visionResult.model, endpoint: "vision", usage: visionResult.usage });

      const scheduleImageIntent = /jadwal|kalender|kelas|kuliah|mata kuliah|agenda/i.test(String(message || ""));
      if (scheduleImageIntent) {
        try {
          const structured = await analyzeScheduleImageStructured(imageDataUrl, message || "Baca jadwal/acara pada gambar.", continuityReference, timezone, req.signal);
          visionScheduleBlocks = structured.blocks;
          await recordAiUsage(supabase, user.id, { model: structured.model, endpoint: "vision_schedule_structured", usage: structured.usage });
        } catch (scheduleError) {
          console.error("Licia structured schedule vision failed", scheduleError);
        }
      }
    } catch (error) {
      visionFailed = true;
      console.error("Licia vision preprocessing failed; raw image will be sent to the agent", error);
    }
  }
  const structuredVisionText = visionScheduleBlocks.length
    ? `\n\n[HASIL EKSTRAKSI TERSTRUKTUR DARI GAMBAR — JANGAN MENGARANG]\n${JSON.stringify(visionScheduleBlocks)}`
    : "";
  const effectiveMessage = visionSummary
    ? `${message?.trim() || "Tolong baca dan jelaskan gambar ini."}\n\n[HASIL ANALISIS GAMBAR]\n${visionSummary}${structuredVisionText}`
    : `${message || ""}${structuredVisionText}`;
  const pendingScheduleImport: PendingScheduleImport | null = (() => {
    if (!pendingScheduleImportInput || typeof pendingScheduleImportInput !== "object") return null;
    const x = pendingScheduleImportInput as Record<string, unknown>;
    if (x.source !== "vision-schedule") return null;
    const createdAt = Number(x.createdAt);
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > 15 * 60 * 1000) return null;
    const blocks = normalizeVisionScheduleBlocks(x.blocks, continuityReference, timezone);
    return blocks.length ? { source: "vision-schedule", createdAt, blocks } : null;
  })();
  if (!imageDataUrl && pendingScheduleImport && /\b(mulai|senin|selasa|rabu|kamis|jumat|sabtu|minggu|tanggal|periode)\b/i.test(String(message || ""))) {
    const rangeMap = buildScheduleDateMapForRange(String(message || ""), timezone, continuityReference);
    if (rangeMap) {
      const mappedBlocks = pendingScheduleImport.blocks
        .map((block) => ({
          ...block,
          block_date: block.weekday ? (rangeMap.get(block.weekday) || "") : (block.block_date || ""),
        }))
        .filter((block) => Boolean(block.block_date));
      if (mappedBlocks.length) {
        const dedupe = new Map<string, typeof mappedBlocks[number]>();
        for (const block of mappedBlocks) {
          const key = `${block.block_date}|${block.start_time}|${block.end_time}|${block.title.toLocaleLowerCase("id-ID")}`;
          if (!dedupe.has(key)) dedupe.set(key, block);
        }
        const blocks = [...dedupe.values()];
        const actions = makePendingScheduleActions(blocks);
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        const pendingRecord = {
          user_id: user.id,
          user_text: String(message || "Impor jadwal dari gambar" ).slice(0, 1200),
          timezone,
          actions,
          status: "pending",
          expires_at: expiresAt,
        };
        const saved = await supabase.from("ai_pending_actions").insert(pendingRecord).select("id,expires_at,actions").single();
        if (saved.error || !saved.data?.id) {
          return NextResponse.json({
            reply: "Jadwal sudah terbaca dengan benar, tetapi rencana import belum bisa disimpan untuk konfirmasi. Periksa schema ai_pending_actions dan coba lagi.",
            turnMessages: [{ role: "assistant", content: "Jadwal sudah terbaca dengan benar, tetapi rencana import belum bisa disimpan untuk konfirmasi. Periksa schema ai_pending_actions dan coba lagi." }],
            domains: ["calendar"], pendingAction: null, pendingBulkAction: null, pendingScheduleImport, visionUsed: false, mode: "assistant", actions: [], undoActionId: null,
          }, { status: 409 });
        }
        await supabase.from("ai_action_plans").insert({
          user_id: user.id, title: "Impor jadwal dari gambar", goal: String(message || "Impor jadwal").slice(0, 1000), mode: "preview",
          confidence: 0.9, confidence_reason: "Jadwal berasal dari blok konkret hasil vision/parser dan tetap menunggu konfirmasi pengguna.", evidence: blocks.slice(0, 12).map((b) => ({ sourceType: "vision_schedule", sourceId: null, label: b.title, detail: `${b.block_date} ${b.start_time}–${b.end_time}` })), risk: "normal", actions, result: { pendingActionId: saved.data.id }, expires_at: expiresAt,
        });
        const pendingBulkAction = {
          id: saved.data.id, expiresAt: saved.data.expires_at, actions: saved.data.actions, risk: "normal", confidence: 0.9, requiresConfirmation: true,
        };
        const preview = blocks.map((b) => `• ${b.weekday ? `${b.weekday}, ` : ""}${b.block_date}, ${b.start_time}–${b.end_time}: ${b.title}`).join("\n");
        const reply = `Aku sudah memetakan ${blocks.length} jadwal dari gambar ke tanggal konkret tanpa menebak isi gambar. Periksa dulu daftar berikut sebelum diterapkan:\n\n${preview}`;
        return NextResponse.json({ reply, turnMessages: [{ role: "assistant", content: reply }], domains: ["calendar"], pendingAction: null, pendingBulkAction, pendingScheduleImport: null, visionUsed: false, mode: "assistant", actions: [], undoActionId: null });
      }
    }
  }

  // Jangan membuat batch kalender dari gambar jadwal mingguan yang hanya memiliki
  // nama hari/jam tanpa tanggal konkret. Mencegah AI mengarang tanggal lalu
  // menghasilkan batch yang seluruhnya gagal diterapkan.
  const scheduleImageRequest = Boolean(imageDataUrl) && /jadwal|kalender|kelas|kuliah|agenda/i.test(String(message || ""));
  const hasConcreteScheduleDate = visionScheduleBlocks.some((block) => Boolean(block.block_date))
    || /\b20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b/.test(String(message || ""))
    || /\b\d{1,2}\s+(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+20\d{2}\b/i.test(String(message || ""))
    || /\b(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+20\d{2}\b/i.test(String(message || ""));
  if (scheduleImageRequest && !hasConcreteScheduleDate && /\b(masukkan|catat|buat|tambahkan|jadwalkan)\b/i.test(String(message || ""))) {
    const clarification = visionScheduleBlocks.length
      ? `Aku sudah membaca ${visionScheduleBlocks.length} acara dari gambar, tetapi tanggal kalender yang terlihat belum cukup konkret untuk dimasukkan dengan aman. Beri tanggal/rentangnya, misalnya “mulai Senin besok sampai Sabtu”.`
      : "Aku sudah membaca gambar, tetapi belum menemukan pasangan tanggal + jam acara yang cukup jelas untuk langsung dimasukkan ke kalender. Aku tidak akan menebak detail yang tidak terlihat.";
    const pendingScheduleImport: PendingScheduleImport | null = visionScheduleBlocks.length ? { source: "vision-schedule", createdAt: Date.now(), blocks: visionScheduleBlocks } : null;
    return NextResponse.json({ reply: clarification, turnMessages: [{ role: "assistant", content: clarification }], domains: ["calendar"], pendingAction: null, pendingBulkAction: null, pendingScheduleImport, visionUsed: true, mode: "assistant", actions: [], undoActionId: null });
  }

  // Conversation intelligence intentionally routes from the current user message first.
  // Older history is only used as a small reference window when the message is clearly
  // a follow-up. This prevents a previous calendar topic from contaminating a new
  // finance/task request.
  const recentAssistantMessage = [...(history ?? [])].reverse().find((item) => item?.role === "assistant");
  const recentAssistantText = typeof recentAssistantMessage?.content === "string" ? recentAssistantMessage.content : "";
  const conversationDecision = buildConversationDecision({
    message: String(message || ""),
    state: conversationStateInput || null,
    recentAssistantText,
  });
  const domainsSet = new Set<AiDomain>(conversationDecision.effectiveDomains);
  const imageIntentText = String(message || "").toLowerCase();
  if (imageDataUrl) {
    if (/struk|nota|belanja|pengeluaran|harga|kwitansi|receipt/.test(imageIntentText)) domainsSet.add("finance");
    if (/makanan|menu|kalori|nutrisi|gizi/.test(imageIntentText)) domainsSet.add("health");
    if (/buku|halaman|bacaan|reading/.test(imageIntentText)) domainsSet.add("reading");
    if (/jadwal|kalender|kelas|kuliah|agenda|meeting|rapat/.test(imageIntentText)) domainsSet.add("calendar");
  }
  if (!aiReadAllData && domainsSet.has("all")) { domainsSet.delete("all"); domainsSet.add("overview"); }
  const permissions = (profilePreferences.aiDomainPermissions && typeof profilePreferences.aiDomainPermissions === "object")
    ? profilePreferences.aiDomainPermissions as Record<string, boolean>
    : {};
  const canonicalPermission: Record<string, string[]> = {
    planning: ["tasks", "calendar"],
    goals_projects: ["goals", "projects"],
    knowledge: ["notes", "memory", "vault", "learning", "reading"],
    finance: ["finance"],
    wellbeing: ["health"],
    automation: ["automations", "reminders", "notifications"],
  };
  for (const [group, domains] of Object.entries(canonicalPermission)) {
    if (permissions[group] === false) for (const domain of domains) permissions[domain] = false;
  }
  const allPrivacyDomains: AiDomain[] = ["tasks", "calendar", "goals", "projects", "notes", "memory", "finance", "health", "vault", "learning", "reading"];
  const requestedDomains = domainsSet.has("all") ? allPrivacyDomains : [...domainsSet] as AiDomain[];
  const deniedDomains = requestedDomains.filter((domain) => permissions[domain] === false);
  for (const domain of deniedDomains) domainsSet.delete(domain);
  if (domainsSet.has("all") && deniedDomains.length) {
    domainsSet.delete("all");
    for (const domain of allPrivacyDomains) if (!deniedDomains.includes(domain)) domainsSet.add(domain);
    domainsSet.add("overview");
  }
  if (!domainsSet.size) domainsSet.add("overview");
  const domains = [...domainsSet] as AiDomain[];
  const rawRoutingText = effectiveMessage.trim();
  const confirmationRoutingHint = isExplicitConfirmation(String(message || ""))
    && conversationDecision.mutationExpected
    && conversationDecision.currentOperation !== "read"
    ? ({
        create: " [konfirmasi aksi: buat]",
        update: " [konfirmasi aksi: ubah]",
        delete: " [konfirmasi aksi: hapus]",
        link: " [konfirmasi aksi: hubungkan]",
        plan: " [konfirmasi aksi: jalankan rencana]",
      } as Record<string, string>)[conversationDecision.currentOperation] || " [konfirmasi aksi: jalankan]"
    : "";
  const routingText = rawRoutingText + confirmationRoutingHint;
  const temporalGuard = buildTemporalGuard(effectiveMessage, continuityReference, timezone);
  const preferredMode = typeof profilePreferences.defaultAiMode === "string" ? profilePreferences.defaultAiMode : "assistant";
  const preferredStyle = typeof profilePreferences.aiResponseStyle === "string" ? profilePreferences.aiResponseStyle : "normal";
  const selectedMode: AiMode = ["assistant","planner","analyst","operator","reflector"].includes(mode as string) ? (mode as AiMode) : (["assistant","planner","analyst","operator","reflector"].includes(preferredMode) ? (preferredMode as AiMode) : "assistant");
  const selectedResponseStyle = ["concise","normal","detailed"].includes(responseStyle as string) ? responseStyle as string : (["concise","normal","detailed"].includes(preferredStyle) ? preferredStyle : "normal");
  const legacyPendingAction = sanitizePendingAction(pendingActionInput);
  const requestedPendingId = typeof pendingActionId === "string" && pendingActionId.trim()
    ? pendingActionId.trim()
    : legacyPendingAction?.pendingId || null;
  const serverPendingActionRecord = await loadServerPendingAction(supabase, user.id, requestedPendingId);
  const pendingAction = serverPendingActionRecord
    ? publicPendingAction(serverPendingActionRecord, legacyPendingAction)
    : legacyPendingAction;
  const conversationalUndoIntent = /\b(?:undo|urungkan(?:\s+perubahan)?|batalkan\s+perubahan(?:\s+tadi|\s+terakhir)?|batalkan\s+aksi(?:\s+tadi|\s+terakhir)?|kembalikan\s+perubahan(?:\s+tadi|\s+terakhir)?|pulihkan\s+perubahan(?:\s+tadi|\s+terakhir)?)\b/i.test(String(message || ""));
  if (conversationalUndoIntent) {
    const latest = await loadLatestUndoableAction(supabase, user.id);
    if (latest.error) return NextResponse.json({ error: latest.error }, { status: 500 });
    if (!latest.action) {
      const reply = "Tidak ada perubahan terbaru yang masih bisa dibatalkan.";
      return NextResponse.json({ reply, turnMessages: [{ role: "assistant", content: reply }], domains, pendingAction: null, pendingBulkAction: null, pendingScheduleImport: pendingScheduleImport || null, visionUsed: Boolean(imageDataUrl), mode: selectedMode, actions: [], undoActionId: null });
    }
    const undone = await undoActionGroup(supabase, user.id, latest.action);
    if (undone.ok) invalidateUserContext(user.id);
    const count = undone.results?.length ?? 0;
    const reply = undone.ok
      ? `Perubahan terakhir sudah dibatalkan dan ${count} aksi dikembalikan seperti semula.`
      : `Perubahan belum bisa dibatalkan sepenuhnya. ${undone.results?.find((item: any) => !item.ok)?.error || undone.error || "Pemulihan gagal."}`;
    await saveServerChatTurn(supabase, user.id, "assistant", reply, typeof turnId === "string" ? turnId.slice(0, 120) : null, { domains, mode: selectedMode, verifiedActions: undone.ok ? 1 : 0 });
    return NextResponse.json({
      reply,
      turnMessages: [{ role: "assistant", content: reply }],
      domains,
      pendingAction: null,
      pendingActionId: null,
      pendingBulkAction: null,
      pendingScheduleImport: pendingScheduleImport || null,
      visionUsed: Boolean(imageDataUrl),
      mode: selectedMode,
      actions: undone.results?.map((item: any) => ({ tool: "undo", ok: item.ok, label: item.label })) ?? [],
      undoActionId: null,
      conversationState: { ...conversationDecision.state, activeOperation: "update", updatedAt: Date.now() },
      aiMeta: { model: selectedAiModel, contextMode: aiReadAllData ? "all" : "smart", domains, deniedDomains, temporalGuard: temporalGuard.active, operation: "update", mutationExpected: true, verifiedActions: undone.ok ? 1 : 0, conversationalUndo: true },
    });
  }
  if (pendingAction && /\b(tidak|nggak|gak|jangan|batal|cancel|batalkan)\b/i.test(String(message || ""))) {
    if (pendingAction.pendingId) {
      await supabase.from("ai_pending_actions")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
        .eq("id", pendingAction.pendingId)
        .eq("user_id", user.id)
        .eq("status", "pending");
    }
    const cancelReply = "Oke, tindakan tertunda itu dibatalkan. Tidak ada data yang dihapus.";
    await saveServerChatTurn(supabase, user.id, "assistant", cancelReply, typeof turnId === "string" ? turnId.slice(0, 120) : null);
    return NextResponse.json({
      reply: cancelReply,
      turnMessages: [{ role: "assistant", content: cancelReply }],
      domains: [],
      pendingAction: null,
      pendingActionId: null,
      pendingBulkAction: null,
      pendingScheduleImport: pendingScheduleImport || null,
      visionUsed: Boolean(imageDataUrl),
      mode: "assistant",
      actions: [],
      undoActionId: null,
    });
  }
  const explicitAllReminderRequest = isAllReminderDeleteRequest(message || "");
  const confirmingAllReminderDelete = isExplicitConfirmation(message || "") && hasRecentAllReminderDeletePrompt(history ?? []);

  // Deterministic mass-reminder flow. It never relies on the LLM to infer which
  // reminder IDs should be removed, and a plain "iya hapus" after the preview
  // executes the same verified operation directly.
  if (confirmingAllReminderDelete) {
    const previewOrExecution = await executeAndVerifyMutation({ supabase, userId: user.id, timezone, tool: "delete_all_reminders", args: { confirm: true } });
    const applied = previewOrExecution.applied;
    const deleted = Number(previewOrExecution.result?.deleted || 0);
    const reply = applied
      ? `${deleted} pengingat sudah dihapus.`
      : `Pengingat belum berhasil dihapus. ${previewOrExecution.result?.error || previewOrExecution.result?.message || "Perubahan tidak terverifikasi."}`;
    const finishedAt = new Date().toISOString();
    // Expire any matching pending batch so a stale preview cannot be applied again.
    try {
      const { data: pendings } = await supabase.from("ai_pending_actions").select("id,actions").eq("user_id", user.id).eq("status", "pending").order("created_at", { ascending: false }).limit(8);
      for (const pending of pendings ?? []) {
        const actions = Array.isArray((pending as any)?.actions) ? (pending as any).actions : [];
        if (actions.some((a: any) => a?.tool === "delete_all_reminders")) {
          await supabase.from("ai_pending_actions").update({ status: applied ? "applied" : "cancelled", applied_at: finishedAt, updated_at: finishedAt }).eq("id", pending.id).eq("user_id", user.id).eq("status", "pending");
        }
      }
    } catch {}
    return NextResponse.json({ reply, turnMessages: [{ role: "assistant", content: reply }], domains: ["overview", "reminders"] as any, pendingAction: null, pendingBulkAction: null, pendingScheduleImport: pendingScheduleImport || null, visionUsed: Boolean(imageDataUrl), mode: selectedMode, actions: previewOrExecution.applied ? [{ tool: "delete_all_reminders", ok: true, label: "Menghapus semua pengingat" }] : [{ tool: "delete_all_reminders", ok: false, label: "Menghapus semua pengingat" }], undoActionId: previewOrExecution.undoActionId || null });
  }

  if (explicitAllReminderRequest) {
    const preview = await executeTool({ supabase, userId: user.id, timezone }, "delete_all_reminders", JSON.stringify({ confirm: false }));
    if (!preview?.ok) return NextResponse.json({ error: preview?.error || "Pengingat gagal diperiksa." }, { status: 500 });
    const count = Number(preview.count || 0);
    if (!count) {
      const reply = "Tidak ada pengingat yang tersimpan.";
      return NextResponse.json({ reply, turnMessages: [{ role: "assistant", content: reply }], domains: ["overview", "reminders"] as any, pendingAction: null, pendingBulkAction: null, pendingScheduleImport: pendingScheduleImport || null, visionUsed: Boolean(imageDataUrl), mode: selectedMode, actions: [], undoActionId: null });
    }
    const pending = {
      user_id: user.id,
      user_text: String(message || "").slice(0, 1200),
      timezone,
      actions: [{ tool: "delete_all_reminders", arguments: JSON.stringify({ confirm: true }), preview: `${count} pengingat akan dihapus.` }],
      status: "pending",
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
    const saved = await supabase.from("ai_pending_actions").insert(pending).select("id,expires_at,actions").single();
    const reply = `${preview.message || `Ada ${count} pengingat.`} Mau saya hapus semuanya?`;
    const pendingBulkAction = saved.error ? null : { id: saved.data.id, expiresAt: saved.data.expires_at, actions: saved.data.actions, risk: "destructive", confidence: 0.99, requiresConfirmation: true };
    return NextResponse.json({ reply, turnMessages: [{ role: "assistant", content: reply }], domains: ["overview", "reminders"] as any, pendingAction: null, pendingBulkAction, pendingScheduleImport: pendingScheduleImport || null, visionUsed: Boolean(imageDataUrl), mode: selectedMode, actions: [], undoActionId: null });
  }
  const wantsActionContext = (aiProactive && (domains.includes("overview") || selectedMode !== "assistant" || /\b(analisis|review|evaluasi|rencanakan|prioritas|apa yang harus|saran)\b/i.test(effectiveMessage))) || /\b(buat|buatkan|jadwalkan|atur|rapikan|ubah|hapus|selesaikan|kerjakan|jalankan|ingatkan)\b/i.test(effectiveMessage);
  const selectedAiModel = selectAiModel({ text: effectiveMessage, hasImage: Boolean(imageDataUrl), domains, mode: selectedMode });
  const selectedToolModel = selectAiToolModel({ text: effectiveMessage, hasImage: Boolean(imageDataUrl), domains, mode: selectedMode });
  const connectedContext = await buildConnectedContext(supabase, user.id, timezone, domains);
  const actionableContext = wantsActionContext ? await buildActionableContext(supabase, user.id, timezone) : { signals: [] as any[] };

  const recentAssistantTaskCompletionProposal = /\b(?:tandai|selesaikan|centang|bereskan|complete)\b[\s\S]{0,120}\b(?:selesai|done|beres)\b/i.test(String(recentAssistantText || ""));
  const taskStatusProposal = /\b(?:tandai|selesaikan|centang|bereskan|kembalikan|pulihkan|urungkan)\b[\s\S]{0,180}\b(?:selesai|done|beres|belum\s+selesai|todo|pending)\b/i.test(String(recentAssistantText || ""));
  const taskStatusFollowUp = domains.includes("tasks") && (
    /\b(?:tandai|selesaikan|centang|bereskan|jadikan)\b/i.test(String(message || ""))
    || (isExplicitConfirmation(String(message || "")) && (recentAssistantTaskCompletionProposal || taskStatusProposal))
  );

  function extractTaskTitlesFromText(text: string) {
    return [...String(text || "").matchAll(/(?:^|\n)\s*(?:[-•*])\s*\*\*([^*\n]{2,160})\*\*/g)]
      .map((match) => String(match[1]).trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  const taskStatusSource = isExplicitConfirmation(String(message || "")) && taskStatusProposal
    ? String(recentAssistantText || "")
    : String(message || "");
  const taskScope = resolveActionScope(taskStatusSource, new Date(clientNowIso || Date.now()), timezone);
  const taskStatusTarget = /\b(?:belum\s+selesai|todo|pending|kembali(?:kan)?\s+ke\s+belum)\b/i.test(taskStatusSource)
    ? "todo"
    : "done";

  if (taskStatusFollowUp) {
    let taskIds: string[] = [];
    const activeIds = conversationDecision.state.activeEntityIds.slice(0, 30);

    const confirmationFromProposal = isExplicitConfirmation(String(message || "")) && taskStatusProposal;
    const pluralReference = /\b(keduanya|kedua|dua tugas|semua|semuanya|mereka|yang tadi|tadi)\b/i.test(taskStatusSource);
    const titles = (confirmationFromProposal || pluralReference) ? extractTaskTitlesFromText(recentAssistantText) : [];

    if (titles.length && confirmationFromProposal) {
      const foundRows: any[] = [];
      for (const title of titles) {
        const { data } = await supabase.from("tasks").select("id,title,status,due_at").eq("user_id", user.id).ilike("title", title).limit(5);
        for (const row of data ?? []) {
          if (String(row.title || "").trim().toLocaleLowerCase("id-ID") === title.toLocaleLowerCase("id-ID")) foundRows.push(row);
        }
      }
      const matchesScope = (row: any) => {
        if (taskStatusTarget === "done" && String(row.status || "") === "done") return false;
        if (taskStatusTarget === "todo" && String(row.status || "") !== "done") return false;
        if (!taskScope.explicit || !taskScope.fromIso || !taskScope.toIso) return true;
        const value = new Date(String(row.due_at || "")).getTime();
        if (!Number.isFinite(value)) return false;
        if (taskScope.kind === "after") return value > new Date(taskScope.toIso).getTime();
        if (taskScope.kind === "before") return value <= new Date(taskScope.toIso).getTime();
        return value >= new Date(taskScope.fromIso).getTime() && value <= new Date(taskScope.toIso).getTime();
      };
      taskIds = [...new Map(foundRows.filter(matchesScope).map((row: any) => [String(row.id), true])).keys()].slice(0, 30);
    } else if (taskScope.explicit && taskScope.fromIso && taskScope.toIso) {
      let targetQuery = supabase.from("tasks").select("id,title,status,due_at").eq("user_id", user.id);
      targetQuery = taskStatusTarget === "done" ? targetQuery.neq("status", "done") : targetQuery.eq("status", "done");
      if (taskScope.kind === "after") targetQuery = targetQuery.gt("due_at", taskScope.toIso);
      else if (taskScope.kind === "before") targetQuery = targetQuery.lte("due_at", taskScope.toIso);
      else targetQuery = targetQuery.gte("due_at", taskScope.fromIso).lte("due_at", taskScope.toIso);
      const { data, error } = await targetQuery.order("due_at", { ascending: true, nullsFirst: false }).limit(30);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      taskIds = (data ?? []).map((row: any) => String(row.id)).filter(Boolean);
    } else {
      const titlesForPlural = pluralReference ? extractTaskTitlesFromText(recentAssistantText) : [];
      if (titlesForPlural.length) {
        const found = new Map<string, boolean>();
        for (const title of titlesForPlural) {
          const { data } = await supabase.from("tasks").select("id,title,status").eq("user_id", user.id).ilike("title", title).limit(5);
          for (const row of data ?? []) {
            if (String(row.title || "").trim().toLocaleLowerCase("id-ID") === title.toLocaleLowerCase("id-ID")) found.set(String(row.id), true);
          }
        }
        taskIds = [...found.keys()].slice(0, 30);
      } else if (activeIds.length === 1 || (pluralReference && activeIds.length <= 2)) {
        taskIds = activeIds;
      }
    }

    if (taskIds.length) {
      const execution = await executeAndVerifyMutation({ supabase, userId: user.id, timezone, tool: "update_tasks_bulk", args: { task_ids: taskIds, status: taskStatusTarget } });
      const count = Number(execution.result?.count || 0);
      const label = taskStatusTarget === "done" ? "ditandai selesai" : "dikembalikan menjadi belum selesai";
      const reply = execution.applied
        ? `${count} tugas berhasil ${label} dan sudah diverifikasi.`
        : `Perubahan status belum berhasil diverifikasi. ${String(execution.result?.error || execution.result?.message || "Tidak ada perubahan yang terverifikasi.")}`;
      const returnedState: ConversationState = {
        ...conversationDecision.state,
        activeDomain: "tasks",
        activeOperation: "update",
        activeEntityIds: taskIds,
        activeScope: taskScope,
        lastActionTools: execution.applied ? ["update_tasks_bulk"] : conversationDecision.state.lastActionTools,
        updatedAt: Date.now(),
      };
      await saveServerChatTurn(supabase, user.id, "assistant", reply, typeof turnId === "string" ? turnId.slice(0, 120) : null, { domains: ["tasks"], mode: selectedMode, verifiedActions: execution.applied ? 1 : 0 });
      return NextResponse.json({
        reply, turnMessages: [{ role: "assistant", content: reply }], domains: ["tasks"],
        pendingAction: null, pendingActionId: null, pendingBulkAction: null, pendingScheduleImport: pendingScheduleImport || null,
        visionUsed: Boolean(imageDataUrl), mode: selectedMode,
        actions: [{ tool: "update_tasks_bulk", ok: execution.applied, label: actionLabel("update_tasks_bulk", execution.result) }],
        undoActionId: execution.undoActionId || null, conversationState: returnedState,
        aiMeta: { model: selectedAiModel, contextMode: aiReadAllData ? "all" : "smart", domains: ["tasks"], deniedDomains, temporalGuard: temporalGuard.active, topicSwitched: conversationDecision.topicSwitched, followUp: true, activeDomain: "tasks", operation: "update", mutationExpected: true, verifiedActions: execution.applied ? 1 : 0, actionScope: taskScope.label },
      });
    }
  }
  const intelligenceContext = [
    connectedContext,
    "CONTEXT SINYAL V30 (urut prioritas, gunakan sebagai petunjuk terverifikasi; detail tetap ambil lewat tool):",
    ...actionableContext.signals.slice(0, 8).map((s) => `- ${s.type}: ${s.title} — ${s.reason}`),
  ].join("\n");

  // Deterministic continuity path: a short confirmation like "Oke buatkan" after an
  // explicit reminder request must execute the pending reminder instead of relying on
  // the model to reconstruct the previous turn and rediscover the tool call.
  const continuityReminder = detectReminderContinuity(history ?? [], message || "", timezone, continuityReference);
  const routedTools = selectToolDefs(toolDefs, domains, routingText);
  // Saat pengguna mengaktifkan "Akses seluruh data Life OS", expose seluruh tool BACA
  // agar AI benar-benar dapat menjangkau domain yang tidak disebut secara eksplisit.
  // Tool WRITE tetap dirouting berdasarkan intent supaya token/context tidak membengkak
  // pada pertanyaan biasa.
  const universalReadTools = aiReadAllData ? selectReadToolDefs(toolDefs) : [];
  const pendingTool = pendingAction ? toolDefs.filter((def) => def.function?.name === pendingAction.tool) : [];
  const deniedToolNames = getDomainToolNames(deniedDomains);
  const privacyBroadTools = new Set([
    "get_unified_life_snapshot",
    "get_life_snapshot",
    "get_daily_brain",
    "get_life_module_data",
    "search_life_os",
  ]);
  const temporalTool = temporalGuard.active ? toolDefs.find((def) => def.function?.name === "resolve_calendar_date") : null;
  const selectedTools = [...routedTools, ...universalReadTools, ...(temporalTool ? [temporalTool] : []), ...pendingTool.filter((candidate) => !routedTools.some((t) => t.function?.name === candidate.function?.name))]
    .filter((def, index, all) => all.findIndex((candidate) => candidate.function?.name === def.function?.name) === index)
    .filter((def) => {
      const name = String(def.function?.name || "");
      if (deniedToolNames.has(name)) return false;
      if (deniedDomains.length && privacyBroadTools.has(name)) return false;
      if (deniedDomains.length && name === "manage_life_os_data") return false;
      return true;
    });
  const historyWindow = conversationDecision.topicSwitched ? MAX_CONTEXT_TURNS_WHEN_SWITCHING : conversationDecision.followUp ? MAX_CONTEXT_TURNS_FOLLOW_UP : MAX_CONTEXT_TURNS_DEFAULT;
  const trimmedHistory = trimToLastTurns(history ?? [], historyWindow);

  const newUserMessage: RawMsg = imageDataUrl
    ? {
        role: "user",
        content: [
          { type: "text", text: effectiveMessage || "Tolong baca dan jelaskan gambar ini." },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ] as any,
      }
    : { role: "user", content: message };

  const performedActions: Array<{tool:string;ok:boolean;label:string}> = [];
  const actionBatchId = crypto.randomUUID();
  const undoActionIds: string[] = [];
  let latestActionEntityIds: string[] = [];

  // Vision schedule fast-path: when the image itself contains a concrete date/time
  // and the user explicitly asks to add it to the agenda, do not make the LLM
  // rediscover or re-interpret the extracted event. The structured vision result
  // becomes the source of truth, then the normal calendar tool performs the write.
  const explicitVisionScheduleAction = Boolean(imageDataUrl)
    && /\b(jadwal|kalender|agenda|meeting|interview|appointment|booking|rapat|kelas|kuliah)\b/i.test(String(message || ""))
    && /\b(tambahkan|tambahkan ke agenda|masukkan|masukkan ke kalender|catat|jadwalkan|buat agenda|buatkan agenda|save)\b/i.test(String(message || ""))
    && visionScheduleBlocks.length > 0
    && visionScheduleBlocks.every((block) => Boolean(block.block_date && block.start_time && block.end_time));

  if (explicitVisionScheduleAction) {
    const rawBlocks = visionScheduleBlocks.slice(0, 20).map((block) => ({
      block_date: String(block.block_date),
      weekday: block.weekday || weekdayFromDate(String(block.block_date)) || undefined,
      start_time: block.start_time,
      end_time: block.end_time,
      title: block.title,
      location: block.location || undefined,
      description: block.description || undefined,
    }));

    // Avoid duplicate imports when the same confirmation email/screenshot is sent twice.
    const dates = [...new Set(rawBlocks.map((block) => block.block_date))];
    const { data: existingScheduleRows } = dates.length
      ? await supabase.from("schedule_blocks")
          .select("id,block_date,start_time,end_time,title")
          .eq("user_id", user.id)
          .in("block_date", dates)
          .limit(200)
      : { data: [] as any[] };
    const existingKeys = new Set((existingScheduleRows ?? []).map((row: any) => `${row.block_date}|${String(row.start_time).slice(0, 5)}|${String(row.end_time).slice(0, 5)}|${String(row.title).trim().toLocaleLowerCase("id-ID")}`));
    const blocks = rawBlocks.filter((block) => !existingKeys.has(`${block.block_date}|${block.start_time}|${block.end_time}|${block.title.trim().toLocaleLowerCase("id-ID")}`));
    const skippedDuplicates = rawBlocks.length - blocks.length;

    if (!blocks.length) {
      const existingSummary = rawBlocks.map((block) => `• ${block.block_date} ${block.start_time}–${block.end_time}: ${block.title}`).join("\n");
      const reply = `Agenda dari gambar itu sudah ada di kalender, jadi aku tidak membuat duplikat.\n\n${existingSummary}`;
      return NextResponse.json({ reply, turnMessages: [{ role: "assistant", content: reply }], domains: ["calendar"], pendingAction: null, pendingBulkAction: null, pendingScheduleImport: null, visionUsed: true, mode: "assistant", actions: [], undoActionId: null });
    }

    const before = await captureBeforeAction(supabase, user.id, "create_daily_schedule", { blocks }, timezone);
    let result: any;
    try {
      result = await executeTool({ supabase, userId: user.id, timezone }, "create_daily_schedule", JSON.stringify({ blocks }));
      if (result?.ok) {
        result = await verifyMutationResult(supabase, user.id, "create_daily_schedule", result);
        result.confidence = agentConfidenceFromResult(result);
      }
    } catch (error) {
      console.error("Licia vision schedule import failed", error);
      result = { ok: false, error: error instanceof Error ? error.message : "Agenda gagal dibuat karena kesalahan sistem." };
    }
    const applied = mutationApplied("create_daily_schedule", result);
    performedActions.push({ tool: "create_daily_schedule", ok: applied, label: actionLabel("create_daily_schedule", result) });
    let undoActionId: string | null = null;
    if (applied) {
      invalidateUserContext(user.id);
      const undo = buildUndoRecord("create_daily_schedule", result, before);
      if (undo?.undoable && undo.record_ids?.length) {
        const saved = await supabase.from("ai_action_history").insert({
          user_id: user.id, batch_id: actionBatchId, tool_name: "create_daily_schedule", label: actionLabel("create_daily_schedule", result), operation: undo.operation, table_name: undo.table_name, record_ids: undo.record_ids, before_snapshot: undo.before_snapshot, after_snapshot: undo.after_snapshot, undoable: true,
        }).select("id").single();
        if (!saved.error && saved.data?.id) {
          undoActionIds.push(saved.data.id);
          undoActionId = saved.data.id;
        }
      }
    }
    await supabase.from("ai_function_call_logs").insert({
      user_id: user.id, raw_user_text: message?.trim() || "[gambar]", function_name: "create_daily_schedule", arguments: JSON.stringify({ blocks }), status: applied ? "success" : "error",
    });
    const created = Array.isArray(result?.blocks) ? result.blocks : [];
    const summary = created.map((block: any) => `${block.block_date} ${String(block.start_time).slice(0, 5)}–${String(block.end_time).slice(0, 5)} — ${block.title}`).join("\n");
    const reply = applied
      ? `Siap. Aku membaca tanggal dan jam langsung dari gambar lalu menambahkan ${created.length || blocks.length} agenda ke kalendermu.${skippedDuplicates ? ` ${skippedDuplicates} agenda yang sama sudah ada dan tidak digandakan.` : ""}\n\n${summary || blocks.map((block) => `${block.block_date} ${block.start_time}–${block.end_time} — ${block.title}`).join("\n")}\n\nTidak ada tanggal yang kutebak. Detail penting dari email disimpan sebagai deskripsi agenda.${result?.auto_reminders_created ? ` Pengingat default juga dibuat (${result.auto_reminders_created}).` : ""}`
      : `Aku menemukan acara dan tanggalnya dari gambar, tetapi belum berhasil memasukkannya ke kalender. ${result?.error || "Silakan coba lagi."}`;
    return NextResponse.json({ reply, turnMessages: [{ role: "assistant", content: reply }], domains: ["calendar"], pendingAction: null, pendingBulkAction: null, pendingScheduleImport: null, visionUsed: true, mode: "assistant", actions: performedActions, undoActionId });
  }

  if (continuityReminder) {
    const before = await captureBeforeAction(supabase, user.id, "create_reminder", {}, timezone);
    let reminderResult: any = null;
    try {
      const existing = await supabase.from("reminders")
        .select("id,title,body,remind_at,timezone,target_type,href,status,enabled")
        .eq("user_id", user.id)
        .eq("title", continuityReminder.title)
        .eq("remind_at", continuityReminder.remindAt)
        .in("status", ["pending", "waiting_for_device"])
        .maybeSingle();
      if (existing.data) {
        reminderResult = { ok: true, reminder: existing.data, deduplicated: true };
      } else {
        reminderResult = await executeTool({ supabase, userId: user.id, timezone }, "create_reminder", JSON.stringify({
          title: continuityReminder.title,
          body: continuityReminder.body,
          remind_at: continuityReminder.remindAt,
          href: "/reminders",
          target_type: "custom",
          enabled: true,
        }));
      }
    } catch (error) {
      console.error("Licia reminder continuity failed", error);
      reminderResult = { ok: false, error: "Pengingat tidak berhasil dibuat karena kesalahan sistem." };
    }
    performedActions.push({ tool: "create_reminder", ok: Boolean(reminderResult?.ok), label: actionLabel("create_reminder", reminderResult) });
    if (reminderResult?.ok) {
      invalidateUserContext(user.id);
      const undo = buildUndoRecord("create_reminder", reminderResult, before);
      if (undo?.undoable && undo.record_ids?.length && !reminderResult.deduplicated) {
        await supabase.from("ai_action_history").insert({
          user_id: user.id, batch_id: actionBatchId, tool_name: "create_reminder", label: actionLabel("create_reminder", reminderResult), operation: undo.operation, table_name: undo.table_name, record_ids: undo.record_ids, before_snapshot: undo.before_snapshot, after_snapshot: undo.after_snapshot, undoable: true,
        });
      }
    }
    await supabase.from("ai_function_call_logs").insert({
      user_id: user.id, raw_user_text: message?.trim() || "", function_name: "create_reminder", arguments: JSON.stringify({ title: continuityReminder.title, remind_at: continuityReminder.remindAt }), status: reminderResult?.ok ? "success" : "error",
    });
    const localDisplay = new Date(continuityReminder.remindAt).toLocaleString("id-ID", { timeZone: timezone, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
    const reply = reminderResult?.ok
      ? `Siap. Aku sudah membuat pengingat **${continuityReminder.title}** untuk ${localDisplay}. Pengingat ini tersimpan di Pusat Pengingat dan akan dikirim melalui notifikasi yang tersedia di perangkatmu.`
      : `Aku belum berhasil membuat pengingatnya. ${reminderResult?.error || "Silakan coba lagi."}`;
    return NextResponse.json({ reply, turnMessages: [{ role: "assistant", content: reply }], domains, pendingAction: null, pendingBulkAction: null, pendingScheduleImport: null, visionUsed: Boolean(imageDataUrl), mode: selectedMode, actions: performedActions, undoActionId: null });
  }

  // Deterministic confirmation path: once Licia has shown exactly one destructive
  // candidate, a clear confirmation executes that stored target directly.
  // This prevents the delete tool from being called again without confirm_*_id.
  if (pendingAction && isExplicitConfirmation(message || "")) {
    const tool = pendingAction.tool;
    const storedAction = serverPendingActionRecord?.actions?.[0];
    const argsObject = (() => {
      if (storedAction?.arguments) {
        try { return JSON.parse(storedAction.arguments); } catch {}
      }
      return { [pendingAction.confirmField]: pendingAction.id };
    })();
    const args = JSON.stringify(argsObject);
    const before = await captureBeforeAction(supabase, user.id, tool, argsObject, timezone);
    let result: any;
    try {
      result = await executeTool({ supabase, userId: user.id, timezone }, tool, args);
      if (result?.ok && isMutationToolName(tool)) {
        result = await verifyMutationResult(supabase, user.id, tool, result);
        result.confidence = agentConfidenceFromResult(result);
      }
    } catch (error) {
      console.error(`Licia deterministic confirmation ${tool} failed`, error);
      result = { ok: false, error: error instanceof Error ? error.message : "Aksi gagal karena kesalahan sistem." };
    }
    result = decorateTemporalToolResult(result, timezone);
    const applied = mutationApplied(tool, result);
    performedActions.push({ tool, ok: applied, label: actionLabel(tool, result) });
    if (applied) {
      invalidateUserContext(user.id);
      const undo = buildUndoRecord(tool, result, before);
      if (undo?.undoable && undo.record_ids?.length) {
        const saved = await supabase.from("ai_action_history").insert({
          user_id: user.id, batch_id: actionBatchId, tool_name: tool, label: actionLabel(tool, result), operation: undo.operation, table_name: undo.table_name, record_ids: undo.record_ids, before_snapshot: undo.before_snapshot, after_snapshot: undo.after_snapshot, undoable: true,
        }).select("id").single();
        if (!saved.error && saved.data?.id) undoActionIds.push(saved.data.id);
      }
    }
    await supabase.from("ai_function_call_logs").insert({
      user_id: user.id, raw_user_text: message?.trim() || "", function_name: tool, arguments: args, status: applied ? "success" : "error",
    });
    if (serverPendingActionRecord && applied) {
      await supabase.from("ai_pending_actions")
        .update({ status: "applied", applied_at: new Date().toISOString() })
        .eq("id", serverPendingActionRecord.id)
        .eq("user_id", user.id)
        .eq("status", "pending");
    }
    const displayName = String(resolvedProfile?.display_name || "").trim();
    const candidateLabel = pendingAction.label || "item tersebut";
    const reply = applied
      ? `${displayName ? `${displayName}, ` : ""}${candidateLabel} sudah dihapus.`
      : `${displayName ? `${displayName}, ` : ""}penghapusan ${candidateLabel} belum berhasil. ${result?.error || result?.message || "Target sudah tidak tersedia atau perubahan tidak terverifikasi."}`;
    await saveServerChatTurn(supabase, user.id, "assistant", reply, typeof turnId === "string" ? turnId.slice(0, 120) : null, { domains, mode: selectedMode, verifiedActions: applied ? 1 : 0 });
    return NextResponse.json({ reply, turnMessages: [{ role: "assistant", content: reply }], domains, pendingAction: applied ? null : pendingAction, pendingActionId: applied ? null : (pendingAction?.pendingId || null), pendingBulkAction: null, pendingScheduleImport: pendingScheduleImport || null, visionUsed: Boolean(imageDataUrl), mode: selectedMode, actions: performedActions, undoActionId: undoActionIds.at(-1) || null });
  }

  const messages: RawMsg[] = [
    { role: "system", content: buildSystemPrompt(resolvedProfile?.display_name ?? null, timezone, clientNowIso ?? undefined, intelligenceContext, selectedMode, selectedResponseStyle as any, { aiReadAllData, aiAutoLink, aiProactive, aiSuggestActions, aiConfirmDestructive, aiConfirmMassive, aiDeniedDomains: deniedDomains }) },
    { role: "system", content: `AI ROUTING: model=${selectedAiModel}; contextMode=${aiReadAllData ? "all" : "smart"}; domains=${domains.join(",") || "overview"}. Jangan mengakses domain yang tidak disediakan toolset.` },
    ...(pendingAction ? [{ role: "system", content: `AKSI PENGHAPUSAN TERTUNDA: pengguna sebelumnya sudah melihat kandidat "${pendingAction.label || "item ini"}". Jika pesan sekarang jelas merupakan konfirmasi (mis. "iya", "ya", "hapus", "lanjutkan"), panggil tool ${pendingAction.tool} dengan argumen ${pendingAction.confirmField}=${pendingAction.id}. Jangan mencari kandidat baru kecuali tool gagal atau item sudah tidak ditemukan. Jika pengguna menolak/membatalkan, jangan panggil tool ini.` } as RawMsg] : []),
    { role: "system", content: `${confirmBulkActions || aiConfirmMassive ? "Untuk perubahan yang berpotensi mengubah banyak data sekaligus, verifikasi dulu targetnya dan lakukan secara bertahap." : "Untuk perubahan massal, tetap verifikasi target secara semantik sebelum bertindak."} ${aiConfirmDestructive ? "Penghapusan/perubahan destruktif memerlukan konfirmasi eksplisit untuk target yang ditemukan." : "Penghapusan tetap harus memakai target ID yang jelas dan jangan menghapus item ambigu."} ${aiAutoLink ? "Boleh menghubungkan entitas bila relasinya nyata dan dapat diverifikasi." : "Jangan menghubungkan entitas secara otomatis kecuali diminta."} ${aiSuggestActions ? "Aksi dapat dijalankan ketika instruksi pengguna jelas." : "Jangan melakukan write action kecuali pengguna memberikan instruksi eksplisit."}` },
    { role: "system", content: "ATURAN HAPUS AGENDA MASSAL: jika pengguna meminta menghapus semua/seluruh agenda atau jadwal dengan pengecualian tertentu (misalnya 'hapus semua agenda kecuali interview KEYENCE'), WAJIB gunakan get_schedule untuk memverifikasi target lalu gunakan delete_schedule_blocks_bulk satu kali. Kirim exclude_keywords/exclude_ids untuk item yang harus dipertahankan. Jangan membuat satu delete_schedule_block per agenda dan jangan menyatakan berhasil sampai hasil batch menunjukkan count penghapusan > 0 dan verifikasi selesai." },
    { role: "system", content: LICIA_AGENT_POLICY },
    { role: "system", content: languageDirective(languageFromCookieHeader(req.headers.get("cookie"))) },
    { role: "system", content: conversationDecision.contextInstruction },
    { role: "system", content: [
      `REFERENSI AKTIF: entityIds=${conversationDecision.state.activeEntityIds.join(", ") || "none"}.`,
      `REFERENSI LABEL: ${conversationDecision.state.activeLabels.join(" | ") || "none"}.`,
      `AKSI TERAKHIR: ${conversationDecision.state.lastActionTools.join(", ") || "none"}.`,
      "Jika pengguna merujuk 'yang tadi/itu/ini/sebelumnya', prioritaskan entity ID atau label aktif ini. Jika pesan sekarang jelas berganti topik, jangan memakai referensi lama sebagai target baru.",
    ].join("\n") },
    ...(temporalGuard.active ? [{ role: "system", content: temporalGuard.instruction } as RawMsg] : []),
    { role: "system", content: `ATURAN TAMPIL WAKTU: timezone pengguna adalah ${timezone}. Jangan pernah membaca timestamp ISO berakhiran Z sebagai jam lokal. Untuk jawaban tentang pengingat/agenda, gunakan waktu lokal hasil tool (*_local) atau konversi eksplisit dengan timeZone=${timezone}. Jika tool mengembalikan remind_at 2026-10-02T06:50:00.000Z dalam Asia/Jakarta, waktu yang benar untuk ditampilkan adalah 13:50, bukan 06:50.` },
    ...(visionFailed ? [{ role: "system", content: "Pra-analisis vision tidak tersedia. Gambar asli tetap tersedia pada pesan pengguna; analisis gambar asli secara langsung jika memang diperlukan. Jangan menyatakan gambar gagal dibaca kecuali setelah memeriksanya." } as RawMsg] : []),
    ...trimmedHistory,
    newUserMessage,
  ];
  const scheduleRangeHint = buildScheduleRangeHint(String(message || ""), timezone, continuityReference);
  if (scheduleRangeHint) {
    messages.push({ role: "system", content: scheduleRangeHint });
  }

  const turnMessages: RawMsg[] = [newUserMessage];
  let finalText = "";
  let nextPendingAction: PendingAction | null = pendingAction;
  const toolExecutionCache = new Map<string, { result: any; attempts: number; lastOk: boolean }>();
  let pendingBulkAction: any = null;

  const hasMutationIntent = /\b(buat|buatkan|catat|simpan|tambah|tambahkan|hapus|delete|ubah|update|jadwalkan|pindah|atur|ubah jadi|jadikan|konversi|ingatkan|check[-\s]?in|centang|tandai)\b/i.test(effectiveMessage);
  const iterationLimit = imageDataUrl ? MAX_VISION_TOOL_ITERATIONS : (hasMutationIntent ? MAX_MUTATION_TOOL_ITERATIONS : MAX_TOOL_ITERATIONS);
  for (let i = 0; i < iterationLimit; i++) {
    let completion;
    try {
      completion = await withOpenAIRetry(() => chatCompletionWithFallback(getOpenAI(), {
        model: selectedToolModel,
        messages,
        tools: selectedTools,
        tool_choice: conversationDecision.mutationExpected && !conversationDecision.destructiveIntent && !performedActions.some((action) => action.ok) ? "required" : "auto",
        ...generationOptions(selectedToolModel, 0.2),
        max_completion_tokens: responseStyle === "concise" ? 420 : responseStyle === "detailed" ? 760 : (mode === "planner" || mode === "analyst") ? 900 : 560,
      }, { signal: req.signal }), 2, req.signal);
      logCompletionFinish(completion, "chat-tool");
      await recordAiUsage(supabase, user.id, { model: completion.model || selectedToolModel, endpoint: "chat", usage: completion.usage });
    } catch (error) {
      if (req.signal.aborted || String((error as any)?.name || "") === "AbortError") return new Response(null, { status: 204 });
      const detail = error instanceof Error ? error.message : "Kesalahan layanan AI.";
      console.error("Licia AI completion failed", error);
      if (performedActions.length === 0 && !finalText) {
        return NextResponse.json({
          error: detail.includes("OPENAI_API_KEY")
            ? "Layanan AI belum dikonfigurasi di server. Periksa OPENAI_API_KEY."
            : "Layanan AI tidak dapat dihubungi saat ini. Periksa koneksi server/OpenAI lalu coba lagi."
        }, { status: 503 });
      }
      finalText = "Layanan AI terputus setelah sebagian proses. Perubahan yang sudah berhasil tetap dipertahankan, dan aku tidak meneruskan langkah yang tidak terverifikasi.";
      break;
    }
    const msg = completion.choices[0]?.message;
    if (!msg) break;

    messages.push(msg);
    turnMessages.push(msg);
    if (!msg.tool_calls?.length) {
      finalText = msg.content ?? "";
      break;
    }

    if ((confirmBulkActions || aiConfirmMassive) && !pendingAction) {
      const mutations = msg.tool_calls.filter((call) => isMutationTool(call.function.name, call.function.arguments));
      // delete_all_notifications memiliki konfirmasi eksplisit di tool. Jangan bungkus
      // konfirmasi percakapan itu ke ai_pending_actions, karena batch replay akan
      // mengulang confirm=false dan sengaja ditolak oleh tool.
      const isBulkMutation = mutations.length > 1 || mutations.some((call) => ["log_expenses_batch", "update_tasks_bulk", "delete_tasks_bulk", "delete_schedule_blocks_bulk"].includes(call.function.name));
      if (isBulkMutation) {
        const pending = {
          user_id: user.id,
          user_text: (message || "").slice(0, 1200),
          timezone,
          actions: await Promise.all(mutations.slice(0, 10).map(async (call) => {
            let args: any = {}; try { args = JSON.parse(String(call.function.arguments || "{}")); } catch {}
            args = await enrichFinanceAccountArgs(supabase, user.id, call.function.name, args, message || "");
            if (call.function.name === "delete_schedule_blocks_bulk") {
              const extracted = extractMassDeleteExceptions(message || "");
              if ((!Array.isArray(args.exclude_keywords) || args.exclude_keywords.length === 0) && extracted.length) args.exclude_keywords = extracted;
              args.confirm_all = true;
            }
            const argumentsJson = JSON.stringify(args);
            return { tool: call.function.name, arguments: argumentsJson, preview: plannedActionDetail(call.function.name, argumentsJson) };
          })),
          status: "pending",
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        };
        const saved = await supabase.from("ai_pending_actions").insert(pending).select("id,expires_at,actions").single();
        if (!saved.error && saved.data?.id) {
          const planConfidence = Math.max(0.55, Math.min(0.98, 0.96 - mutations.length * 0.03));
          await supabase.from("ai_action_plans").insert({ user_id: user.id, title: "Rencana tindakan Licia", goal: String(message || "Permintaan pengguna").slice(0, 1000), mode: "preview", confidence: planConfidence, confidence_reason: `Confidence dihitung dari jumlah perubahan (${mutations.length}) dan tingkat risiko tool. Semua perubahan masih menunggu konfirmasi.`, evidence: pending.actions.slice(0, 12).map((a: any) => ({ sourceType: "planned_action", sourceId: null, label: a.tool, detail: a.preview })), risk: mutations.some((call) => agentRiskForTool(call.function.name) === "destructive") ? "destructive" : mutations.length > 3 ? "high" : "normal", actions: pending.actions, result: { pendingActionId: saved.data.id }, expires_at: pending.expires_at });
          pendingBulkAction = {
            id: saved.data.id,
            expiresAt: saved.data.expires_at,
            actions: saved.data.actions,
            risk: mutations.some((call) => agentRiskForTool(call.function.name) === "destructive") ? "destructive" : mutations.length > 3 ? "high" : "normal",
            confidence: Math.max(0.55, Math.min(0.98, 0.96 - mutations.length * 0.03)),
            requiresConfirmation: true,
          };
          finalText = `Aku sudah menyiapkan ${mutations.length} perubahan. Periksa daftar tindakan sebelum diterapkan.`;
          turnMessages.push({ role: "assistant", content: finalText });
          break;
        }
      }
    }

    if (pendingBulkAction) break;

    for (const call of msg.tool_calls) {
      if (finalText) break;
      const rawToolName = String(call.function.name || "");
      let executionToolName = rawToolName;
      let parsedArgs: any = {}; try { parsedArgs = JSON.parse(call.function.arguments || "{}"); } catch {}
      parsedArgs = await enrichFinanceAccountArgs(supabase, user.id, rawToolName, parsedArgs, message || "");

      const activeEntityIds = conversationDecision.state.activeEntityIds;
      const activeDomain = conversationDecision.state.activeDomain;
      const completionRequest = /\b(?:tandai|centang|selesaikan|sudah selesai|jadikan selesai)\b/i.test(String(effectiveMessage || ""));
      const multiTaskReference = activeDomain === "tasks" && activeEntityIds.length > 1 && (
        completionRequest
        || /\b(keduanya|kedua|semua|semuanya|mereka|yang tadi|tadi)\b/i.test(String(message || ""))
        || /\b(keduanya|kedua|dua tugas|semua tugas|selesai)\b/i.test(recentAssistantText)
      );
      if (rawToolName === "update_task" && !parsedArgs.task_id && activeDomain === "tasks" && activeEntityIds.length === 1) {
        parsedArgs.task_id = activeEntityIds[0];
      } else if (rawToolName === "update_task" && !parsedArgs.task_id && multiTaskReference) {
        executionToolName = "update_tasks_bulk";
        parsedArgs = { ...parsedArgs, task_ids: activeEntityIds.slice(0, 30), status: parsedArgs.status || (completionRequest ? "done" : undefined) };
        if (!parsedArgs.status) delete parsedArgs.status;
      }

      const activeIdSpecs: Record<string, { domain: AiDomain; field: string }> = {
        update_schedule_block: { domain: "calendar", field: "block_id" },
        update_expense: { domain: "finance", field: "expense_id" },
        update_income: { domain: "finance", field: "income_id" },
        update_account: { domain: "finance", field: "account_id" },
        update_goal: { domain: "goals", field: "goal_id" },
        update_note: { domain: "notes", field: "note_id" },
        update_reading: { domain: "reading", field: "reading_id" },
        update_project: { domain: "projects", field: "project_id" },
        update_vault_item: { domain: "vault", field: "item_id" },
        update_automation: { domain: "automations", field: "automation_id" },
        update_habit: { domain: "habits", field: "habit_id" },
        update_decision: { domain: "decisions", field: "decision_id" },
        update_skill: { domain: "learning", field: "skill_id" },
        update_reminder: { domain: "reminders", field: "reminder_id" },
        update_subscription: { domain: "subscriptions", field: "subscription_id" },
        mark_notification_read: { domain: "notifications", field: "notification_id" },
        checkin_habit: { domain: "habits", field: "habit_id" },
        uncheckin_habit: { domain: "habits", field: "habit_id" },
      };
      const activeIdSpec = activeIdSpecs[rawToolName];
      if (activeIdSpec && !parsedArgs[activeIdSpec.field] && activeDomain === activeIdSpec.domain && activeEntityIds.length === 1) {
        parsedArgs[activeIdSpec.field] = activeEntityIds[0];
      }

      call.function.arguments = JSON.stringify(parsedArgs);
      const normalizedArgs = JSON.stringify(parsedArgs, Object.keys(parsedArgs).sort());
      const signature = `${executionToolName}:${normalizedArgs}`;
      const cachedExecution = toolExecutionCache.get(signature);
      if (cachedExecution) {
        if (cachedExecution.lastOk) {
          const cachedToolMsg: RawMsg = {
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({
              ...(isRecord(compactToolResult(cachedExecution.result))
                ? (compactToolResult(cachedExecution.result) as Record<string, unknown>)
                : { result: compactToolResult(cachedExecution.result) }),
              _deduplicated: true,
              _instruction: "Aksi identik sebelumnya sudah berhasil. Gunakan hasil ini dan lanjutkan ke langkah berikutnya; jangan ulangi aksi identik lagi."
            })
          };
          messages.push(cachedToolMsg);
          turnMessages.push(cachedToolMsg);
          continue;
        }
        if (cachedExecution.result?.retryable === false) {
          const nonRetryableMsg: RawMsg = {
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({
              ...(isRecord(compactToolResult(cachedExecution.result))
                ? (compactToolResult(cachedExecution.result) as Record<string, unknown>)
                : { result: compactToolResult(cachedExecution.result) }),
              _instruction: "Tool menyatakan kegagalan ini tidak dapat diperbaiki dengan mengulang argumen yang sama. Jangan retry identik; jelaskan batasan/error sebenarnya atau gunakan strategi lain."
            })
          };
          messages.push(nonRetryableMsg);
          turnMessages.push(nonRetryableMsg);
          continue;
        }
        if (cachedExecution.attempts >= 2) {
          const retryBlockedMsg: RawMsg = {
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({
              ok: false,
              code: "TOOL_RETRY_LIMIT",
              error: cachedExecution.result?.error || "Tool gagal dua kali dengan argumen identik.",
              _instruction: "Jangan mengulang panggilan identik. Ubah strategi, periksa data dengan tool baca, atau jelaskan kendala sebenarnya kepada pengguna."
            })
          };
          messages.push(retryBlockedMsg);
          turnMessages.push(retryBlockedMsg);
          continue;
        }
      }
      const beforeSnapshot = await captureBeforeAction(supabase, user.id, executionToolName, parsedArgs, timezone);
      let result: any;
      emitProgress({ type: "tool_start", name: executionToolName, label: toolLabel(executionToolName) });
      try { result = await executeTool({ supabase, userId: user.id, timezone }, executionToolName, call.function.arguments); } catch (error) {
        console.error(`Licia tool ${executionToolName} failed`, error);
        result = { ok: false, error: "Aksi gagal karena kesalahan sistem. Tidak ada asumsi perubahan yang dibuat.", retryable: true };
      }
      emitProgress({ type: "tool_done", name: executionToolName, ok: Boolean(result?.ok) });
      if (result?.ok && isMutationToolName(executionToolName)) {
        result = await verifyMutationResult(supabase, user.id, executionToolName, result, parsedArgs);
        result.confidence = agentConfidenceFromResult(result);
      }
      result = decorateTemporalToolResult(result, timezone);
      const referencedIdsFromResult = collectResultEntityIds(result);
      if (referencedIdsFromResult.length) {
        latestActionEntityIds = uniqueStrings([...latestActionEntityIds, ...referencedIdsFromResult]).slice(-12);
      }
      const applied = mutationApplied(executionToolName, result);
      const awaitingConfirmation = result?.status === "single_candidate_needs_confirmation" || result?.status === "multiple_candidates";
      toolExecutionCache.set(signature, { result, attempts: awaitingConfirmation ? 999 : (cachedExecution?.attempts ?? 0) + 1, lastOk: applied });
      if (isMutationToolName(executionToolName)) {
        performedActions.push({ tool: executionToolName, ok: applied, label: actionLabel(executionToolName, result) });
        if (applied) latestActionEntityIds = uniqueStrings([...latestActionEntityIds, ...collectResultEntityIds(result)]).slice(-12);
      }
      if (applied) {
        invalidateUserContext(user.id);
        const undo = buildUndoRecord(executionToolName, result, beforeSnapshot);
        if (undo?.undoable && undo.record_ids?.length) {
          const saved = await supabase.from("ai_action_history").insert({
            user_id: user.id, batch_id: actionBatchId, tool_name: executionToolName, label: actionLabel(executionToolName, result), operation: undo.operation, table_name: undo.table_name, record_ids: undo.record_ids, before_snapshot: undo.before_snapshot, after_snapshot: undo.after_snapshot, undoable: true,
          }).select("id").single();
          if (!saved.error && saved.data?.id) undoActionIds.push(saved.data.id);
        }
      }
      const confirmField = DELETE_CONFIRM_FIELDS[executionToolName];
      if (confirmField && result?.status === "single_candidate_needs_confirmation" && result?.candidate?.id) {
        const pendingArgs = { [confirmField]: String(result.candidate.id) };
        const pendingPreview = `Konfirmasi ${actionLabel(executionToolName, result)} untuk ${labelCandidate(result.candidate)}.`;
        const pendingExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        const savedPending = await supabase.from("ai_pending_actions").insert({
          user_id: user.id,
          user_text: String(message || "").slice(0, 1200),
          timezone,
          actions: [{ tool: executionToolName, arguments: JSON.stringify(pendingArgs), preview: pendingPreview }],
          status: "pending",
          expires_at: pendingExpiry,
        }).select("id,created_at,expires_at,actions").single();
        const pendingId = !savedPending.error && savedPending.data?.id ? String(savedPending.data.id) : undefined;
        nextPendingAction = {
          ...(pendingId ? { pendingId } : {}),
          tool: call.function.name,
          confirmField,
          id: String(result.candidate.id),
          label: labelCandidate(result.candidate),
          createdAt: Date.now()
        };
        finalText = `Aku menemukan ${labelCandidate(result.candidate)}. Belum dihapus. Katakan "hapus" atau "ya" untuk menghapus target yang sama.`;
        if (pendingId) {
          await supabase.from("ai_action_plans").insert({
            user_id: user.id,
            title: "Konfirmasi tindakan Licia",
            goal: String(message || "Konfirmasi penghapusan").slice(0, 1000),
            mode: "preview",
            confidence: 0.98,
            confidence_reason: "Target tunggal sudah ditemukan; target final disimpan di server dan menunggu konfirmasi eksplisit.",
            evidence: [{ sourceType: "pending_action", sourceId: String(result.candidate.id), label: labelCandidate(result.candidate), detail: pendingPreview }],
            risk: "destructive",
            actions: [{ tool: executionToolName, arguments: JSON.stringify(pendingArgs), preview: pendingPreview }],
            result: { pendingActionId: pendingId },
            expires_at: pendingExpiry,
          });
        }
      } else if (confirmField && result?.status === "multiple_candidates") {
        nextPendingAction = null;
      } else if (confirmField && result?.ok && (result?.deleted || result?.archived)) {
        nextPendingAction = null;
      }
      await supabase.from("ai_function_call_logs").insert({
        user_id: user.id,
        raw_user_text: message?.trim() || (imageDataUrl ? "[gambar]" : ""),
        function_name: executionToolName,
        arguments: call.function.arguments,
        status: isMutationToolName(executionToolName) ? (applied ? "success" : "error") : (result?.ok ? "success" : "error"),
      });
      const toolMsg: RawMsg = { role: "tool", tool_call_id: call.id, content: JSON.stringify(compactToolResult(result)) ?? "{}" };
      messages.push(toolMsg);
      turnMessages.push(toolMsg);
      if (result?.status === "single_candidate_needs_confirmation") break;
    }

    if (finalText) {
      turnMessages.push({ role: "assistant", content: finalText });
      break;
    }

    if (i === iterationLimit - 1 && !finalText) {
      try {
        const synthesis = await withOpenAIRetry(() => chatCompletionWithFallback(getOpenAI(), {
          model: selectedAiModel,
          messages: [...messages, { role: "system", content: "Berikan ringkasan hasil dari tool yang baru saja dijalankan. Jangan panggil tool lagi. Sebutkan apa yang berhasil, apa yang gagal, dan tindakan berikutnya yang relevan." }],
          ...generationOptions(selectedAiModel, 0.2),
          max_completion_tokens: 500,
        }, { signal: req.signal }), 1, req.signal);
        logCompletionFinish(synthesis, "chat-synthesis");
        await recordAiUsage(supabase, user.id, { model: selectedAiModel, endpoint: "chat_synthesis", usage: synthesis.usage });
        finalText = synthesis.choices[0]?.message?.content?.trim() || "Permintaan selesai sebagian. Periksa ringkasan tindakan untuk detail perubahan.";
      } catch {
        finalText = "Permintaan selesai sebagian. Aku sudah menyimpan hasil yang berhasil dan tidak melanjutkan langkah yang tidak terverifikasi.";
      }
      turnMessages.push({ role: "assistant", content: finalText });
    }
  }


  // Reliability guard: a mutation request may never receive a success-shaped answer
  // unless at least one mutation was actually executed and verified. For safe create/
  // update/log requests, attempt one model-driven recovery using mutation-only tools.
  if (req.signal.aborted) return new Response(null, { status: 204 });

  // Bila Licia baru saja menyiapkan konfirmasi (pendingBulkAction / pendingAction baru),
  // perubahan memang BELUM dijalankan karena menunggu persetujuan pengguna. Itu bukan
  // kegagalan: jangan jalankan recovery (yang bisa menebak ID agenda lalu error
  // "Agenda tidak ditemukan") dan jangan timpa teks konfirmasi dengan pesan gagal.
  const awaitingUserConfirmation = Boolean(pendingBulkAction) || Boolean(nextPendingAction && nextPendingAction !== pendingAction);

  if (!awaitingUserConfirmation && conversationDecision.mutationExpected && !conversationDecision.destructiveIntent && !performedActions.some((action) => action.ok)) {
    const recoveryReadTools = selectReadToolDefs(toolDefs).filter((def) => {
      const name = String(def.function?.name || "");
      return !["get_unified_life_snapshot", "get_daily_brain", "get_ai_watchers"].includes(name);
    });
    const recoveryMutationTools = selectMutationToolDefs(toolDefs, domains).filter((def) => {
      const name = String(def.function?.name || "");
      return !name.startsWith("delete_") && name !== "manage_life_os_data";
    });
    const recoveryTools = [...recoveryReadTools, ...recoveryMutationTools]
      .filter((def, index, all) => all.findIndex((candidate) => candidate.function?.name === def.function?.name) === index);
    if (recoveryTools.length) {
      try {
        let recoveryMessages: RawMsg[] = [
          { role: "system", content: [
            "RECOVERY MUTATION LICIA.",
            "Pesan pengguna secara eksplisit meminta perubahan data.",
            "Bila target/UUID mutation belum jelas, lakukan read/search domain yang relevan terlebih dahulu.",
            "Setelah target dan UUID nyata ditemukan, lakukan mutation yang sesuai.",
            "Untuk dua atau lebih tugas yang mendapat perubahan sama, gunakan update_tasks_bulk dengan UUID yang ditemukan.",
            "Jangan menebak UUID atau nomor urut.",
            "Jangan menyatakan berhasil tanpa mutation yang benar-benar dieksekusi dan diverifikasi.",
            conversationDecision.contextInstruction,
          ].join("\n") },
          { role: "user", content: String(message || "") },
        ];

        for (let recoveryIteration = 0; recoveryIteration < 3; recoveryIteration += 1) {
          const recovery = await withOpenAIRetry<OpenAI.Chat.Completions.ChatCompletion>(() => chatCompletionWithFallback(getOpenAI(), {
            model: selectedToolModel,
            messages: recoveryMessages,
            tools: recoveryTools,
            tool_choice: "required",
            ...generationOptions(selectedToolModel, 0),
            max_completion_tokens: 420,
          }, { signal: req.signal }), 1, req.signal);
          logCompletionFinish(recovery, "chat-recovery");
          await recordAiUsage(supabase, user.id, { model: selectedToolModel, endpoint: "chat_recovery", usage: recovery.usage });
          const recoveryCall = recovery.choices[0]?.message?.tool_calls?.[0];
          if (!recoveryCall) break;

          let recoveryArgs: any = {};
          try { recoveryArgs = JSON.parse(recoveryCall.function.arguments || "{}"); } catch {}
          recoveryArgs = await enrichFinanceAccountArgs(supabase, user.id, recoveryCall.function.name, recoveryArgs, message || "");

          const isRecoveryMutation = isMutationToolName(recoveryCall.function.name);
          let recoveryResult: any;
          if (isRecoveryMutation) {
            const recovered = await executeAndVerifyMutation({
              supabase,
              userId: user.id,
              timezone,
              tool: recoveryCall.function.name,
              args: recoveryArgs,
            });
            recoveryResult = recovered.result;
            performedActions.push({
              tool: recoveryCall.function.name,
              ok: recovered.applied,
              label: actionLabel(recoveryCall.function.name, recovered.result),
            });
            if (recovered.applied) {
              latestActionEntityIds = uniqueStrings([...latestActionEntityIds, ...collectResultEntityIds(recovered.result)]).slice(-12);
              if (recovered.undoActionId) undoActionIds.push(recovered.undoActionId);
              invalidateUserContext(user.id);
              finalText = `Sudah aku catat dan verifikasi. ${actionLabel(recoveryCall.function.name, recovered.result)}.`;
              break;
            }
          } else {
            recoveryResult = await executeTool(
              { supabase, userId: user.id, timezone },
              recoveryCall.function.name,
              JSON.stringify(recoveryArgs),
            );
          }

          recoveryMessages = [
            ...recoveryMessages,
            { role: "assistant", content: "", tool_calls: [recoveryCall] } as RawMsg,
            { role: "tool", tool_call_id: recoveryCall.id, content: JSON.stringify(compactToolResult(recoveryResult)) },
          ];

          if (isRecoveryMutation && recoveryResult?.error) {
            finalText = `Aku belum bisa menyelesaikannya. ${recoveryResult.error}`;
          }
        }
      } catch (error) {
        if (req.signal.aborted || String((error as any)?.name || "") === "AbortError") return new Response(null, { status: 204 });
        console.error("Licia mutation recovery failed", error);
      }
    }
  }


  // Final honesty guard. A mutation request without a verified action must never
  // be reported as completed, even when a model produced success-like prose.
  if (!awaitingUserConfirmation && conversationDecision.mutationExpected && !performedActions.some((action) => action.ok) && finalText) {
    finalText = `Aku belum berhasil melakukan perubahan itu. ${finalText.replace(/^(sudah|berhasil|siap|sukses|telah)[^.!\n]*[.!]?\s*/i, "").trim() || "Tidak ada perubahan terverifikasi di database."}`;
  }

  if (pendingAction && /\b(tidak|nggak|gak|jangan|batal|cancel)\b/i.test(message || "")) {
    if (pendingAction.pendingId) {
      await supabase.from("ai_pending_actions")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
        .eq("id", pendingAction.pendingId)
        .eq("user_id", user.id)
        .eq("status", "pending");
    }
    nextPendingAction = null;
  }
  if (finalText) {
    await saveServerChatTurn(supabase, user.id, "assistant", finalText, typeof turnId === "string" ? turnId.slice(0, 120) : null, {
      domains,
      mode: selectedMode,
      verifiedActions: performedActions.filter((action) => action.ok).length,
    });
  }
  return NextResponse.json({ reply: finalText, turnMessages: finalText ? [{ role: "assistant", content: finalText }] : [], domains, pendingAction: nextPendingAction, pendingActionId: nextPendingAction?.pendingId || null, pendingBulkAction, pendingScheduleImport: pendingScheduleImport || null, visionUsed: Boolean(imageDataUrl), mode: selectedMode, actions: performedActions.slice(-8), undoActionId: undoActionIds.at(-1) || null, conversationState: { ...conversationDecision.state, activeEntityIds: latestActionEntityIds.length ? latestActionEntityIds : conversationDecision.state.activeEntityIds, lastActionTools: performedActions.some((a) => a.ok) ? performedActions.filter((a) => a.ok).map((a) => a.tool).slice(-8) : conversationDecision.state.lastActionTools }, aiMeta: { model: selectedAiModel, contextMode: aiReadAllData ? "all" : "smart", domains, deniedDomains, temporalGuard: temporalGuard.active, topicSwitched: conversationDecision.topicSwitched, followUp: conversationDecision.followUp, activeDomain: conversationDecision.state.activeDomain, operation: conversationDecision.currentOperation, mutationExpected: conversationDecision.mutationExpected, verifiedActions: performedActions.filter((a) => a.ok).length } });
}
