import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
let lastPrunedAt = 0;
function pruneExpired(t: number) {
  if (t - lastPrunedAt < 60_000) return;
  lastPrunedAt = t;
  for (const [k, v] of buckets) if (v.resetAt <= t) buckets.delete(k);
}

function now() {
  return Date.now();
}

function firstForwardedValue(value: string | null): string {
  return value?.split(",")[0]?.trim() || "";
}

function parseForwardedPair(header: string, key: string): string {
  const firstElement = header.split(",")[0] || "";
  const match = firstElement.match(new RegExp(`(?:^|;)\\s*${key}=([^;]+)`, "i"));
  return match?.[1]?.trim().replace(/^"|"$/g, "") || "";
}

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

function requestOriginCandidates(req: Request): string[] {
  const fallbackUrl = new URL(req.url);
  const forwarded = req.headers.get("forwarded") || "";
  const forwardedProto = parseForwardedPair(forwarded, "proto");
  const forwardedHost = parseForwardedPair(forwarded, "host");
  const proto =
    firstForwardedValue(req.headers.get("x-forwarded-proto")) ||
    forwardedProto ||
    fallbackUrl.protocol.replace(":", "");
  const host =
    firstForwardedValue(req.headers.get("x-forwarded-host")) ||
    forwardedHost ||
    req.headers.get("host") ||
    fallbackUrl.host;
  const candidates = new Set<string>();
  const normalizedRequest = normalizeOrigin(`${proto}://${host}`);
  const normalizedUrl = normalizeOrigin(fallbackUrl.origin);
  if (normalizedRequest) candidates.add(normalizedRequest);
  if (normalizedUrl) candidates.add(normalizedUrl);
  return [...candidates];
}

function isDevelopmentLoopbackOrigin(origin: string): boolean {
  if (process.env.NODE_ENV === "production") return false;
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    const isLoopback = host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
    return (url.protocol === "http:" || url.protocol === "https:") && isLoopback;
  } catch {
    return false;
  }
}

function isDevelopmentTunnel(origin: string): boolean {
  if (process.env.NODE_ENV === "production") return false;
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      (host.endsWith(".devtunnels.ms") ||
        host.endsWith(".app.github.dev") ||
        host.endsWith(".github.dev") ||
        host.endsWith(".githubpreview.dev"))
    );
  } catch {
    return false;
  }
}

function isLoopback(origin: string): boolean {
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
  } catch {
    return false;
  }
}

function isConfiguredDevTunnelPair(req: Request, origin: string): boolean {
  if (!isLoopback(origin)) return false;

  const configuredTunnel = normalizeOrigin(process.env.DEV_TUNNEL_ORIGIN);
  if (!configuredTunnel) return false;

  const forwardedProto =
    firstForwardedValue(req.headers.get("x-forwarded-proto")) ||
    parseForwardedPair(req.headers.get("forwarded") || "", "proto");
  const forwardedHost =
    firstForwardedValue(req.headers.get("x-forwarded-host")) ||
    parseForwardedPair(req.headers.get("forwarded") || "", "host");
  if (!forwardedHost) return false;

  const forwardedOrigin = normalizeOrigin(`${forwardedProto || "https"}://${forwardedHost}`);
  return Boolean(forwardedOrigin && forwardedOrigin === configuredTunnel);
}

function addDevelopmentLoopbackOrigins(req: Request, allowed: Set<string>) {
  const explicit = (process.env.LICIA_DEV_ORIGINS || "")
    .split(",")
    .map((value) => normalizeOrigin(value))
    .filter((value): value is string => Boolean(value));
  for (const origin of explicit) allowed.add(origin);

  // Local browser requests are common when developing through a VS Code
  // dev tunnel. Only allow loopback origins automatically when the incoming
  // forwarded host matches the explicitly configured DEV_TUNNEL_ORIGIN.
  if (process.env.NODE_ENV !== "production" || explicit.length > 0) {
    const fallbackUrl = new URL(req.url);
    const hosts = [
      req.headers.get("host"),
      firstForwardedValue(req.headers.get("x-forwarded-host")),
      parseForwardedPair(req.headers.get("forwarded") || "", "host"),
      fallbackUrl.host,
    ].filter(Boolean) as string[];

    const ports = new Set<string>();
    for (const rawHost of hosts) {
      try {
        const parsed = new URL(`http://${rawHost}`);
        if (parsed.port) ports.add(parsed.port);
      } catch {
        // Ignore malformed forwarded host values.
      }
    }
    if (!ports.size) ports.add(fallbackUrl.port || "3000");

    for (const port of ports) {
      for (const scheme of ["http", "https"]) {
        allowed.add(`${scheme}://localhost:${port}`);
        allowed.add(`${scheme}://127.0.0.1:${port}`);
        allowed.add(`${scheme}://[::1]:${port}`);
      }
    }
  }
}

export function enforceSameOrigin(req: Request): NextResponse | null {
  const rawOrigin = req.headers.get("origin");
  const normalizedRawOrigin = rawOrigin?.trim().toLowerCase() || "";
  const unsafeMethod = /^(POST|PUT|PATCH|DELETE)$/i.test(req.method);
  if ((!rawOrigin || normalizedRawOrigin === "null") && unsafeMethod) {
    const fetchSite = (req.headers.get("sec-fetch-site") || "").trim().toLowerCase();
    const allowMissingOrigin =
      process.env.NODE_ENV !== "production" || /^(1|true|yes|on)$/i.test(process.env.LICIA_ALLOW_MISSING_ORIGIN || "");
    if (!allowMissingOrigin && ["cross-site", "same-site"].includes(fetchSite)) {
      return NextResponse.json({ error: "Permintaan lintas-site tidak diizinkan." }, { status: 403 });
    }
    if (!rawOrigin) return null;
  }
  if (!rawOrigin || normalizedRawOrigin === "null") return null;

  const origin = normalizeOrigin(rawOrigin);
  if (!origin) {
    console.warn("[security] Rejected invalid origin", {
      origin: rawOrigin,
      method: req.method,
      path: new URL(req.url).pathname,
    });
    return NextResponse.json({ error: "Origin tidak valid." }, { status: 403 });
  }

  const allowed = new Set<string>(requestOriginCandidates(req));
  for (const raw of [process.env.NEXT_PUBLIC_SITE_URL, process.env.APP_URL, process.env.DEV_TUNNEL_ORIGIN]) {
    const normalized = normalizeOrigin(raw);
    if (normalized) allowed.add(normalized);
  }
  addDevelopmentLoopbackOrigins(req, allowed);

  if (
    allowed.has(origin) ||
    isDevelopmentTunnel(origin) ||
    isDevelopmentLoopbackOrigin(origin) ||
    isConfiguredDevTunnelPair(req, origin)
  )
    return null;

  console.warn("[security] Rejected cross-origin API request", {
    origin,
    allowed: [...allowed],
    method: req.method,
    path: new URL(req.url).pathname,
    host: req.headers.get("host") || null,
    forwardedHost: req.headers.get("x-forwarded-host") || null,
    forwardedProto: req.headers.get("x-forwarded-proto") || null,
  });
  return NextResponse.json({ error: "Permintaan lintas-origin tidak diizinkan." }, { status: 403 });
}

export async function distributedRateLimit(
  supabase: SupabaseClient,
  bucketKey: string,
  limit: number,
  windowMs: number,
  localFallbackKey: string = bucketKey,
  options: { failClosed?: boolean } = {},
): Promise<NextResponse | null> {
  try {
    const { data, error } = await supabase.rpc("licia_rate_limit", {
      p_bucket_key: bucketKey,
      p_limit: limit,
      p_window_seconds: Math.max(1, Math.ceil(windowMs / 1000)),
    });
    if (!error && data && typeof data === "object" && !Array.isArray(data)) {
      const allowed = (data as { allowed?: unknown }).allowed;
      if (allowed === false) {
        const retryAfter = Math.max(
          1,
          Number((data as { retry_after_seconds?: unknown }).retry_after_seconds) || Math.ceil(windowMs / 1000),
        );
        return new NextResponse(JSON.stringify({ error: "Terlalu banyak permintaan. Coba lagi sebentar." }), {
          status: 429,
          headers: { "content-type": "application/json", "retry-after": String(retryAfter) },
        });
      }
      if (allowed === true) return null;
    }
    if (error) console.warn("Licia distributed rate limit unavailable", { code: error.code || "unknown" });
    else console.warn("Licia distributed rate limit returned an invalid response");
  } catch (error) {
    console.warn("Licia distributed rate limit unavailable", {
      name: error instanceof Error ? error.name : "unknown",
    });
  }
  if (options.failClosed && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Pembatasan permintaan sementara tidak tersedia. Coba lagi sebentar." },
      { status: 503, headers: { "retry-after": "30" } },
    );
  }
  return rateLimit(localFallbackKey, limit, windowMs);
}

export function authenticatedRateLimit(
  supabase: SupabaseClient,
  userId: string,
  bucketKey: string,
  limit: number,
  windowMs: number,
): Promise<NextResponse | null> {
  return distributedRateLimit(supabase, bucketKey, limit, windowMs, `${bucketKey}:${userId}`, { failClosed: true });
}

/** Shared limiter for signed or high-entropy external tokens using the service-role client. */
export async function distributedExternalRateLimit(
  supabase: SupabaseClient,
  tokenHash: string,
  limit: number,
  windowMs: number,
  localFallbackKey: string,
): Promise<NextResponse | null> {
  try {
    const { data, error } = await supabase.rpc("licia_rate_limit_external", {
      p_bucket_key: tokenHash,
      p_limit: limit,
      p_window_seconds: Math.max(1, Math.ceil(windowMs / 1000)),
    });
    if (!error && data && typeof data === "object" && !Array.isArray(data)) {
      const allowed = (data as { allowed?: unknown }).allowed;
      if (allowed === false) {
        const retryAfter = Math.max(
          1,
          Number((data as { retry_after_seconds?: unknown }).retry_after_seconds) || Math.ceil(windowMs / 1000),
        );
        return new NextResponse(JSON.stringify({ error: "Terlalu banyak permintaan. Coba lagi sebentar." }), {
          status: 429,
          headers: { "content-type": "application/json", "retry-after": String(retryAfter) },
        });
      }
      if (allowed === true) return null;
    }
    if (error) console.warn("Licia external rate limit unavailable", { code: error.code || "unknown" });
  } catch (error) {
    console.warn("Licia external rate limit unavailable", {
      name: error instanceof Error ? error.name : "unknown",
    });
  }
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Pembatasan permintaan sementara tidak tersedia. Coba lagi sebentar." },
      { status: 503, headers: { "retry-after": "30" } },
    );
  }
  return rateLimit(localFallbackKey, limit, windowMs);
}

export function rateLimit(key: string, limit: number, windowMs: number): NextResponse | null {
  const t = now();
  pruneExpired(t);
  const current = buckets.get(key);
  if (!current || current.resetAt <= t) {
    buckets.set(key, { count: 1, resetAt: t + windowMs });
    return null;
  }
  current.count += 1;
  if (current.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((current.resetAt - t) / 1000));
    return new NextResponse(JSON.stringify({ error: "Terlalu banyak permintaan. Coba lagi sebentar." }), {
      status: 429,
      headers: { "content-type": "application/json", "retry-after": String(retryAfter) },
    });
  }
  return null;
}

export function assertJsonSize(req: Request, maxBytes: number): NextResponse | null {
  const raw = req.headers.get("content-length");
  if (raw && Number(raw) > maxBytes) {
    return NextResponse.json(
      { error: `Payload terlalu besar. Batas sekitar ${Math.round(maxBytes / 1024 / 1024)} MB.` },
      { status: 413 },
    );
  }
  return null;
}
