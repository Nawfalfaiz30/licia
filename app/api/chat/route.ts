import { NextResponse } from "next/server";

import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateProfile } from "@/lib/getOrCreateProfile";
import { buildSystemPrompt, AiMode } from "@/lib/ai/systemPrompt";
import { toolDefs, executeTool } from "@/lib/ai/tools";
import { buildConnectedContext } from "@/lib/ai/context";
import { detectAiDomains, selectToolDefs } from "@/lib/ai/toolRouting";
import { withOpenAIRetry } from "@/lib/ai/runtime";
import { assertJsonSize, enforceSameOrigin, rateLimit } from "@/lib/security";
import { buildUndoRecord, captureBeforeAction } from "@/lib/ai/actionHistory";
import { detectReminderContinuity } from "@/lib/ai/reminderContinuity";

export const runtime = "nodejs";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (openaiClient) return openaiClient;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY belum dikonfigurasi di server.");
  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}
const MAX_TOOL_ITERATIONS = 6;
const MAX_VISION_TOOL_ITERATIONS = 8;
const MAX_HISTORY_TURNS = 4;
const MAX_HISTORY_CHARS = 9000;
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
};

type PendingAction = { tool: string; confirmField: string; id: string; label?: string; createdAt: number };

type RawMsg = OpenAI.Chat.Completions.ChatCompletionMessageParam;

function sanitizePendingAction(value: unknown): PendingAction | null {
  if (!value || typeof value !== "object") return null;
  const x = value as Record<string, unknown>;
  const tool = typeof x.tool === "string" ? x.tool : "";
  const id = typeof x.id === "string" ? x.id : "";
  const confirmField = DELETE_CONFIRM_FIELDS[tool];
  const createdAt = Number(x.createdAt);
  if (!confirmField || !id || !Number.isFinite(createdAt) || Date.now() - createdAt > 15 * 60 * 1000) return null;
  return { tool, confirmField, id, label: typeof x.label === "string" ? x.label.slice(0, 180) : undefined, createdAt };
}

function labelCandidate(candidate: any): string {
  if (!candidate || typeof candidate !== "object") return "item ini";
  return String(candidate.title ?? candidate.name ?? candidate.note ?? candidate.memory_key ?? candidate.category ?? candidate.id ?? "item ini").slice(0, 180);
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

function isSupportedImageDataUrl(value: unknown): value is string {
  return typeof value === "string" && /^data:image\/(png|jpe?g|webp);base64,/i.test(value) && value.length <= 8 * 1024 * 1024;
}

async function analyzeImageFirst(imageDataUrl: string, userInstruction: string) {
  const prompt = `Analisis gambar ini dengan teliti untuk Licia. Instruksi pengguna: ${userInstruction || "Baca dan jelaskan gambar ini."}\n\nTugas: (1) baca teks yang terlihat sedapat mungkin, (2) identifikasi data/objek penting, (3) bedakan fakta yang terlihat dari dugaan, (4) bila ada tabel/daftar/angka, pertahankan struktur secara ringkas. Jangan mengarang bagian yang tidak terbaca. Gunakan Bahasa Indonesia.`;
  const completion = await withOpenAIRetry(() => getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: imageDataUrl } }] as any }],
    temperature: 0.1,
    max_tokens: 1200,
  }), 2);
  return completion.choices[0]?.message?.content?.trim() || "Gambar diterima, tetapi bagian yang terlihat belum cukup jelas untuk dibaca dengan yakin.";
}

function isMutationTool(tool: string) {
  return /^(create_|update_|delete_|log_|capture_|save_|checkin_|uncheckin_)/.test(tool);
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
    create_task_with_subtasks:"Membuat tugas",create_task_from_schedule:"Mengubah agenda menjadi tugas",create_task_from_inbox:"Mengubah Inbox menjadi tugas",create_task_from_note:"Mengubah catatan menjadi tugas",create_task_from_project:"Mengubah project menjadi tugas",create_task_from_goal:"Mengubah target menjadi tugas",create_schedule_from_task:"Menjadwalkan tugas",create_schedule_reminder:"Membuat pengingat agenda",update_task:"Memperbarui tugas",delete_task:"Menghapus tugas",delete_tasks_bulk:"Menghapus banyak tugas",create_project:"Membuat proyek",update_project:"Memperbarui proyek",delete_project:"Menghapus proyek",create_goal:"Membuat target",update_goal:"Memperbarui target",delete_goal:"Menghapus target",log_expense:"Mencatat pengeluaran",update_expense:"Memperbarui pengeluaran",delete_expense:"Menghapus pengeluaran",log_income:"Mencatat pemasukan",update_income:"Memperbarui pemasukan",delete_income:"Menghapus pemasukan",create_daily_schedule:"Membuat agenda",update_schedule_block:"Memperbarui agenda",delete_schedule_block:"Menghapus agenda",capture_inbox_item:"Menambahkan ke Inbox",create_note:"Membuat catatan",update_note:"Memperbarui catatan",delete_note:"Menghapus catatan",save_memory:"Menyimpan memory",delete_memory:"Menghapus memory",create_vault_item:"Membuat item Vault",update_vault_item:"Memperbarui Vault",delete_vault_item:"Menghapus item Vault",create_automation:"Membuat otomasi",update_automation:"Memperbarui otomasi",delete_automation:"Menghapus otomasi",create_habit:"Membuat rutinitas",update_habit:"Memperbarui rutinitas",checkin_habit:"Check-in rutinitas",create_subscription:"Membuat langganan",update_subscription:"Memperbarui langganan",delete_subscription:"Menghapus langganan",log_decision:"Mencatat keputusan",update_decision:"Memperbarui keputusan",delete_decision:"Menghapus keputusan",create_skill:"Membuat skill",update_skill:"Memperbarui skill",delete_skill:"Menghapus skill",create_reminder:"Membuat pengingat",update_reminder:"Memperbarui pengingat",delete_reminder:"Membatalkan pengingat"};
  return map[tool] || (result?.ok ? "Menjalankan aksi" : "Gagal menjalankan aksi");
}

export async function POST(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const sizeError = assertJsonSize(req, 10 * 1024 * 1024);
  if (sizeError) return sizeError;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk (unauthorized)." }, { status: 401 });
  const gate = rateLimit(`ai-chat:${user.id}`, 30, 60_000);
  if (gate) return gate;

  const { message, history, imageDataUrl, clientNowIso, pendingAction: pendingActionInput, mode, responseStyle } = (await req.json()) as {
    message: string;
    history: RawMsg[];
    imageDataUrl?: string | null;
    clientNowIso?: string | null;
    pendingAction?: unknown;
    mode?: AiMode;
    responseStyle?: "concise" | "normal" | "detailed";
  };
  if ((!message || typeof message !== "string") && !imageDataUrl) return NextResponse.json({ error: "Pesan kosong." }, { status: 400 });
  if (imageDataUrl && !isSupportedImageDataUrl(imageDataUrl)) return NextResponse.json({ error: "Format gambar tidak didukung atau ukurannya terlalu besar. Gunakan PNG, JPG, atau WEBP sampai sekitar 8 MB." }, { status: 400 });

  const { data: profile } = await supabase.from("users").select("display_name, timezone, preferences").eq("id", user.id).single();
  const resolvedProfile = profile ?? (await getOrCreateProfile(supabase, user.id, user.user_metadata?.display_name));
  const timezone = (resolvedProfile as any)?.timezone ?? "Asia/Jakarta";
  const profilePreferences = ((profile as any)?.preferences || {}) as Record<string, unknown>;
  const confirmBulkActions = profilePreferences.confirmBulkActions !== false;
  const aiReadAllData = profilePreferences.aiReadAllData !== false;
  const aiAutoLink = profilePreferences.aiAutoLink !== false;
  const aiProactive = profilePreferences.aiProactive !== false;
  const aiSuggestActions = profilePreferences.aiSuggestActions !== false;
  const aiConfirmDestructive = profilePreferences.aiConfirmDestructive !== false;
  const aiConfirmMassive = profilePreferences.aiConfirmMassive !== false;
  let visionSummary = "";
  let visionFailed = false;
  if (imageDataUrl) {
    try {
      visionSummary = await analyzeImageFirst(imageDataUrl, message || "Baca dan jelaskan gambar ini.");
    } catch (error) {
      visionFailed = true;
      console.error("Licia vision preprocessing failed; raw image will be sent to the agent", error);
    }
  }
  const effectiveMessage = visionSummary
    ? `${message?.trim() || "Tolong baca dan jelaskan gambar ini."}\n\n[HASIL ANALISIS GAMBAR]\n${visionSummary}`
    : (message || "");
  const historyText = (history ?? []).map((m: any) => {
    if (typeof m?.content === "string") return m.content;
    if (Array.isArray(m?.content)) return m.content.map((part: any) => typeof part?.text === "string" ? part.text : "").join(" ");
    return "";
  }).join("\n");
  const routingText = `${historyText.slice(-9000)}\n${effectiveMessage}`.trim();
  const domainsSet = new Set(detectAiDomains(routingText));
  const imageIntentText = String(message || "").toLowerCase();
  if (imageDataUrl) {
    if (/struk|nota|belanja|pengeluaran|harga|kwitansi|receipt/.test(imageIntentText)) domainsSet.add("finance");
    if (/makanan|menu|kalori|nutrisi|gizi/.test(imageIntentText)) domainsSet.add("health");
    if (/buku|halaman|bacaan|reading/.test(imageIntentText)) domainsSet.add("reading");
  }
  if (!aiReadAllData && domainsSet.has("all")) { domainsSet.delete("all"); domainsSet.add("overview"); }
  const domains = [...domainsSet];
  const pendingAction = sanitizePendingAction(pendingActionInput);
  const connectedContext = await buildConnectedContext(supabase, user.id, timezone, domains);

  // Deterministic continuity path: a short confirmation like "Oke buatkan" after an
  // explicit reminder request must execute the pending reminder instead of relying on
  // the model to reconstruct the previous turn and rediscover the tool call.
  const clientReference = clientNowIso ? new Date(clientNowIso) : new Date();
  const continuityReference = Number.isFinite(clientReference.getTime()) ? clientReference : new Date();
  const continuityReminder = detectReminderContinuity(history ?? [], message || "", timezone, continuityReference);
  const routedTools = selectToolDefs(toolDefs, domains, routingText);
  const universalReadNames = aiReadAllData ? new Set(["get_unified_life_snapshot", "get_life_module_data", "search_life_os"]) : new Set<string>();
  const universalReadTools = toolDefs.filter((def) => universalReadNames.has(def.function?.name || ""));
  const pendingTool = pendingAction ? toolDefs.filter((def) => def.function?.name === pendingAction.tool) : [];
  const selectedTools = [...routedTools, ...universalReadTools, ...pendingTool.filter((candidate) => !routedTools.some((t) => t.function?.name === candidate.function?.name))].filter((def, index, all) => all.findIndex((candidate) => candidate.function?.name === def.function?.name) === index);
  const trimmedHistory = trimToLastTurns(history ?? [], MAX_HISTORY_TURNS);

  const newUserMessage: RawMsg = imageDataUrl
    ? {
        role: "user",
        content: [
          { type: "text", text: effectiveMessage || "Tolong baca dan jelaskan gambar ini." },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ] as any,
      }
    : { role: "user", content: message };

    const preferredMode = typeof profilePreferences.defaultAiMode === "string" ? profilePreferences.defaultAiMode : "assistant";
  const preferredStyle = typeof profilePreferences.aiResponseStyle === "string" ? profilePreferences.aiResponseStyle : "normal";
  const selectedMode: AiMode = ["assistant","planner","analyst","operator","reflector"].includes(mode as string) ? (mode as AiMode) : (["assistant","planner","analyst","operator","reflector"].includes(preferredMode) ? (preferredMode as AiMode) : "assistant");
  const selectedResponseStyle = ["concise","normal","detailed"].includes(responseStyle as string) ? responseStyle as string : (["concise","normal","detailed"].includes(preferredStyle) ? preferredStyle : "normal");
  const performedActions: Array<{tool:string;ok:boolean;label:string}> = [];
  const actionBatchId = crypto.randomUUID();

  if (continuityReminder) {
    const before = await captureBeforeAction(supabase, user.id, "create_reminder", {});
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
    return NextResponse.json({ reply, turnMessages: [{ role: "assistant", content: reply }], domains, pendingAction: null, pendingBulkAction: null, visionUsed: Boolean(imageDataUrl), mode: selectedMode, actions: performedActions, undoActionId: null });
  }

  const messages: RawMsg[] = [
    { role: "system", content: buildSystemPrompt(resolvedProfile?.display_name ?? null, timezone, clientNowIso ?? undefined, connectedContext, selectedMode, selectedResponseStyle as any, { aiReadAllData, aiAutoLink, aiProactive, aiSuggestActions, aiConfirmDestructive, aiConfirmMassive }) },
    ...(pendingAction ? [{ role: "system", content: `AKSI PENGHAPUSAN TERTUNDA: pengguna sebelumnya sudah melihat kandidat "${pendingAction.label || "item ini"}". Jika pesan sekarang jelas merupakan konfirmasi (mis. "iya", "ya", "hapus", "lanjutkan"), panggil tool ${pendingAction.tool} dengan argumen ${pendingAction.confirmField}=${pendingAction.id}. Jangan mencari kandidat baru kecuali tool gagal atau item sudah tidak ditemukan. Jika pengguna menolak/membatalkan, jangan panggil tool ini.` } as RawMsg] : []),
    { role: "system", content: `${confirmBulkActions || aiConfirmMassive ? "Untuk perubahan yang berpotensi mengubah banyak data sekaligus, verifikasi dulu targetnya dan lakukan secara bertahap." : "Untuk perubahan massal, tetap verifikasi target secara semantik sebelum bertindak."} ${aiConfirmDestructive ? "Penghapusan/perubahan destruktif memerlukan konfirmasi eksplisit untuk target yang ditemukan." : "Penghapusan tetap harus memakai target ID yang jelas dan jangan menghapus item ambigu."} ${aiAutoLink ? "Boleh menghubungkan entitas bila relasinya nyata dan dapat diverifikasi." : "Jangan menghubungkan entitas secara otomatis kecuali diminta."} ${aiSuggestActions ? "Aksi dapat dijalankan ketika instruksi pengguna jelas." : "Jangan melakukan write action kecuali pengguna memberikan instruksi eksplisit."}` },
    ...(visionFailed ? [{ role: "system", content: "Pra-analisis vision tidak tersedia. Gambar asli tetap tersedia pada pesan pengguna; analisis gambar asli secara langsung jika memang diperlukan. Jangan menyatakan gambar gagal dibaca kecuali setelah memeriksanya." } as RawMsg] : []),
    ...trimmedHistory,
    newUserMessage,
  ];
  const turnMessages: RawMsg[] = [newUserMessage];
  let finalText = "";
  let nextPendingAction: PendingAction | null = pendingAction;
  const seenToolCalls = new Set<string>();
  const undoActionIds: string[] = [];
  let pendingBulkAction: any = null;

  const iterationLimit = imageDataUrl ? MAX_VISION_TOOL_ITERATIONS : (/\b(buat|buatkan|catat|simpan|tambah|tambahkan|hapus|delete|ubah|update|jadwalkan|pindah|atur|ubah jadi|jadikan|konversi|ingatkan)\b/i.test(effectiveMessage) ? 10 : MAX_TOOL_ITERATIONS);
  for (let i = 0; i < iterationLimit; i++) {
    let completion;
    try {
      completion = await withOpenAIRetry(() => getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        tools: selectedTools,
        tool_choice: "auto",
        temperature: 0.2,
        max_tokens: responseStyle === "concise" ? 420 : responseStyle === "detailed" ? 760 : 560,
      }), 2);
    } catch (error) {
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
      const mutations = msg.tool_calls.filter((call) => isMutationTool(call.function.name));
      const isBulkMutation = mutations.length > 1 || mutations.some((call) => call.function.name === "log_expenses_batch" || call.function.name === "delete_tasks_bulk");
      if (isBulkMutation) {
        const pending = {
          user_id: user.id,
          user_text: (message || "").slice(0, 1200),
          timezone,
          actions: mutations.slice(0, 10).map((call) => ({ tool: call.function.name, arguments: String(call.function.arguments || "{}"), preview: plannedActionDetail(call.function.name, String(call.function.arguments || "{}")) })),
          status: "pending",
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        };
        const saved = await supabase.from("ai_pending_actions").insert(pending).select("id,expires_at,actions").single();
        if (!saved.error && saved.data?.id) {
          pendingBulkAction = { id: saved.data.id, expiresAt: saved.data.expires_at, actions: saved.data.actions };
          finalText = `Aku sudah menyiapkan ${mutations.length} perubahan. Periksa daftar tindakan sebelum diterapkan.`;
          turnMessages.push({ role: "assistant", content: finalText });
          break;
        }
      }
    }

    if (pendingBulkAction) break;

    for (const call of msg.tool_calls) {
      const signature = `${call.function.name}:${call.function.arguments}`;
      if (seenToolCalls.has(signature)) {
        const toolMsg: RawMsg = { role: "tool", tool_call_id: call.id, content: JSON.stringify({ ok: false, error: "Tool call yang sama sudah dijalankan; pilih langkah berikutnya atau gunakan hasil yang sudah ada." }) };
        messages.push(toolMsg);
        turnMessages.push(toolMsg);
        continue;
      }
      seenToolCalls.add(signature);
      let parsedArgs: any = {}; try { parsedArgs = JSON.parse(call.function.arguments || "{}"); } catch {}
      const beforeSnapshot = await captureBeforeAction(supabase, user.id, call.function.name, parsedArgs);
      let result: any;
      try { result = await executeTool({ supabase, userId: user.id, timezone }, call.function.name, call.function.arguments); } catch (error) {
        console.error(`Licia tool ${call.function.name} failed`, error);
        result = { ok: false, error: "Aksi gagal karena kesalahan sistem. Tidak ada asumsi perubahan yang dibuat." };
      }
      performedActions.push({ tool: call.function.name, ok: Boolean(result?.ok), label: actionLabel(call.function.name, result) });
      if (result?.ok) {
        const undo = buildUndoRecord(call.function.name, result, beforeSnapshot);
        if (undo?.undoable && undo.record_ids?.length) {
          const saved = await supabase.from("ai_action_history").insert({
            user_id: user.id, batch_id: actionBatchId, tool_name: call.function.name, label: actionLabel(call.function.name, result), operation: undo.operation, table_name: undo.table_name, record_ids: undo.record_ids, before_snapshot: undo.before_snapshot, after_snapshot: undo.after_snapshot, undoable: true,
          }).select("id").single();
          if (!saved.error && saved.data?.id) undoActionIds.push(saved.data.id);
        }
      }
      const confirmField = DELETE_CONFIRM_FIELDS[call.function.name];
      if (confirmField && result?.status === "single_candidate_needs_confirmation" && result?.candidate?.id) {
        nextPendingAction = { tool: call.function.name, confirmField, id: String(result.candidate.id), label: labelCandidate(result.candidate), createdAt: Date.now() };
      } else if (confirmField && result?.status === "multiple_candidates") {
        nextPendingAction = null;
      } else if (confirmField && result?.ok && (result?.deleted || result?.archived)) {
        nextPendingAction = null;
      }
      await supabase.from("ai_function_call_logs").insert({
        user_id: user.id,
        raw_user_text: message?.trim() || (imageDataUrl ? "[gambar]" : ""),
        function_name: call.function.name,
        arguments: call.function.arguments,
        status: result?.ok ? "success" : "error",
      });
      const toolMsg: RawMsg = { role: "tool", tool_call_id: call.id, content: JSON.stringify(compactToolResult(result)) ?? "{}" };
      messages.push(toolMsg);
      turnMessages.push(toolMsg);
    }

    if (i === iterationLimit - 1 && !finalText) {
      try {
        const synthesis = await withOpenAIRetry(() => getOpenAI().chat.completions.create({
          model: "gpt-4o-mini",
          messages: [...messages, { role: "system", content: "Berikan ringkasan hasil dari tool yang baru saja dijalankan. Jangan panggil tool lagi. Sebutkan apa yang berhasil, apa yang gagal, dan tindakan berikutnya yang relevan." }],
          temperature: 0.2,
          max_tokens: 500,
        }), 1);
        finalText = synthesis.choices[0]?.message?.content?.trim() || "Permintaan selesai sebagian. Periksa ringkasan tindakan untuk detail perubahan.";
      } catch {
        finalText = "Permintaan selesai sebagian. Aku sudah menyimpan hasil yang berhasil dan tidak melanjutkan langkah yang tidak terverifikasi.";
      }
      turnMessages.push({ role: "assistant", content: finalText });
    }
  }

  if (pendingAction && /\b(tidak|nggak|gak|jangan|batal|cancel)\b/i.test(message || "")) nextPendingAction = null;
  return NextResponse.json({ reply: finalText, turnMessages: finalText ? [{ role: "assistant", content: finalText }] : [], domains, pendingAction: nextPendingAction, pendingBulkAction, visionUsed: Boolean(imageDataUrl), mode: selectedMode, actions: performedActions.slice(-8), undoActionId: undoActionIds.at(-1) || null });
}
