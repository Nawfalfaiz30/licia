import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Dipanggil Supabase setelah pengguna berhasil login lewat provider OAuth
// (Google, dll). Kode di query string ditukar jadi sesi login, lalu diarahkan
// ke dashboard. Baris profil (public.users) dibuat otomatis oleh trigger
// database yang sama dipakai signup email/password (lihat fix_auto_profile.sql),
// jadi tidak perlu logic tambahan di sini.
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proxyOrigin = forwardedHost && forwardedProto ? `${forwardedProto}://${forwardedHost}` : null;

  let redirectOrigin = requestUrl.origin;
  if (process.env.NODE_ENV === "production") {
    const candidates = [proxyOrigin, process.env.NEXT_PUBLIC_SITE_URL, process.env.APP_URL, requestUrl.origin];
    for (const candidate of candidates) {
      if (!candidate?.trim()) continue;
      try {
        const configured = new URL(candidate.trim());
        const isLoopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(configured.hostname.toLowerCase());
        if ((configured.protocol === "http:" || configured.protocol === "https:") && !isLoopback) {
          redirectOrigin = configured.origin;
          break;
        }
      } catch {
        // Invalid env values are handled by the production preflight.
      }
    }
  }

  return NextResponse.redirect(new URL("/dashboard", redirectOrigin));
}
