import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Minimal unauthenticated probe for external uptime monitoring. */
export async function GET() {
  const started = Date.now();
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("users").select("id").limit(1);
    const ok = !error;
    return NextResponse.json(
      { ok, app: "licia", latency_ms: Date.now() - started, at: new Date().toISOString() },
      { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, app: "licia", error: "healthcheck_failed", latency_ms: Date.now() - started },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
