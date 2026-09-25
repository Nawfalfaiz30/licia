"use client";

import { memo, useCallback, useState, useRef, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Send, X, Loader2, Trash2, Sparkles, CalendarDays, CheckSquare, BarChart3, ListChecks, RotateCcw, ShieldCheck, Command, Layers3, Paperclip, CircleHelp, Wand2, BrainCircuit, Zap, ArrowDownRight, MoreHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { MarkdownLite } from "./MarkdownLite";
import { fileToCompressedDataUrl } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";
import { LiveClock } from "@/components/LiveClock";
import { ActionDialog, notifyToast } from "@/components/ui";

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type RawMsg = {
  __turnId?: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string | ContentPart[] | null;
  tool_calls?: any[];
  tool_call_id?: string;
};

type PendingAction = { tool: string; confirmField: string; id: string; label?: string; createdAt: number };
type AiMode = "assistant" | "planner" | "analyst" | "operator" | "reflector";
type ActionSummary = { tool:string; ok:boolean; label:string };
type PendingBulkAction = { id:string; expiresAt:string; actions:Array<{tool:string;arguments:string;preview:string}> };

type DisplayMsg = {
  id: string;
  turnId?: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  createdAt?: number;
};

const GREETING: DisplayMsg = {
  id: "greeting",
  role: "assistant",
  content: "Hai! Aku Licia 💛 Cerita aja apa yang sedang kamu pikirkan. Mau mencatat sesuatu, menyusun agenda, mencari ide, atau mengirim gambar untuk dibaca, semuanya boleh.",
};

const STORAGE_RAW = "licia-chat-raw-v5";
const STORAGE_DISPLAY = "licia-chat-display-v5";
const MAX_DISPLAY_MESSAGES = 40;
const MAX_RAW_MESSAGES = 50;
const STORAGE_PENDING = "licia-chat-pending-action-v1";

function extractDisplay(content: RawMsg["content"]): { text: string; imageUrl?: string } {
  if (typeof content === "string") return { text: content };
  if (Array.isArray(content)) {
    const textParts = content
      .filter((p): p is Extract<ContentPart, { type: "text" }> => p?.type === "text")
      .map((p) => p.text)
      .filter(Boolean);
    const imagePart = content.find((p): p is Extract<ContentPart, { type: "image_url" }> => p?.type === "image_url");
    return { text: textParts.join("\n"), imageUrl: imagePart?.image_url?.url };
  }
  return { text: "" };
}

function makeDisplay(role: "user" | "assistant", content: RawMsg["content"], turnId?: string): DisplayMsg | null {
  const { text, imageUrl } = extractDisplay(content);
  if (!text.trim() && !imageUrl) return null;
  return { id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`, turnId, role, content: text, imageUrl, createdAt: Date.now() };
}

function loadDisplayHistory(): DisplayMsg[] {
  if (typeof window === "undefined") return [];
  const readDisplay = (key: string) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [] as DisplayMsg[];
      const parsed = JSON.parse(raw) as any[];
      if (!Array.isArray(parsed)) return [] as DisplayMsg[];
      return parsed.map((m) => ({
        id: String(m?.id ?? `legacy-${Math.random().toString(36).slice(2)}`),
        turnId: typeof m?.turnId === "string" ? m.turnId : undefined,
        role: (m?.role === "user" ? "user" : "assistant") as DisplayMsg["role"],
        content: typeof m?.content === "string" ? m.content : "",
        imageUrl: typeof m?.imageUrl === "string" ? m.imageUrl : undefined,
        createdAt: Number.isFinite(Number(m?.createdAt)) ? Number(m.createdAt) : undefined,
      })).filter((m) => m.content.trim() || m.imageUrl).slice(-MAX_DISPLAY_MESSAGES);
    } catch { return [] as DisplayMsg[]; }
  };
  const current = readDisplay(STORAGE_DISPLAY);
  if (current.length) return current;
  const legacyKeys = ["licia-chat-display-v4", "licia-chat-display-v3"];
  for (const key of legacyKeys) {
    const legacy = readDisplay(key);
    if (legacy.length) return legacy;
  }
  // Recover visible text from raw history when an older renderer wrote malformed/empty display bubbles.
  try {
    const rawCandidates = [localStorage.getItem(STORAGE_RAW), localStorage.getItem("licia-chat-raw-v4"), localStorage.getItem("licia-chat-raw-v3")].filter(Boolean) as string[];
    for (const rawText of rawCandidates) {
      const raw = JSON.parse(rawText) as RawMsg[];
      const recovered = (raw ?? [])
        .filter((m) => m?.role === "user" || m?.role === "assistant")
        .map((m) => makeDisplay(m.role as "user" | "assistant", m.content))
        .filter((m): m is DisplayMsg => Boolean(m));
      if (recovered.length) return recovered.slice(-MAX_DISPLAY_MESSAGES);
    }
  } catch {}
  return [];
}
function loadRawHistory(): RawMsg[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_RAW);
    if (raw) {
      const parsed = JSON.parse(raw) as RawMsg[];
      if (Array.isArray(parsed)) return parsed.slice(-MAX_RAW_MESSAGES);
    }
    const old = sessionStorage.getItem("licia-chat-session-v2") || sessionStorage.getItem("licia-chat-session-v1");
    if (old) {
      const parsed = JSON.parse(old) as { history?: RawMsg[] };
      return (parsed.history ?? []).slice(-MAX_RAW_MESSAGES);
    }
  } catch {
    // Ignore malformed/blocked storage.
  }
  return [];
}

function normalizeLegacyTurnIds(display: DisplayMsg[], raw: RawMsg[]) {
  let displayIndex = 0;
  let lastDisplayTurn: string | undefined;
  const displayFixed = display.map((m) => {
    if (m.turnId) { lastDisplayTurn = m.turnId; if (m.role === "user") displayIndex++; return m; }
    if (m.role === "user") { const t = `legacy-turn-${displayIndex++}`; lastDisplayTurn = t; return { ...m, turnId: t }; }
    return { ...m, turnId: lastDisplayTurn };
  });
  let rawIndex = 0;
  let lastRawTurn: string | undefined;
  const rawFixed = raw.map((m) => {
    if (m.__turnId) { lastRawTurn = m.__turnId; if (m.role === "user") rawIndex++; return m; }
    if (m.role === "user") { const t = `legacy-turn-${rawIndex++}`; lastRawTurn = t; return { ...m, __turnId: t }; }
    return { ...m, __turnId: lastRawTurn };
  });
  return { displayFixed, rawFixed };
}

function sanitizeForApi(history: RawMsg[]): RawMsg[] {
  const dialogue = history.filter((msg) => msg.role === "user" || (msg.role === "assistant" && typeof msg.content === "string" && msg.content.trim()));
  return dialogue.slice(-MAX_RAW_MESSAGES).map((msg) => {
    const clean = { ...msg } as RawMsg & { __turnId?: string };
    delete clean.__turnId;
    if (!Array.isArray(clean.content)) return clean;
    const parts = clean.content;
    const hasImage = parts.some((p) => p?.type === "image_url");
    if (!hasImage) return clean;
    return {
      ...clean,
      content: parts.map((part) => part.type === "image_url"
        ? { type: "text", text: "[Gambar dari percakapan sebelumnya]" }
        : part
      ) as ContentPart[],
    };
  });
}

function persistDisplay(history: DisplayMsg[]) {
  try {
    const trimmed = history.slice(-MAX_DISPLAY_MESSAGES).map((msg, index, arr) =>
      index >= arr.length - 2 ? msg : { ...msg, imageUrl: undefined }
    );
    localStorage.setItem(STORAGE_DISPLAY, JSON.stringify(trimmed));
  } catch {
    // Keep the in-memory conversation alive when storage quota is unavailable.
  }
}

function loadPendingAction(): PendingAction | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_PENDING);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingAction;
    if (!parsed?.tool || !parsed?.confirmField || !parsed?.id || Date.now() - Number(parsed.createdAt) > 15 * 60 * 1000) {
      localStorage.removeItem(STORAGE_PENDING);
      return null;
    }
    return parsed;
  } catch { return null; }
}

function persistPendingAction(action: PendingAction | null) {
  try {
    if (!action) localStorage.removeItem(STORAGE_PENDING);
    else localStorage.setItem(STORAGE_PENDING, JSON.stringify(action));
  } catch {}
}

function appendDisplayMessage(
  setDisplayHistory: React.Dispatch<React.SetStateAction<DisplayMsg[]>>,
  message: DisplayMsg
) {
  setDisplayHistory((prev) => [...prev, message].slice(-MAX_DISPLAY_MESSAGES));
}

function persistRaw(history: RawMsg[]) {
  try {
    localStorage.setItem(STORAGE_RAW, JSON.stringify(history.slice(-MAX_RAW_MESSAGES)));
  } catch {
    // Tool history can be large; chat remains usable in memory.
  }
}

function formatMessageTime(ts: number | undefined, timezone: string) {
  if (!ts) return "";
  try { return new Intl.DateTimeFormat("id-ID", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ts)); } catch { return ""; }
}

const ChatMessage = memo(function ChatMessage({ message, timezone, onDelete }: { message: DisplayMsg; timezone: string; onDelete: (turnId?: string, messageId?: string) => void }) {
  const m = message;
  const isUser = m.role === "user";
  return (
    <div className={clsx("flex items-end gap-2.5 animate-licia-slide-in", isUser ? "justify-end" : "justify-start")}>
      {!isUser && <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-2xl ring-1 ring-border shadow-sm"><Image src="/licia-avatar.png" alt="Licia" fill sizes="32px" className="object-cover"/></div>}
      <div className={clsx("min-w-0", isUser ? "max-w-[94%] sm:max-w-[76%]" : "max-w-[96%] sm:max-w-[82%]")}>
        <div className={clsx("chat-bubble min-w-0 rounded-[1.35rem] px-4 py-3.5 text-sm leading-relaxed shadow-sm", isUser ? "chat-message-user rounded-br-md bg-accent text-white shadow-accent/20" : "chat-message-ai rounded-bl-md border border-border bg-surface text-text")}>{m.imageUrl&&<div className="relative mb-3 max-h-80 overflow-hidden rounded-2xl bg-black/5"><img src={m.imageUrl} alt="Gambar terlampir" loading="lazy" decoding="async" className="block max-h-80 w-auto max-w-full object-contain"/></div>}{m.content?(isUser?<span className="whitespace-pre-wrap break-words">{m.content}</span>:<MarkdownLite text={m.content}/>):m.imageUrl?<span className="text-xs opacity-80">Gambar terlampir</span>:<span className="text-xs opacity-70">Pesan tidak terbaca</span>} </div>
        {m.createdAt&&<div className={clsx("mt-1.5 flex items-center gap-2 px-1 text-[9px]",isUser?"justify-end text-textMuted":"text-textMuted")}><span>{isUser?"Kamu":"Licia"}</span><span>·</span><span>{formatMessageTime(m.createdAt, timezone)}</span>{m.id!=="greeting"&&<button onClick={()=>onDelete(m.turnId,m.id)} className="inline-flex h-5 w-5 items-center justify-center rounded-md text-textMuted hover:bg-danger/10 hover:text-danger" title="Hapus pesan" aria-label="Hapus pesan"><Trash2 size={10}/></button>}</div>}
      </div>
    </div>
  );
});

export function ChatWidget({ compact = false }: { compact?: boolean }) {
  const searchParams = useSearchParams();
  const [rawHistory, setRawHistory] = useState<RawMsg[]>([]);
  const [displayHistory, setDisplayHistory] = useState<DisplayMsg[]>([]);
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [compressingImage, setCompressingImage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [timezone, setTimezone] = useState("Asia/Jakarta");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(true);
  const [enterToSend, setEnterToSend] = useState(true);
  const [chatStyle, setChatStyle] = useState("soft");
  const [mode, setMode] = useState<AiMode>("assistant");
  const [responseStyle, setResponseStyle] = useState("normal");
  const [lastActions, setLastActions] = useState<ActionSummary[]>([]);
  const [undoActionId, setUndoActionId] = useState<string | null>(null);
  const [pendingBulkAction, setPendingBulkAction] = useState<PendingBulkAction | null>(null);
  const [applyingBulk, setApplyingBulk] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ kind: "message" | "clear"; turnId?: string; messageId?: string } | null>(null);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const normalized = normalizeLegacyTurnIds(loadDisplayHistory(), loadRawHistory());
    setRawHistory(normalized.rawFixed.filter((m) => m.role === "user" || (m.role === "assistant" && typeof m.content === "string" && m.content.trim())));
    setDisplayHistory(normalized.displayFixed);
    setPendingAction(loadPendingAction());
    const prompt = searchParams.get("prompt");
    if (prompt) setInput(prompt);
    setHydrated(true);

    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("users").select("timezone, preferences").eq("id", user.id).single();
      setTimezone(data?.timezone ?? "Asia/Jakarta");
      const prefs = (data?.preferences as { confirmDelete?: boolean; chatEnterToSend?: boolean } | null) ?? {};
      setConfirmDelete(prefs.confirmDelete !== false);
      setEnterToSend(prefs.chatEnterToSend !== false);
      try { setChatStyle(localStorage.getItem("licia-chat-style") || "soft"); setMode((localStorage.getItem("licia-default-ai-mode") as AiMode) || "assistant"); setResponseStyle(localStorage.getItem("licia-ai-response-style") || "normal"); } catch {}
    })();
  }, [searchParams]);

  useEffect(() => {
    if (!hydrated) return;
    persistRaw(rawHistory);
    persistDisplay(displayHistory);
  }, [rawHistory, displayHistory, hydrated]);

  const displayMessages = useMemo(() => [GREETING, ...displayHistory], [displayHistory]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }));
  }, [displayMessages, loading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  async function processImageFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    setCompressingImage(true);
    try {
      setPendingImage(await fileToCompressedDataUrl(file, 1500, 0.72));
    } catch {
      setPendingImage(null);
    } finally {
      setCompressingImage(false);
    }
  }

  async function handlePickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) await processImageFile(file);
  }

  async function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    for (const item of e.clipboardData?.items ?? []) {
      if (!item.type.startsWith("image/")) continue;
      const file = item.getAsFile();
      if (file) {
        e.preventDefault();
        await processImageFile(file);
      }
      return;
    }
  }

  async function handleSend() {
    const text = input.trim();
    if ((!text && !pendingImage) || loading || compressingImage) return;

    const imageToSend = pendingImage;
    const visibleUser: { text: string; imageUrl?: string } = imageToSend
      ? { text: text || "Tolong baca dan jelaskan gambar ini.", imageUrl: imageToSend }
      : { text };
    const turnId = `turn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const rawUser: RawMsg = imageToSend
      ? { __turnId: turnId,
          role: "user",
          content: [
            { type: "text", text: visibleUser.text },
            { type: "image_url", image_url: { url: imageToSend } },
          ],
        }
      : { __turnId: turnId, role: "user", content: text };

    setInput("");
    setPendingImage(null);
    setLoading(true);
    const userDisplay: DisplayMsg = {
      id: `user-${Date.now()}`,
      turnId,
      role: "user",
      content: visibleUser.text,
      imageUrl: visibleUser.imageUrl,
      createdAt: Date.now(),
    };
    appendDisplayMessage(setDisplayHistory, userDisplay);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: sanitizeForApi(rawHistory),
          imageDataUrl: imageToSend,
          clientNowIso: new Date().toISOString(),
          pendingAction,
          mode,
          responseStyle,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Permintaan gagal.");

      const returned = Array.isArray(data.turnMessages) ? (data.turnMessages as RawMsg[]).map((m) => ({ ...m, __turnId: turnId })) : [];
      const assistant = [...returned].reverse().find((m) => m.role === "assistant" && extractDisplay(m.content).text.trim());
      const assistantDisplay = assistant ? makeDisplay("assistant", assistant.content, turnId) : null;
      const fallbackText = typeof data.reply === "string" && data.reply.trim()
        ? data.reply.trim()
        : "Aku belum mendapat jawaban yang bisa ditampilkan. Coba ulangi sebentar ya.";

      const finalAssistant: RawMsg | null = data.reply ? { __turnId: turnId, role: "assistant", content: String(data.reply) } : null;
      const returnedPending = data.pendingAction && typeof data.pendingAction === "object" ? data.pendingAction as PendingAction : null;
      setPendingAction(returnedPending);
      setLastActions(Array.isArray(data.actions) ? data.actions : []);
      setUndoActionId(typeof data.undoActionId === "string" ? data.undoActionId : null);
      setPendingBulkAction(data.pendingBulkAction && typeof data.pendingBulkAction === "object" ? data.pendingBulkAction as PendingBulkAction : null);
      persistPendingAction(returnedPending);
      setRawHistory((prev) => [...prev, rawUser, ...(finalAssistant ? [finalAssistant] : [])].slice(-MAX_RAW_MESSAGES));
      const assistantMessage: DisplayMsg = assistantDisplay ?? {
        id: `assistant-${Date.now()}`,
        turnId,
        role: "assistant",
        content: fallbackText,
        createdAt: Date.now(),
      };
      appendDisplayMessage(setDisplayHistory, assistantMessage);
      if (Array.isArray(data.actions) && data.actions.some((a:any)=>a?.ok)) notifyToast({title:"Licia selesai menjalankan aksi",message:data.actions.filter((a:any)=>a?.ok).map((a:any)=>a.label).slice(0,3).join(" • "),tone:"success"});
    } catch (error) {
      setRawHistory((prev) => [...prev, rawUser].slice(-MAX_RAW_MESSAGES));
      const errorMessage: DisplayMsg = {
        id: `assistant-error-${Date.now()}`,
        turnId,
        role: "assistant",
        content: error instanceof Error ? error.message : "Koneksi ke Licia terputus. Coba lagi sebentar ya.",
        createdAt: Date.now(),
      };
      appendDisplayMessage(setDisplayHistory, errorMessage);
      notifyToast({title:"Permintaan belum berhasil",message:errorMessage.content.slice(0,120),tone:"error"});
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && enterToSend) {
      e.preventDefault();
      handleSend();
    }
  }

  const performDeleteTurn = useCallback((turnId?: string, messageId?: string) => {
    if (turnId) {
      setDisplayHistory((prev) => prev.filter((m) => m.turnId !== turnId));
      setRawHistory((prev) => prev.filter((m) => m.__turnId !== turnId));
    } else {
      setDisplayHistory((prev) => prev.filter((m) => m.id !== messageId));
    }
    notifyToast({ title: "Pesan dihapus", message: "Percakapan tetap tersimpan untuk pesan lainnya.", tone: "success" });
  }, []);

  const deleteTurn = useCallback((turnId?: string, messageId?: string) => {
    if (confirmDelete) setConfirmDialog({ kind: "message", turnId, messageId });
    else performDeleteTurn(turnId, messageId);
  }, [confirmDelete, performDeleteTurn]);

  async function undoLastAction() {
    if (!undoActionId || undoing) return;
    setUndoing(true);
    try {
      const res = await fetch("/api/ai/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId: undoActionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Perubahan terakhir belum bisa dipulihkan.");
      setUndoActionId(null);
      setLastActions([]);
      notifyToast({title:"Perubahan dibatalkan",message:"State terakhir dipulihkan.",tone:"success"});
      appendDisplayMessage(setDisplayHistory, {
        id: `assistant-undo-${Date.now()}`,
        role: "assistant",
        content: "Perubahan terakhir berhasil dibatalkan.",
        createdAt: Date.now(),
      });
    } catch (error) {
      appendDisplayMessage(setDisplayHistory, {
        id: `assistant-undo-error-${Date.now()}`,
        role: "assistant",
        content: error instanceof Error ? error.message : "Perubahan belum bisa dibatalkan.",
        createdAt: Date.now(),
      });
    } finally {
      setUndoing(false);
    }
  }

  async function applyBulkAction() {
    if (!pendingBulkAction || applyingBulk) return;
    setApplyingBulk(true);
    try {
      const res = await fetch("/api/ai/batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pendingId: pendingBulkAction.id }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Perubahan belum bisa diterapkan.");
      setPendingBulkAction(null);
      setLastActions(Array.isArray(data.actions) ? data.actions : []);
      setUndoActionId(typeof data.undoActionId === "string" ? data.undoActionId : null);
      notifyToast({title:"Perubahan diterapkan",message:data.partial?"Sebagian perubahan berhasil diterapkan.":"Semua perubahan yang disetujui berhasil diterapkan.",tone:data.partial?"warning":"success"});
      appendDisplayMessage(setDisplayHistory, {
        id: `assistant-bulk-${Date.now()}`,
        role: "assistant",
        content: data.partial ? "Sebagian perubahan berhasil diterapkan. Periksa ringkasannya dan gunakan Batalkan perubahan bila perlu." : "Semua perubahan yang kamu setujui berhasil diterapkan.",
        createdAt: Date.now(),
      });
    } catch (error) {
      appendDisplayMessage(setDisplayHistory, {
        id: `assistant-bulk-error-${Date.now()}`,
        role: "assistant",
        content: error instanceof Error ? error.message : "Perubahan belum bisa diterapkan.",
        createdAt: Date.now(),
      });
    } finally {
      setApplyingBulk(false);
    }
  }

  async function cancelBulkAction() {
    if (!pendingBulkAction || applyingBulk) return;
    try {
      await fetch("/api/ai/batch", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pendingId: pendingBulkAction.id }) });
    } catch {}
    setPendingBulkAction(null);
  }

  function performClearChat() {
    setRawHistory([]);
    setDisplayHistory([]);
    setPendingAction(null);
    setPendingBulkAction(null);
    setUndoActionId(null);
    setLastActions([]);
    try {
      localStorage.removeItem(STORAGE_RAW);
      localStorage.removeItem(STORAGE_DISPLAY);
      localStorage.removeItem(STORAGE_PENDING);
    } catch {}
    notifyToast({ title: "Percakapan dibersihkan", message: "Licia siap memulai percakapan baru.", tone: "success" });
  }

  function clearChat() {
    if (confirmDelete) setConfirmDialog({ kind: "clear" });
    else performClearChat();
    setShowChatMenu(false);
  }

  const bridgeActions: Array<{ label: string; icon: LucideIcon; text: string }> = [
    { label: "Agenda → tugas", icon: CalendarDays, text: "Lihat agenda saya yang relevan lalu ubah menjadi tugas terhubung dengan deadline yang masuk akal." },
    { label: "Tugas → agenda", icon: CheckSquare, text: "Lihat tugas saya yang belum punya slot waktu dan jadwalkan yang paling penting ke kalender." },
    { label: "Agenda → pengingat", icon: Sparkles, text: "Lihat agenda penting saya berikutnya dan buat pengingat yang terhubung." },
    { label: "Inbox → tugas", icon: CheckSquare, text: "Lihat Smart Inbox saya dan ubah item yang pantas menjadi tugas." },
  ];

  const quickActions: Array<{ label: string; icon: LucideIcon; text: string }> = [
    { label: "Apa yang penting hari ini?", icon: Sparkles, text: "Analisis kondisi saya hari ini dan berikan 3 prioritas utama berdasarkan data Licia." },
    { label: "Buat tugas", icon: CheckSquare, text: "Bantu saya membuat tugas yang tepat dari pesan ini: " },
    { label: "Susun agenda", icon: CalendarDays, text: "Bantu susun agenda saya berdasarkan tugas dan prioritas yang ada." },
    { label: "Baca gambar", icon: Wand2, text: "Baca gambar ini dengan teliti dan jelaskan informasi pentingnya." },
    { label: "Cek pola pribadi", icon: BarChart3, text: "Cari pola penting dari aktivitas saya dan jelaskan temuan yang paling berguna." },
  ];

  const modeLabel = mode === "assistant" ? "Assistant" : mode === "planner" ? "Planner" : mode === "analyst" ? "Analyst" : mode === "operator" ? "Operator" : "Reflektor";
  return (
    <div data-chat-style={chatStyle} className={clsx("chat-v24 flex min-w-0 flex-col overflow-hidden rounded-[1.7rem] border border-border bg-surface shadow-sm", compact ? "h-[520px]" : "h-[calc(100dvh-132px)] min-h-[520px] max-h-[900px]") }>
      <header className="chat-v24-header shrink-0 border-b border-border bg-surface px-3 py-3 sm:px-5 sm:py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl ring-1 ring-accent/15"><Image src="/licia-avatar.png" alt="Licia" fill sizes="36px" className="object-cover"/></div>
          <div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2"><h1 className="truncate font-display text-base text-text sm:text-lg">Licia</h1><span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-[8px] font-bold text-success"><span className="h-1.5 w-1.5 rounded-full bg-success animate-licia-spark"/> siap</span></div><p className="mt-0.5 truncate text-[10px] text-textMuted">Teman berpikir yang terhubung ke Life OS</p></div>
          <button onClick={()=>setShowChatMenu(v=>!v)} className="touch-target shrink-0 rounded-xl border border-border bg-bg text-textMuted transition hover:border-accent/30 hover:text-accent" title="Opsi chat" aria-label="Opsi chat" aria-expanded={showChatMenu}><MoreHorizontal size={18}/></button>
        </div>
        <div className="mt-2 flex min-w-0 items-center gap-2"><span className="rounded-full bg-accent/7 px-2.5 py-1.5 text-[9px] font-semibold text-accent">{modeLabel}</span><span className="truncate text-[9px] text-textMuted">{displayHistory.length?`${displayHistory.length} pesan`:"Percakapan baru"}</span></div>
      </header>

      {showChatMenu&&<div className="chat-v24-menu z-30 border-b border-border bg-surface px-3 py-3 sm:absolute sm:right-4 sm:top-20 sm:w-[300px] sm:rounded-2xl sm:border sm:shadow-2xl">
        <div className="grid grid-cols-2 gap-2"><label className="rounded-xl border border-border bg-bg p-2.5"><span className="block text-[9px] font-semibold text-textMuted">Mode</span><select value={mode} onChange={e=>setMode(e.target.value as AiMode)} className="mt-1 w-full bg-transparent text-xs font-semibold text-text outline-none"><option value="assistant">Assistant</option><option value="planner">Planner</option><option value="analyst">Analyst</option><option value="operator">Operator</option><option value="reflector">Reflektor</option></select></label><label className="rounded-xl border border-border bg-bg p-2.5"><span className="block text-[9px] font-semibold text-textMuted">Jawaban</span><select value={responseStyle} onChange={e=>setResponseStyle(e.target.value)} className="mt-1 w-full bg-transparent text-xs font-semibold text-text outline-none"><option value="concise">Ringkas</option><option value="normal">Normal</option><option value="detailed">Detail</option></select></label></div>
        <div className="mt-2 grid grid-cols-2 gap-2"><Link href="/guide" onClick={()=>setShowChatMenu(false)} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-bg text-[10px] font-semibold text-textMuted hover:text-accent"><CircleHelp size={13}/> Panduan</Link><button onClick={clearChat} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-danger/15 bg-danger/5 text-[10px] font-semibold text-danger"><Trash2 size={13}/> Bersihkan</button></div>
      </div>}

      <div ref={scrollRef} className="chat-v24-pane min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5 sm:py-5"><div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        {displayMessages.map(message=><ChatMessage key={message.id} message={message} timezone={timezone} onDelete={deleteTurn}/>)}
        {loading&&<div className="flex items-end gap-2.5 animate-licia-slide-in"><div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-xl ring-1 ring-border"><Image src="/licia-avatar.png" alt="Licia" fill sizes="32px" className="object-cover"/></div><div className="rounded-[1.25rem] rounded-bl-md border border-border bg-bg px-4 py-3"><div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce"/><span className="h-1.5 w-1.5 rounded-full bg-accent/70 animate-bounce [animation-delay:120ms]"/><span className="h-1.5 w-1.5 rounded-full bg-accent/40 animate-bounce [animation-delay:240ms]"/></div></div></div>}
      </div></div>

      {pendingBulkAction&&<div className="shrink-0 border-t border-accent/15 bg-accent/5 px-3 py-2.5 sm:px-5"><div className="mx-auto max-w-3xl rounded-2xl border border-accent/20 bg-surface p-3"><div className="flex items-start gap-3"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-accent"/><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-text">Konfirmasi perubahan massal</p><p className="mt-0.5 text-[10px] leading-relaxed text-textMuted">Licia menemukan tindakan yang memengaruhi banyak data. Tinjau sekali lalu terapkan sebagai satu operasi.</p><div className="mt-2 grid gap-1.5">{pendingBulkAction.actions.map((a,i)=><div key={`${a.tool}-${i}`} className="break-words rounded-xl bg-bg px-2.5 py-2 text-[9px] font-medium text-text">{a.preview}</div>)}</div></div><div className="flex shrink-0 flex-col gap-1.5"><button onClick={()=>void cancelBulkAction()} className="rounded-xl px-2.5 py-2 text-[9px] font-semibold text-textMuted hover:text-danger">Tolak</button><button onClick={()=>void applyBulkAction()} disabled={applyingBulk} className="rounded-xl bg-accent px-3 py-2 text-[9px] font-semibold text-white">{applyingBulk?"Menerapkan…":"Setujui"}</button></div></div></div></div>}

      <div className="shrink-0 border-t border-border bg-surface p-3 sm:p-4"><div className="mx-auto max-w-3xl">
        <div className="mb-2 flex min-w-0 gap-1.5 overflow-x-auto no-scrollbar">{quickActions.slice(0,4).map(a=>{const Icon=a.icon;return <button key={a.label} onClick={()=>setInput(a.text)} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-bg px-3 py-1.5 text-[9px] font-semibold text-textMuted transition hover:border-accent/20 hover:text-accent"><Icon size={11}/>{a.label}</button>})}</div>
        {pendingImage&&<div className="mb-2 flex items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2"><div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg"><img src={pendingImage} alt="Lampiran" className="h-full w-full object-cover"/></div><span className="min-w-0 flex-1 break-words text-[10px] text-textMuted">Gambar siap dikirim</span><button onClick={()=>setPendingImage(null)} className="touch-target text-textMuted hover:text-danger" aria-label="Hapus gambar"><X size={13}/></button></div>}
        <div className="chat-v24-composer flex items-end gap-2 rounded-[1.35rem] border border-border bg-bg p-2"><button onClick={()=>fileInputRef.current?.click()} className="touch-target shrink-0 rounded-xl text-textMuted hover:bg-surface hover:text-accent" title="Lampirkan gambar"><Paperclip size={17}/></button><input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePickImage} className="hidden"/><textarea ref={textareaRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKeyDown} onPaste={handlePaste} disabled={loading} rows={1} placeholder="Tulis ke Licia…" className="max-h-36 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-sm leading-relaxed text-text outline-none placeholder:text-textMuted"/><button onClick={()=>void handleSend()} disabled={loading||compressingImage||(!input.trim()&&!pendingImage)} className="touch-target flex shrink-0 items-center justify-center rounded-xl bg-accent px-3 text-white shadow-md shadow-accent/15 transition hover:scale-105 active:scale-95 disabled:opacity-40" title="Kirim"><Send size={16}/></button></div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 px-1"><p className="text-[9px] text-textMuted">Enter kirim · Shift+Enter baris baru · gambar bisa ditempel.</p>{undoActionId&&<button onClick={()=>void undoLastAction()} disabled={undoing} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] font-semibold text-accent hover:bg-accent/5">{undoing?<Loader2 size={11} className="animate-spin"/>:<RotateCcw size={11}/>} Batalkan perubahan</button>}</div>
      </div></div>
      <ActionDialog open={Boolean(confirmDialog)} title={confirmDialog?.kind === "clear" ? "Bersihkan percakapan?" : "Hapus pesan?"} description={confirmDialog?.kind === "clear" ? "Riwayat chat lokal Licia akan dihapus dari perangkat ini." : "Pesan dan pasangan jawabannya akan dihapus dari riwayat percakapan."} tone="danger" confirmLabel={confirmDialog?.kind === "clear" ? "Bersihkan" : "Hapus"} onClose={()=>setConfirmDialog(null)} onConfirm={()=>{const target=confirmDialog;if(!target)return;setConfirmDialog(null);if(target.kind==="clear")performClearChat();else performDeleteTurn(target.turnId,target.messageId);}}/>
    </div>
  );
}
