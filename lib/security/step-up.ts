import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const STEP_UP_WINDOW_MS = 10 * 60 * 1000;

export const STEP_UP_REQUIRED_AI_TOOLS = new Set([
  "delete_tasks_bulk",
  "delete_schedule_blocks_bulk",
  "delete_all_reminders",
  "delete_all_notifications",
  "delete_account",
  "create_vault_item",
  "update_vault_item",
  "delete_vault_item",
  "transfer_money",
]);

export function toolRequiresStepUp(toolName: string): boolean {
  return STEP_UP_REQUIRED_AI_TOOLS.has(String(toolName || ""));
}

export function syncMutationRequiresStepUp(entityType: string, operation: string): boolean {
  if (entityType === "vault") return true;
  if (entityType === "accountTransfer") return true;
  return entityType === "account" && operation === "delete";
}

type JwtClaim = {
  method?: unknown;
  timestamp?: unknown;
};

export type StepUpState = {
  status: "fresh" | "required" | "unavailable";
  aal: "aal1" | "aal2";
  lastMfaAt: number | null;
};

function normalizeStepUpTimestamp(value: unknown): number | null {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return seconds > 10_000_000_000 ? seconds : seconds * 1000;
}

export function latestMfaTimestamp(amr: unknown): number | null {
  if (!Array.isArray(amr)) return null;
  const timestamps = (amr as JwtClaim[])
    .filter((item) => {
      const method = String(item?.method || "").toLowerCase();
      return method === "totp" || method === "otp" || method === "recovery";
    })
    .map((item) => normalizeStepUpTimestamp(item?.timestamp))
    .filter((value): value is number => value !== null);
  return timestamps.length ? Math.max(...timestamps) : null;
}

export function isRecentStepUp(aal: unknown, lastMfaAt: number | null, now = Date.now()): boolean {
  return aal === "aal2" && lastMfaAt !== null && now - lastMfaAt >= 0 && now - lastMfaAt <= STEP_UP_WINDOW_MS;
}

export function safeStepUpNextPath(value: string | null | undefined, fallback = "/chat"): string {
  const raw = String(value || "").trim();
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.includes("\n") || raw.includes("\r")) {
    return fallback;
  }
  try {
    const parsed = new URL(raw, "https://licia.invalid");
    if (parsed.origin !== "https://licia.invalid") return fallback;
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return fallback;
  }
}

export function buildStepUpUrl(nextPath = "/chat"): string {
  return `/step-up?next=${encodeURIComponent(safeStepUpNextPath(nextPath))}`;
}

export async function getStepUpState(supabase: SupabaseClient): Promise<StepUpState> {
  try {
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims) return { status: "unavailable", aal: "aal1", lastMfaAt: null };
    const claims = data.claims as Record<string, unknown>;
    const aal = claims.aal === "aal2" ? "aal2" : "aal1";
    const lastMfaAt = latestMfaTimestamp(claims.amr);
    return {
      status: isRecentStepUp(aal, lastMfaAt) ? "fresh" : "required",
      aal,
      lastMfaAt,
    };
  } catch {
    return { status: "unavailable", aal: "aal1", lastMfaAt: null };
  }
}

export async function requireRecentStepUp(
  supabase: SupabaseClient,
  nextPath: string,
): Promise<NextResponse | null> {
  const state = await getStepUpState(supabase);
  if (state.status === "fresh") return null;

  if (state.status === "unavailable") {
    return NextResponse.json(
      {
        ok: false,
        code: "STEP_UP_UNAVAILABLE",
        error: "Verifikasi keamanan tambahan sedang tidak tersedia. Coba lagi sebentar.",
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(
    {
      ok: false,
      code: "STEP_UP_REQUIRED",
      error: "Verifikasi keamanan tambahan diperlukan sebelum aksi sensitif.",
      stepUpUrl: buildStepUpUrl(nextPath),
      reauthenticateWithinMinutes: Math.ceil(STEP_UP_WINDOW_MS / 60_000),
      aal: state.aal,
    },
    {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export function stepUpToolResponse(nextPath = "/chat") {
  return {
    ok: false,
    code: "STEP_UP_REQUIRED",
    error: "Verifikasi keamanan tambahan diperlukan sebelum aksi sensitif.",
    step_up_url: buildStepUpUrl(nextPath),
    reauthenticate_within_minutes: Math.ceil(STEP_UP_WINDOW_MS / 60_000),
    retry_after_step_up: true,
  };
}
