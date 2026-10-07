import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertJsonSize, distributedRateLimit, enforceSameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IP_BUCKETS = new Map<string, { count: number; resetAt: number }>();

function getClientKey(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const sizeError = assertJsonSize(req, 16 * 1024);
  if (sizeError) return sizeError;

  const ip = getClientKey(req);
  const now = Date.now();
  const current = IP_BUCKETS.get(ip);
  if (!current || current.resetAt <= now) {
    IP_BUCKETS.set(ip, { count: 1, resetAt: now + 60_000 });
  } else if (++current.count > 60) {
    return NextResponse.json({ error: "Terlalu banyak telemetry." }, { status: 429, headers: { "retry-after": "60" } });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 204 });

  const distributed = await distributedRateLimit(supabase, "web-vitals", 30, 60_000, "web-vitals:" + user.id);
  if (distributed) return distributed;

  const body = await req.json().catch(() => ({}));
  const metric = String(body?.metric || "").toUpperCase();
  const value = Number(body?.value);
  const pathname = String(body?.pathname || "/").slice(0, 300);
  const device = String(body?.device || "").slice(0, 120);

  if (!["LCP", "INP", "CLS"].includes(metric) || !Number.isFinite(value) || value < 0 || !pathname.startsWith("/")) {
    return NextResponse.json({ error: "Metric telemetry tidak valid." }, { status: 400 });
  }

  const { error } = await supabase.from("web_vitals").insert({
    user_id: user.id,
    metric,
    value,
    pathname,
    device: device || null,
  });
  if (error) return NextResponse.json({ error: "Telemetry gagal disimpan." }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
