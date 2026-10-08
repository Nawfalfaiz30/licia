import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const started = Date.now();
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
    const db = await supabase.from("users").select("id").limit(1);
    const [reminders, notificationEvents, pushSubscriptions] = await Promise.all([
      supabase.from("reminders").select("id", { count: "exact", head: true }),
      supabase.from("notification_events").select("id", { count: "exact", head: true }),
      supabase.from("push_subscriptions").select("id", { count: "exact", head: true }),
    ]);
    const database = !db.error;
    const features = {
      reminders: !reminders.error,
      notificationEvents: !notificationEvents.error,
      pushSubscriptions: !pushSubscriptions.error,
    };
    const ok = database && supabaseConfigured && Object.values(features).every(Boolean);
    return NextResponse.json(
      {
        ok,
        app: "licia",
        database,
        configuration: { supabaseConfigured, openaiConfigured },
        features,
        latency_ms: Date.now() - started,
        at: new Date().toISOString(),
      },
      { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        app: "licia",
        error: "healthcheck_failed",
        database: false,
        configuration: { supabaseConfigured, openaiConfigured },
        latency_ms: Date.now() - started,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
