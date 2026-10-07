"use client";

import { memo, useCallback, useState, useRef, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Send,
  X,
  Loader2,
  Trash2,
  Sparkles,
  CalendarDays,
  CheckSquare,
  BarChart3,
  ListChecks,
  RotateCcw,
  ShieldCheck,
  Command,
  Layers3,
  Paperclip,
  CircleHelp,
  Wand2,
  BrainCircuit,
  Zap,
  ArrowDownRight,
  MoreHorizontal,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { MarkdownLite } from "./MarkdownLite";
import { fileToCompressedDataUrl } from "@/lib/image";
import { postChatStream } from "@/lib/chat/stream";
import { createClient } from "@/lib/supabase/client";
import { LiveClock } from "@/components/LiveClock";
import { ActionDialog, notifyToast } from "@/components/ui";

import { useLanguage } from "@/components/LanguageProvider";
import { documentLocale } from "@/lib/format";
type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

type RawMsg = {
  __turnId?: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string | ContentPart[] | null;
  tool_calls?: any[];
  tool_call_id?: string;
};

type PendingAction = {
  tool: string;
  confirmField: string;
  id: string;
  label?: string;
  createdAt: number;
  pendingId?: string;
};
type AiMode = "assistant" | "planner" | "analyst" | "operator" | "reflector";
type ActionSummary = { tool: string; ok: boolean; label: string };
type ConversationState = {
  activeDomain: string;
  activeOperation: string;
  activeEntityIds: string[];
  activeLabels: string[];
  lastUserText: string;
  lastActionTools: string[];
  updatedAt: number;
};
type PendingBulkAction = {
  id: string;
  expiresAt: string;
  actions: Array<{ tool: string; arguments: string; preview: string }>;
  risk?: "normal" | "high" | "destructive";
  confidence?: number;
  requiresConfirmation?: boolean;
};
type PendingScheduleImport = {
  source: "vision-schedule";
  createdAt: number;
  blocks: Array<{
    weekday: string;
    start_time: string;
    end_time: string;
    title: string;
    location?: string | null;
    description?: string | null;
  }>;
};

type AiMeta = {
  model?: string;
  contextMode?: "smart" | "all";
  domains?: string[];
  deniedDomains?: string[];
  temporalGuard?: boolean;
  topicSwitched?: boolean;
  followUp?: boolean;
  activeDomain?: string;
  operation?: string;
  mutationExpected?: boolean;
  verifiedActions?: number;
};
type DisplayMsg = {
  id: string;
  turnId?: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  createdAt?: number;
  aiMeta?: AiMeta;
  feedback?: "useful" | "not_useful";
  actionSummary?: ActionSummary[];
  undoActionId?: string;
  actionState?: "success" | "partial" | "undone";
};

const GREETING: DisplayMsg = {
  id: "greeting",
  role: "assistant",
  content:
    "Hai! Aku Licia 💛 Cerita aja apa yang sedang kamu pikirkan. Mau mencatat sesuatu, menyusun agenda, mencari ide, atau mengirim gambar untuk dibaca, semuanya boleh.",
};

const STORAGE_RAW = "licia-chat-raw-v5";
const STORAGE_DISPLAY = "licia-chat-display-v5";
const MAX_DISPLAY_MESSAGES = 18;
const MAX_RAW_MESSAGES = 20;
const STORAGE_PENDING = "licia-chat-pending-action-v1";
const STORAGE_PENDING_SCHEDULE = "licia-chat-pending-schedule-v1";
const STORAGE_CONVERSATION_STATE = "licia-chat-conversation-state-v1";

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
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    turnId,
    role,
    content: text,
    imageUrl,
    createdAt: Date.now(),
  };
}

function loadDisplayHistory(): DisplayMsg[] {
  if (typeof window === "undefined") return [];
  const readDisplay = (key: string) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [] as DisplayMsg[];
      const parsed = JSON.parse(raw) as any[];
      if (!Array.isArray(parsed)) return [] as DisplayMsg[];
      return parsed
        .map((m) => ({
          id: String(m?.id ?? `legacy-${Math.random().toString(36).slice(2)}`),
          turnId: typeof m?.turnId === "string" ? m.turnId : undefined,
          role: (m?.role === "user" ? "user" : "assistant") as DisplayMsg["role"],
          content: typeof m?.content === "string" ? m.content : "",
          imageUrl: typeof m?.imageUrl === "string" ? m.imageUrl : undefined,
          createdAt: Number.isFinite(Number(m?.createdAt)) ? Number(m.createdAt) : undefined,
          aiMeta: m?.aiMeta && typeof m.aiMeta === "object" ? m.aiMeta : undefined,
          feedback: m?.feedback === "useful" || m?.feedback === "not_useful" ? m.feedback : undefined,
          actionSummary: Array.isArray(m?.actionSummary)
            ? m.actionSummary.filter((a: any) => a && typeof a.label === "string").slice(-8)
            : undefined,
          undoActionId: typeof m?.undoActionId === "string" ? m.undoActionId : undefined,
          actionState:
            m?.actionState === "success" || m?.actionState === "partial" || m?.actionState === "undone"
              ? m.actionState
              : undefined,
        }))
        .filter((m) => m.content.trim() || m.imageUrl)
        .slice(-MAX_DISPLAY_MESSAGES);
    } catch {
      return [] as DisplayMsg[];
    }
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
    const rawCandidates = [
      localStorage.getItem(STORAGE_RAW),
      localStorage.getItem("licia-chat-raw-v4"),
      localStorage.getItem("licia-chat-raw-v3"),
    ].filter(Boolean) as string[];
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
    if (m.turnId) {
      lastDisplayTurn = m.turnId;
      if (m.role === "user") displayIndex++;
      return m;
    }
    if (m.role === "user") {
      const t = `legacy-turn-${displayIndex++}`;
      lastDisplayTurn = t;
      return { ...m, turnId: t };
    }
    return { ...m, turnId: lastDisplayTurn };
  });
  let rawIndex = 0;
  let lastRawTurn: string | undefined;
  const rawFixed = raw.map((m) => {
    if (m.__turnId) {
      lastRawTurn = m.__turnId;
      if (m.role === "user") rawIndex++;
      return m;
    }
    if (m.role === "user") {
      const t = `legacy-turn-${rawIndex++}`;
      lastRawTurn = t;
      return { ...m, __turnId: t };
    }
    return { ...m, __turnId: lastRawTurn };
  });
  return { displayFixed, rawFixed };
}

function sanitizeForApi(history: RawMsg[]): RawMsg[] {
  const dialogue = history.filter(
    (msg) => msg.role === "user" || (msg.role === "assistant" && typeof msg.content === "string" && msg.content.trim()),
  );
  return dialogue.slice(-20).map((msg) => {
    const clean = { ...msg } as RawMsg & { __turnId?: string };
    delete clean.__turnId;
    if (!Array.isArray(clean.content)) return clean;
    const parts = clean.content;
    const hasImage = parts.some((p) => p?.type === "image_url");
    if (!hasImage) return clean;
    return {
      ...clean,
      content: parts.map((part) =>
        part.type === "image_url" ? { type: "text", text: "[Gambar dari percakapan sebelumnya]" } : part,
      ) as ContentPart[],
    };
  });
}

function persistDisplay(history: DisplayMsg[]) {
  try {
    const trimmed = history
      .slice(-MAX_DISPLAY_MESSAGES)
      .map((msg, index, arr) => (index >= arr.length - 2 ? msg : { ...msg, imageUrl: undefined }));
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
    if (
      !parsed?.tool ||
      !parsed?.confirmField ||
      !parsed?.id ||
      Date.now() - Number(parsed.createdAt) > 15 * 60 * 1000
    ) {
      localStorage.removeItem(STORAGE_PENDING);
      localStorage.removeItem(STORAGE_PENDING_SCHEDULE);
      localStorage.removeItem(STORAGE_CONVERSATION_STATE);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function persistPendingAction(action: PendingAction | null) {
  try {
    if (!action) localStorage.removeItem(STORAGE_PENDING);
    else localStorage.setItem(STORAGE_PENDING, JSON.stringify(action));
  } catch {}
}

function loadPendingScheduleImport(): PendingScheduleImport | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_PENDING_SCHEDULE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingScheduleImport;
    if (
      parsed?.source !== "vision-schedule" ||
      !Number.isFinite(Number(parsed.createdAt)) ||
      Date.now() - Number(parsed.createdAt) > 15 * 60 * 1000 ||
      !Array.isArray(parsed.blocks) ||
      !parsed.blocks.length
    ) {
      localStorage.removeItem(STORAGE_PENDING_SCHEDULE);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function persistPendingScheduleImport(value: PendingScheduleImport | null) {
  try {
    if (!value) localStorage.removeItem(STORAGE_PENDING_SCHEDULE);
    else localStorage.setItem(STORAGE_PENDING_SCHEDULE, JSON.stringify(value));
  } catch {}
}
function persistConversationState(value: ConversationState | null) {
  try {
    if (!value) localStorage.removeItem(STORAGE_CONVERSATION_STATE);
    else localStorage.setItem(STORAGE_CONVERSATION_STATE, JSON.stringify(value));
  } catch {}
}

function loadConversationState(): ConversationState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_CONVERSATION_STATE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConversationState;
    if (!parsed?.activeDomain || !parsed?.lastUserText || !Number.isFinite(Number(parsed.updatedAt))) return null;
    if (Date.now() - Number(parsed.updatedAt) > 24 * 60 * 60 * 1000) return null;
    return {
      activeDomain: String(parsed.activeDomain),
      activeOperation: String(parsed.activeOperation || "read"),
      activeEntityIds: Array.isArray(parsed.activeEntityIds) ? parsed.activeEntityIds.map(String).slice(0, 8) : [],
      activeLabels: Array.isArray(parsed.activeLabels) ? parsed.activeLabels.map(String).slice(0, 6) : [],
      lastUserText: String(parsed.lastUserText).slice(0, 1200),
      lastActionTools: Array.isArray(parsed.lastActionTools) ? parsed.lastActionTools.map(String).slice(0, 8) : [],
      updatedAt: Number(parsed.updatedAt),
    };
  } catch {
    return null;
  }
}

function appendDisplayMessage(
  setDisplayHistory: React.Dispatch<React.SetStateAction<DisplayMsg[]>>,
  message: DisplayMsg,
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
  try {
    return new Intl.DateTimeFormat(documentLocale(), {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(ts));
  } catch {
    return "";
  }
}

const ChatMessage = memo(function ChatMessage({
  message,
  timezone,
  onDelete,
  onFeedback,
  onUndo,
  showAvatar = true,
}: {
  message: DisplayMsg;
  timezone: string;
  onDelete: (turnId?: string, messageId?: string) => void;
  onFeedback: (message: DisplayMsg, useful: boolean, category?: string) => void;
  onUndo?: (actionId: string, messageId: string) => void;
  showAvatar?: boolean;
}) {
  const { t: tr } = useLanguage();
  const m = message;
  const isUser = m.role === "user";
  return (
    <div
      className={clsx(
        "group/chat-row flex items-end gap-2 py-1 animate-licia-slide-in",
        isUser ? "justify-end" : "justify-start",
        !isUser && !showAvatar && "pl-7 sm:pl-8",
      )}
    >
      {!isUser && showAvatar && (
        <div className="relative mt-auto h-6 w-6 shrink-0 overflow-hidden rounded-lg ring-1 ring-border/80">
          <Image src="/licia-avatar.png" alt="Licia" fill sizes="24px" className="object-cover" />
        </div>
      )}
      <div className={clsx("min-w-0", isUser ? "max-w-[90%] sm:max-w-[72%]" : "max-w-[92%] sm:max-w-[74%]")}>
        <div
          className={clsx(
            "chat-bubble min-w-0 rounded-[1.15rem] px-3.5 py-3 text-[14px] leading-[1.65] shadow-[0_1px_0_rgba(255,255,255,.03)] sm:px-4",
            isUser
              ? "chat-message-user rounded-br-md bg-accent text-white"
              : "chat-message-ai rounded-bl-md border border-border/80 bg-bg text-text",
          )}
        >
          {m.imageUrl && (
            <div className="relative mb-2 max-h-64 overflow-hidden rounded-xl bg-black/5">
              <img
                src={m.imageUrl}
                alt="Gambar terlampir"
                loading="lazy"
                decoding="async"
                className="block max-h-64 w-auto max-w-full object-contain"
              />
            </div>
          )}
          {m.content ? (
            isUser ? (
              <span className="whitespace-pre-wrap break-words">{m.content}</span>
            ) : (
              <MarkdownLite text={m.content} />
            )
          ) : m.imageUrl ? (
            <span className="text-xs opacity-80">Gambar terlampir</span>
          ) : (
            <span className="text-xs opacity-70">Pesan tidak terbaca</span>
          )}
          {!isUser && m.actionSummary?.length ? (
            <details className="chat-v50-action-receipt mt-2.5 border-t border-border/70 pt-2" open={false}>
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-1 py-1 text-2xs font-semibold text-success hover:bg-success/5">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-success/10">
                  <CheckSquare size={11} />
                </span>
                <span>
                  {m.actionSummary.length} aksi{" "}
                  {m.actionState === "partial"
                    ? "sebagian selesai"
                    : m.actionState === "undone"
                      ? "sudah dibatalkan"
                      : "selesai"}
                </span>
                <span className="ml-auto text-2xs text-textMuted">Lihat detail</span>
              </summary>
              <div className="mt-1.5 space-y-1.5 rounded-xl bg-bg/65 p-2">
                {m.actionSummary.slice(0, 6).map((action, index) => (
                  <div key={`${action.tool}-${index}`} className="flex items-start gap-1.5 text-2xs text-textMuted">
                    <span className="mt-0.5 text-success">✓</span>
                    <span className="min-w-0 flex-1">{action.label}</span>
                  </div>
                ))}
                {m.undoActionId && m.actionState !== "undone" && onUndo && (
                  <button
                    type="button"
                    onClick={() => onUndo(m.undoActionId!, m.id)}
                    className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-2xs font-semibold text-accent hover:border-accent/25"
                  >
                    <RotateCcw size={10} /> Batalkan perubahan
                  </button>
                )}
              </div>
            </details>
          ) : null}
        </div>
        {m.createdAt && m.id !== "greeting" && (
          <div className="mt-0.5 hidden min-h-4 items-center gap-1.5 px-1 text-2xs text-textMuted opacity-0 transition-opacity group-hover/chat-row:opacity-100 sm:flex">
            <span>{isUser ? "Kamu" : "Licia"}</span>
            <span>·</span>
            <span>{formatMessageTime(m.createdAt, timezone)}</span>
            {!isUser && m.aiMeta?.temporalGuard && (
              <span className="rounded-full bg-accent/5 px-1.5 py-0.5 font-semibold text-accent">
                waktu tervalidasi
              </span>
            )}
            {!isUser && (
              <>
                <button
                  onClick={() => onFeedback(m, true)}
                  className={clsx(
                    "ml-1 inline-flex h-5 w-5 items-center justify-center rounded-md",
                    m.feedback === "useful"
                      ? "bg-success/10 text-success"
                      : "text-textMuted hover:bg-success/10 hover:text-success",
                  )}
                  title={tr("Jawaban ini membantu")}
                  aria-label={tr("Jawaban ini membantu")}
                >
                  <ThumbsUp size={9} />
                </button>
                <button
                  onClick={() => onFeedback(m, false)}
                  className={clsx(
                    "inline-flex h-5 w-5 items-center justify-center rounded-md",
                    m.feedback === "not_useful"
                      ? "bg-danger/10 text-danger"
                      : "text-textMuted hover:bg-danger/10 hover:text-danger",
                  )}
                  title={tr("Jawaban ini kurang tepat")}
                  aria-label={tr("Jawaban ini kurang tepat")}
                >
                  <ThumbsDown size={9} />
                </button>
              </>
            )}
            <button
              onClick={() => onDelete(m.turnId, m.id)}
              className="inline-flex h-5 w-5 items-center justify-center rounded-md text-textMuted hover:bg-danger/10 hover:text-danger"
              title={tr("Hapus pesan")}
              aria-label={tr("Hapus pesan")}
            >
              <Trash2 size={9} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

export function ChatWidget({ compact = false }: { compact?: boolean }) {
  const { t: tr, locale } = useLanguage();
  const searchParams = useSearchParams();
  const [rawHistory, setRawHistory] = useState<RawMsg[]>([]);
  const [displayHistory, setDisplayHistory] = useState<DisplayMsg[]>([]);
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [compressingImage, setCompressingImage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [timezone, setTimezone] = useState("Asia/Jakarta");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(true);
  const [enterToSend, setEnterToSend] = useState(true);
  const [chatStyle, setChatStyle] = useState("soft");
  const [mode, setMode] = useState<AiMode>("assistant");
  const [responseStyle, setResponseStyle] = useState("normal");
  const [conversationState, setConversationState] = useState<ConversationState | null>(null);
  const [undoActionId, setUndoActionId] = useState<string | null>(null);
  const [pendingBulkAction, setPendingBulkAction] = useState<PendingBulkAction | null>(null);
  const [pendingScheduleImport, setPendingScheduleImport] = useState<PendingScheduleImport | null>(null);
  const [applyingBulk, setApplyingBulk] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    kind: "message" | "clear";
    turnId?: string;
    messageId?: string;
  } | null>(null);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const normalized = normalizeLegacyTurnIds(loadDisplayHistory(), loadRawHistory());
    setRawHistory(
      normalized.rawFixed.filter(
        (m) => m.role === "user" || (m.role === "assistant" && typeof m.content === "string" && m.content.trim()),
      ),
    );
    setDisplayHistory(normalized.displayFixed);
    setPendingAction(loadPendingAction());
    setConversationState(loadConversationState());
    setPendingScheduleImport(loadPendingScheduleImport());
    const prompt = searchParams.get("prompt");
    if (prompt) setInput(prompt);
    setHydrated(true);

    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      try {
        const historyRes = await fetch("/api/chat", { method: "GET", cache: "no-store" });
        const historyData = await historyRes.json().catch(() => ({}));
        if (historyRes.ok && Array.isArray(historyData?.messages) && historyData.messages.length) {
          const serverMessages = (
            historyData.messages as Array<{ role: "user" | "assistant"; content: string }>
          ).filter(
            (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim(),
          );
          const serverRaw: RawMsg[] = serverMessages.map((m) => ({ role: m.role, content: m.content }));
          const serverDisplay: DisplayMsg[] = serverMessages
            .map((m) => makeDisplay(m.role, m.content))
            .filter((m): m is DisplayMsg => Boolean(m));
          if (serverRaw.length) {
            setRawHistory(serverRaw.slice(-MAX_RAW_MESSAGES));
            setDisplayHistory(serverDisplay.slice(-MAX_DISPLAY_MESSAGES));
            persistRaw(serverRaw);
            persistDisplay(serverDisplay);
          }
        }
      } catch {
        // Server history is optional; local cache remains available.
      }

      const { data } = await supabase.from("users").select("timezone, preferences").eq("id", user.id).single();
      setTimezone(data?.timezone ?? "Asia/Jakarta");
      const prefs = (data?.preferences as { confirmDelete?: boolean; chatEnterToSend?: boolean } | null) ?? {};
      setConfirmDelete(prefs.confirmDelete !== false);
      setEnterToSend(prefs.chatEnterToSend !== false);
      try {
        setChatStyle(localStorage.getItem("licia-chat-style") || "soft");
        const storedMode = localStorage.getItem("licia-default-ai-mode");
        setMode(
          storedMode && ["assistant", "planner", "analyst", "operator", "reflector"].includes(storedMode)
            ? (storedMode as AiMode)
            : "assistant",
        );
        const storedResponse = localStorage.getItem("licia-ai-response-style");
        setResponseStyle(
          storedResponse === "short"
            ? "concise"
            : storedResponse && ["concise", "normal", "detailed"].includes(storedResponse)
              ? storedResponse
              : "normal",
        );
      } catch {}
    })();
  }, [searchParams]);

  useEffect(() => {
    const refreshPreferences = (event?: Event) => {
      const detail = (event as CustomEvent<{ chatEnterToSend?: boolean }> | undefined)?.detail;
      if (typeof detail?.chatEnterToSend === "boolean") setEnterToSend(detail.chatEnterToSend);
      try {
        const enter = localStorage.getItem("licia-chat-enter-to-send");
        if (enter !== null) setEnterToSend(enter === "true");
        const style = localStorage.getItem("licia-chat-style");
        if (style) setChatStyle(style);
        const storedMode = localStorage.getItem("licia-default-ai-mode");
        if (storedMode && ["assistant", "planner", "analyst", "operator", "reflector"].includes(storedMode))
          setMode(storedMode as AiMode);
        const storedResponse = localStorage.getItem("licia-ai-response-style");
        if (storedResponse && ["concise", "normal", "detailed"].includes(storedResponse))
          setResponseStyle(storedResponse);
      } catch {}
    };
    window.addEventListener("licia:preferences-change", refreshPreferences);
    return () => window.removeEventListener("licia:preferences-change", refreshPreferences);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    persistRaw(rawHistory);
    persistDisplay(displayHistory);
  }, [rawHistory, displayHistory, hydrated]);

  const displayMessages = useMemo(
    () => [{ ...GREETING, content: tr(GREETING.content) }, ...displayHistory],
    [displayHistory, tr],
  );

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

  async function handleSend(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if ((!text && !pendingImage) || loading || compressingImage) return;

    const imageToSend = pendingImage;
    const visibleUser: { text: string; imageUrl?: string } = imageToSend
      ? { text: text || tr("Tolong baca dan jelaskan gambar ini."), imageUrl: imageToSend }
      : { text };
    const turnId = `turn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const rawUser: RawMsg = imageToSend
      ? {
          __turnId: turnId,
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
      const controller = new AbortController();
      abortRef.current = controller;
      setLiveStatus(tr("Licia sedang berpikir…"));
      const res = await postChatStream(
        {
          message: text,
          history: sanitizeForApi(rawHistory),
          turnId,
          imageDataUrl: imageToSend,
          clientNowIso: new Date().toISOString(),
          pendingActionId: pendingAction?.pendingId ?? null,
          pendingScheduleImport,
          conversationState,
          mode,
          responseStyle,
        },
        {
          signal: controller.signal,
          onEvent: (ev) => {
            if (ev.type === "status") setLiveStatus(ev.text);
            else if (ev.type === "tool_start") setLiveStatus(ev.label);
          },
        },
      );

      const data = res.data ?? {};
      if (!res.ok) throw new Error(data.error || tr("Permintaan gagal."));

      const returned = Array.isArray(data.turnMessages)
        ? (data.turnMessages as RawMsg[]).map((m) => ({ ...m, __turnId: turnId }))
        : [];
      const assistant = [...returned]
        .reverse()
        .find((m) => m.role === "assistant" && extractDisplay(m.content).text.trim());
      const assistantDisplay = assistant ? makeDisplay("assistant", assistant.content, turnId) : null;
      const fallbackText =
        typeof data.reply === "string" && data.reply.trim()
          ? data.reply.trim()
          : tr("Aku belum mendapat jawaban yang bisa ditampilkan. Coba ulangi sebentar ya.");

      const finalAssistant: RawMsg | null = data.reply
        ? { __turnId: turnId, role: "assistant", content: String(data.reply) }
        : null;
      const returnedPending =
        data.pendingAction && typeof data.pendingAction === "object"
          ? ({
              ...(data.pendingAction as PendingAction),
              pendingId:
                typeof data.pendingActionId === "string"
                  ? data.pendingActionId
                  : (data.pendingAction as PendingAction).pendingId,
            } as PendingAction)
          : null;
      setPendingAction(returnedPending);
      const returnedConversationState =
        data.conversationState && typeof data.conversationState === "object"
          ? (data.conversationState as ConversationState)
          : null;
      if (returnedConversationState) {
        setConversationState(returnedConversationState);
        persistConversationState(returnedConversationState);
      }
      setUndoActionId(typeof data.undoActionId === "string" ? data.undoActionId : null);
      setPendingBulkAction(
        data.pendingBulkAction && typeof data.pendingBulkAction === "object"
          ? (data.pendingBulkAction as PendingBulkAction)
          : null,
      );
      const returnedScheduleImport =
        data.pendingScheduleImport && typeof data.pendingScheduleImport === "object"
          ? (data.pendingScheduleImport as PendingScheduleImport)
          : null;
      setPendingScheduleImport(returnedScheduleImport);
      persistPendingAction(returnedPending);
      persistPendingScheduleImport(returnedScheduleImport);
      setRawHistory((prev) => [...prev, rawUser, ...(finalAssistant ? [finalAssistant] : [])].slice(-MAX_RAW_MESSAGES));
      const actionSummary = Array.isArray(data.actions)
        ? (data.actions as ActionSummary[]).filter((a) => a?.ok).slice(-8)
        : [];
      const assistantMessage: DisplayMsg = assistantDisplay
        ? {
            ...assistantDisplay,
            aiMeta: data?.aiMeta || undefined,
            actionSummary,
            undoActionId: typeof data.undoActionId === "string" ? data.undoActionId : undefined,
            actionState: actionSummary.length ? "success" : undefined,
          }
        : {
            id: `assistant-${Date.now()}`,
            turnId,
            role: "assistant",
            content: fallbackText,
            createdAt: Date.now(),
            aiMeta: data?.aiMeta || undefined,
            actionSummary,
            undoActionId: typeof data.undoActionId === "string" ? data.undoActionId : undefined,
            actionState: actionSummary.length ? "success" : undefined,
          };
      appendDisplayMessage(setDisplayHistory, assistantMessage);
      if (Array.isArray(data.actions) && data.actions.some((a: any) => a?.ok))
        notifyToast({
          title: "Licia selesai menjalankan aksi",
          message: data.actions
            .filter((a: any) => a?.ok)
            .map((a: any) => a.label)
            .slice(0, 3)
            .join(" • "),
          tone: "success",
        });
    } catch (error) {
      setRawHistory((prev) => [...prev, rawUser].slice(-MAX_RAW_MESSAGES));
      const aborted = (error as any)?.name === "AbortError";
      const errorMessage: DisplayMsg = {
        id: `assistant-error-${Date.now()}`,
        turnId,
        role: "assistant",
        content: aborted
          ? tr("Dihentikan. Perubahan yang sudah sempat berjalan tetap tersimpan.")
          : error instanceof Error
            ? error.message
            : tr("Koneksi ke Licia terputus. Coba lagi sebentar ya."),
        createdAt: Date.now(),
      };
      appendDisplayMessage(setDisplayHistory, errorMessage);
      if (!aborted)
        notifyToast({ title: "Permintaan belum berhasil", message: errorMessage.content.slice(0, 120), tone: "error" });
    } finally {
      abortRef.current = null;
      setLiveStatus(null);
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter") return;

    // Android/iOS keyboards can report Enter while an IME composition is
    // active. keyCode 229 means the IME is still composing; keyCode 13 is
    // the actual Enter press and should remain actionable.
    const native = e.nativeEvent as KeyboardEvent;
    if (native.isComposing && native.keyCode === 229) return;

    const shouldSend = enterToSend ? !e.shiftKey : e.ctrlKey || e.metaKey;

    if (!shouldSend) return;

    e.preventDefault();
    e.stopPropagation();
    void handleSend();
  }

  const performDeleteTurn = useCallback((turnId?: string, messageId?: string) => {
    if (turnId) {
      setDisplayHistory((prev) => prev.filter((m) => m.turnId !== turnId));
      setRawHistory((prev) => prev.filter((m) => m.__turnId !== turnId));
    } else {
      setDisplayHistory((prev) => prev.filter((m) => m.id !== messageId));
    }
    notifyToast({
      title: "Pesan dihapus",
      message: "Percakapan tetap tersimpan untuk pesan lainnya.",
      tone: "success",
    });
  }, []);

  const deleteTurn = useCallback(
    (turnId?: string, messageId?: string) => {
      if (confirmDelete) setConfirmDialog({ kind: "message", turnId, messageId });
      else performDeleteTurn(turnId, messageId);
    },
    [confirmDelete, performDeleteTurn],
  );

  async function sendFeedback(message: DisplayMsg, useful: boolean, category = useful ? "useful" : "not_useful") {
    setDisplayHistory((prev) =>
      prev.map((item) => (item.id === message.id ? { ...item, feedback: useful ? "useful" : "not_useful" } : item)),
    );
    try {
      await fetch("/api/v38/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insightKey: `chat:${message.turnId || message.id}`,
          useful,
          category,
          messageExcerpt: message.content,
          context: message.aiMeta || {},
        }),
      });
      notifyToast({
        title: useful ? tr("Feedback tersimpan") : tr("Terima kasih"),
        message: useful
          ? tr("Licia akan mempertahankan pola jawaban ini.")
          : tr("Masukan ini dicatat untuk evaluasi jawaban AI."),
        tone: useful ? "success" : "warning",
      });
    } catch {}
  }

  async function undoLastAction(actionIdOverride?: string, messageId?: string) {
    const targetActionId = actionIdOverride || undoActionId;
    if (!targetActionId || undoing) return;
    setUndoing(true);
    try {
      const res = await fetch("/api/ai/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId: targetActionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || tr("Perubahan terakhir belum bisa dipulihkan."));
      setUndoActionId(null);
      notifyToast({ title: "Perubahan dibatalkan", message: "State terakhir dipulihkan.", tone: "success" });
      if (messageId)
        setDisplayHistory((prev) =>
          prev.map((item) =>
            item.id === messageId ? { ...item, undoActionId: undefined, actionState: "undone" } : item,
          ),
        );
      appendDisplayMessage(setDisplayHistory, {
        id: `assistant-undo-${Date.now()}`,
        role: "assistant",
        content: tr("Perubahan terakhir berhasil dibatalkan."),
        createdAt: Date.now(),
      });
    } catch (error) {
      appendDisplayMessage(setDisplayHistory, {
        id: `assistant-undo-error-${Date.now()}`,
        role: "assistant",
        content: error instanceof Error ? error.message : tr("Perubahan belum bisa dibatalkan."),
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
      const res = await fetch("/api/ai/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingId: pendingBulkAction.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || tr("Perubahan belum bisa diterapkan."));
      setPendingBulkAction(null);
      const returnedConversationState =
        data.conversationState && typeof data.conversationState === "object"
          ? (data.conversationState as ConversationState)
          : null;
      if (returnedConversationState) {
        setConversationState(returnedConversationState);
        persistConversationState(returnedConversationState);
      }
      setUndoActionId(typeof data.undoActionId === "string" ? data.undoActionId : null);
      notifyToast({
        title: "Perubahan diterapkan",
        message: data.partial
          ? tr("Sebagian perubahan berhasil diterapkan.")
          : tr("Semua perubahan yang disetujui berhasil diterapkan."),
        tone: data.partial ? "warning" : "success",
      });
      appendDisplayMessage(setDisplayHistory, {
        id: `assistant-bulk-${Date.now()}`,
        role: "assistant",
        content: data.partial
          ? tr("Sebagian perubahan berhasil diterapkan.")
          : tr("Semua perubahan yang kamu setujui berhasil diterapkan."),
        createdAt: Date.now(),
        actionSummary: Array.isArray(data.actions) ? data.actions.filter((a: any) => a?.ok).slice(-8) : [],
        undoActionId: typeof data.undoActionId === "string" ? data.undoActionId : undefined,
        actionState: data.partial ? "partial" : "success",
      });
    } catch (error) {
      appendDisplayMessage(setDisplayHistory, {
        id: `assistant-bulk-error-${Date.now()}`,
        role: "assistant",
        content: error instanceof Error ? error.message : tr("Perubahan belum bisa diterapkan."),
        createdAt: Date.now(),
      });
    } finally {
      setApplyingBulk(false);
    }
  }

  async function cancelBulkAction() {
    if (!pendingBulkAction || applyingBulk) return;
    try {
      await fetch("/api/ai/batch", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingId: pendingBulkAction.id }),
      });
    } catch {}
    setPendingBulkAction(null);
  }

  function performClearChat() {
    setRawHistory([]);
    setDisplayHistory([]);
    setPendingAction(null);
    setPendingBulkAction(null);
    setUndoActionId(null);
    setConversationState(null);
    // Hapus juga salinan server-side agar tombol "Bersihkan chat" konsisten
    // lintas perangkat.
    fetch("/api/chat", { method: "DELETE" }).catch(() => {});
    try {
      localStorage.removeItem(STORAGE_RAW);
      localStorage.removeItem(STORAGE_DISPLAY);
      localStorage.removeItem(STORAGE_PENDING);
      localStorage.removeItem(STORAGE_PENDING_SCHEDULE);
      localStorage.removeItem(STORAGE_CONVERSATION_STATE);
    } catch {}
    notifyToast({ title: "Percakapan dibersihkan", message: "Licia siap memulai percakapan baru.", tone: "success" });
  }

  function clearChat() {
    if (confirmDelete) setConfirmDialog({ kind: "clear" });
    else performClearChat();
    setShowChatMenu(false);
  }

  function resetConversationContext() {
    setConversationState(null);
    persistConversationState(null);
    notifyToast({
      title: "Fokus percakapan direset",
      message: "Licia akan membaca pesan berikutnya sebagai topik baru.",
      tone: "success",
    });
  }

  const modeLabel =
    mode === "assistant"
      ? "Assistant"
      : mode === "planner"
        ? "Planner"
        : mode === "analyst"
          ? "Analyst"
          : mode === "operator"
            ? "Operator"
            : "Reflektor";
  const latestAiMessage = [...displayHistory]
    .reverse()
    .find((item) => item.role === "assistant" && item.id !== "greeting");
  const contextLabel = latestAiMessage?.aiMeta?.domains?.length
    ? latestAiMessage.aiMeta.domains
        .slice(0, 3)
        .map((item) => item.replaceAll("_", " "))
        .join(" · ")
    : "Konteks cerdas";
  return (
    <div
      data-chat-style={chatStyle}
      className={clsx(
        "chat-v48 flex min-w-0 flex-col overflow-hidden rounded-[1.25rem] border border-border bg-surface",
        compact ? "h-[500px]" : "h-[calc(100dvh-108px)] min-h-[430px] max-h-[900px] sm:rounded-[1.5rem]",
      )}
    >
      <header className="chat-v48-header relative z-30 flex shrink-0 items-center gap-2.5 border-b border-border/80 bg-surface px-3 py-3 sm:px-4">
        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-xl ring-1 ring-accent/15">
          <Image src="/licia-avatar.png" alt={tr("Licia")} fill sizes="32px" className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <h1 className="truncate font-display text-[14px] text-text">{tr("Licia")}</h1>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-1.5 py-0.5 text-2xs font-bold text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> {tr("siap")}
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-2xs text-textMuted">{tr("Asisten pribadi terhubung ke Life OS")}</p>
            {conversationState?.activeDomain && conversationState.activeDomain !== "overview" && (
              <button
                type="button"
                onClick={resetConversationContext}
                className="shrink-0 rounded-full bg-accent/5 px-1.5 py-0.5 text-2xs font-semibold text-accent hover:bg-accent/10"
                title={tr("Mulai topik baru")}
              >
                {tr("Fokus:")} {conversationState.activeDomain.replaceAll("_", " ")} · ×
              </button>
            )}
          </div>
        </div>
        <span className="hidden shrink-0 rounded-full border border-border bg-bg px-2 py-1 text-2xs font-semibold text-textMuted sm:inline-flex">
          {modeLabel}
        </span>
        <button
          onClick={() => setShowChatMenu((v) => !v)}
          className="touch-target shrink-0 rounded-xl border border-border bg-bg text-textMuted transition hover:border-accent/30 hover:text-accent"
          title={tr("Opsi chat")}
          aria-label={tr("Opsi chat")}
          aria-expanded={showChatMenu}
        >
          <MoreHorizontal size={17} />
        </button>
        {showChatMenu && (
          <div className="chat-v48-menu absolute right-2 top-[3.6rem] z-40 w-[min(300px,calc(100vw-1rem))] rounded-2xl border border-border bg-surface p-2.5 shadow-2xl sm:right-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="rounded-xl border border-border bg-bg p-2.5">
                <span className="block text-2xs font-semibold text-textMuted">{tr("Mode")}</span>
                <select
                  value={mode}
                  onChange={(e) => {
                    const value = e.target.value as AiMode;
                    setMode(value);
                    try {
                      localStorage.setItem("licia-default-ai-mode", value);
                      window.dispatchEvent(new CustomEvent("licia:preferences-change"));
                    } catch {}
                  }}
                  className="mt-1 w-full bg-transparent text-xs font-semibold text-text outline-none"
                >
                  <option value="assistant">{tr("Assistant")}</option>
                  <option value="planner">{tr("Planner")}</option>
                  <option value="analyst">{tr("Analyst")}</option>
                  <option value="operator">{tr("Operator")}</option>
                  <option value="reflector">{tr("Reflektor")}</option>
                </select>
              </label>
              <label className="rounded-xl border border-border bg-bg p-2.5">
                <span className="block text-2xs font-semibold text-textMuted">{tr("Jawaban")}</span>
                <select
                  value={responseStyle}
                  onChange={(e) => {
                    const value = e.target.value;
                    setResponseStyle(value);
                    try {
                      localStorage.setItem("licia-ai-response-style", value);
                      window.dispatchEvent(new CustomEvent("licia:preferences-change"));
                    } catch {}
                  }}
                  className="mt-1 w-full bg-transparent text-xs font-semibold text-text outline-none"
                >
                  <option value="concise">{tr("Ringkas")}</option>
                  <option value="normal">{tr("Normal")}</option>
                  <option value="detailed">{tr("Detail")}</option>
                </select>
              </label>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Link
                href="/guide"
                onClick={() => setShowChatMenu(false)}
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-bg text-2xs font-semibold text-textMuted hover:text-accent"
              >
                <CircleHelp size={13} /> {tr("Panduan")}
              </Link>
              <button
                onClick={clearChat}
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-danger/15 bg-danger/5 text-2xs font-semibold text-danger"
              >
                <Trash2 size={13} /> {tr("Bersihkan")}
              </button>
            </div>
          </div>
        )}
      </header>

      <div
        ref={scrollRef}
        className="chat-v48-pane min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5 sm:py-6"
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3.5 sm:gap-4">
          {displayHistory.length === 0 && (
            <section className="chat-v48-welcome rounded-[1.35rem] border border-accent/15 bg-accent/[.045] p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl border border-accent/15 bg-bg">
                  <Image src="/licia-avatar.png" alt={tr("Licia")} fill sizes="44px" className="object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xs font-bold uppercase tracking-[.15em] text-accent">
                    {tr("Teman berpikir · Life OS")}
                  </p>
                  <h2 className="mt-1 font-display text-xl leading-tight text-text">
                    {tr("Apa yang bisa kita bereskan?")}
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-textMuted">
                    {tr(
                      "Tulis saja tujuanmu. Licia akan memilih konteks yang relevan dan mengerjakan aksi terstruktur tanpa memaksa kamu berpindah halaman.",
                    )}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setInput(tr("Apa yang paling penting hari ini?"))}
                  className="chat-v48-prompt rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-2xs font-semibold text-textMuted hover:border-accent/25 hover:text-accent"
                >
                  {tr("Apa yang penting hari ini?")}
                </button>
                <button
                  type="button"
                  onClick={() => setInput(tr("Rapikan jadwal saya hari ini dan cek konflik."))}
                  className="chat-v48-prompt rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-2xs font-semibold text-textMuted hover:border-accent/25 hover:text-accent"
                >
                  {tr("Rapikan jadwal hari ini")}
                </button>
                <button
                  type="button"
                  onClick={() => setInput(tr("Buat tugas dari ini dan beri langkah pertama yang jelas."))}
                  className="chat-v48-prompt rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-2xs font-semibold text-textMuted hover:border-accent/25 hover:text-accent"
                >
                  {tr("Susun tugas")}
                </button>
              </div>
            </section>
          )}

          {displayMessages.map((message, index) => (
            <ChatMessage
              key={message.id}
              message={message}
              timezone={timezone}
              onDelete={deleteTurn}
              onFeedback={sendFeedback}
              onUndo={(actionId, messageId) => void undoLastAction(actionId, messageId)}
              showAvatar={message.role === "user" || index === 0 || displayMessages[index - 1]?.role !== "assistant"}
            />
          ))}
          {loading && (
            <div className="flex items-end gap-2 animate-licia-slide-in">
              <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-xl ring-1 ring-border">
                <Image src="/licia-avatar.png" alt={tr("Licia")} fill sizes="28px" className="object-cover" />
              </div>
              <div className="rounded-[1rem] rounded-bl-md border border-border bg-bg px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce" />
                  <span className="h-1.5 w-1.5 rounded-full bg-accent/70 animate-bounce [animation-delay:120ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-accent/40 animate-bounce [animation-delay:240ms]" />
                  {liveStatus && (
                    <span role="status" aria-live="polite" className="ml-1 text-2xs text-textMuted">
                      {liveStatus}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => abortRef.current?.abort()}
                    className="ml-2 rounded-lg border border-border px-2 py-0.5 text-2xs font-semibold text-textMuted hover:text-danger"
                    aria-label={tr("Hentikan jawaban")}
                  >
                    {tr("Stop")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {pendingAction && (
            <div className="chat-v48-inline-action rounded-2xl border border-danger/20 bg-danger/5 p-3 animate-licia-slide-in">
              <div className="flex items-start gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger">
                  <ShieldCheck size={13} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-2xs font-bold uppercase tracking-[.12em] text-danger">
                    {tr("Menunggu konfirmasi")}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-text">
                    {pendingAction.label || tr("Target ini")} {tr("siap dihapus.")}
                  </p>
                  <p className="mt-1 text-2xs leading-relaxed text-textMuted">
                    {tr("Pastikan targetnya benar sebelum Licia melanjutkan.")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => void handleSend("iya")}
                      disabled={loading}
                      className="rounded-xl bg-danger px-3 py-2 text-2xs font-semibold text-white"
                    >
                      {tr("Konfirmasi hapus")}
                    </button>
                    <button
                      onClick={() => {
                        setPendingAction(null);
                        persistPendingAction(null);
                      }}
                      disabled={loading}
                      className="rounded-xl border border-border bg-bg px-3 py-2 text-2xs font-semibold text-textMuted"
                    >
                      {tr("Batal")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {pendingBulkAction && (
            <div className="chat-v48-inline-action chat-v50-pending-action rounded-2xl border border-border bg-surface p-3 animate-licia-slide-in">
              <div className="flex items-start gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Layers3 size={13} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-2xs font-bold uppercase tracking-[.12em] text-accent">
                    {tr("Menunggu persetujuan")}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-text">{tr("Ada perubahan yang siap diterapkan.")}</p>
                  <p className="mt-1 text-2xs leading-relaxed text-textMuted">
                    {tr("Tinjau aksi ini dari percakapan, lalu terapkan atau tolak tanpa membuka halaman lain.")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => void applyBulkAction()}
                      disabled={applyingBulk}
                      className="rounded-xl bg-accent px-3 py-2 text-2xs font-semibold text-white"
                    >
                      {applyingBulk ? tr("Menerapkan…") : tr("Terapkan")}
                    </button>
                    <button
                      onClick={() => void cancelBulkAction()}
                      className="rounded-xl border border-border bg-bg px-3 py-2 text-2xs font-semibold text-textMuted"
                    >
                      {tr("Tolak")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {latestAiMessage?.aiMeta && (
            <div className="chat-v48-context flex flex-wrap items-center gap-1.5 px-1 pb-1 text-2xs text-textMuted">
              <span className="rounded-full border border-border bg-bg px-2 py-1 font-semibold">
                {tr("Konteks: {contextLabel}", { contextLabel })}
              </span>
              {latestAiMessage.aiMeta.temporalGuard && (
                <span className="rounded-full bg-accent/5 px-2 py-1 font-semibold text-accent">
                  {tr("Tanggal tervalidasi")}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="chat-v48-composer shrink-0 border-t border-border/80 bg-surface/95 px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:px-4 sm:pb-3">
        <div className="mx-auto max-w-2xl">
          {pendingImage && (
            <div className="mb-1.5 flex items-center gap-2 rounded-xl border border-border bg-bg px-2.5 py-1.5">
              <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg">
                <img src={pendingImage} alt={tr("Lampiran")} className="h-full w-full object-cover" />
              </div>
              <span className="min-w-0 flex-1 truncate text-2xs text-textMuted">{tr("Gambar siap dikirim")}</span>
              <button
                onClick={() => setPendingImage(null)}
                className="touch-target text-textMuted hover:text-danger"
                aria-label={tr("Hapus gambar")}
              >
                <X size={13} />
              </button>
            </div>
          )}
          <div className="chat-v48-composer-row flex items-end gap-1.5 rounded-[1.25rem] border border-border/80 bg-bg p-1.5 shadow-sm transition focus-within:border-accent/45 focus-within:ring-4 focus-within:ring-accent/5">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="touch-target shrink-0 rounded-xl text-textMuted transition hover:bg-surface hover:text-accent"
              title={tr("Lampirkan gambar")}
              aria-label={tr("Lampirkan gambar")}
            >
              <Paperclip size={16} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handlePickImage}
              className="hidden"
            />
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              enterKeyHint={enterToSend ? "send" : "enter"}
              onPaste={handlePaste}
              disabled={loading}
              rows={1}
              placeholder={tr("Tulis ke Licia…")}
              className="max-h-36 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-1.5 py-2.5 text-sm leading-relaxed text-text outline-none placeholder:text-textMuted"
            />
            <button
              onClick={() => void handleSend()}
              disabled={loading || compressingImage || (!input.trim() && !pendingImage)}
              className="touch-target flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white shadow-md shadow-accent/15 transition hover:scale-[1.02] active:scale-95 disabled:opacity-40"
              title={tr("Kirim")}
              aria-label={tr("Kirim")}
            >
              <Send size={16} />
            </button>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 px-1">
            <p className="hidden truncate text-2xs text-textMuted sm:block">
              {enterToSend ? tr("Enter kirim · Shift+Enter baris baru") : tr("Enter baris baru · Ctrl/Cmd+Enter kirim")}
            </p>
            <p className="truncate text-2xs text-textMuted">
              {compressingImage
                ? tr("Menyiapkan gambar…")
                : tr("Licia mengingat beberapa percakapan terakhir dan memilih konteks yang paling relevan")}
            </p>
          </div>
        </div>
      </div>
      <ActionDialog
        open={Boolean(confirmDialog)}
        title={confirmDialog?.kind === "clear" ? tr("Bersihkan percakapan?") : tr("Hapus pesan?")}
        description={
          confirmDialog?.kind === "clear"
            ? tr("Riwayat chat lokal Licia akan dihapus dari perangkat ini.")
            : tr("Pesan dan pasangan jawabannya akan dihapus dari riwayat percakapan.")
        }
        tone="danger"
        confirmLabel={confirmDialog?.kind === "clear" ? tr("Bersihkan") : tr("Hapus")}
        onClose={() => setConfirmDialog(null)}
        onConfirm={() => {
          const target = confirmDialog;
          if (!target) return;
          setConfirmDialog(null);
          if (target.kind === "clear") performClearChat();
          else performDeleteTurn(target.turnId, target.messageId);
        }}
      />
    </div>
  );
}
