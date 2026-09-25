import { NextResponse } from "next/server";
import { isPushConfigured } from "@/lib/notifications/push";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    enabled: isPushConfigured(),
    publicKey: isPushConfigured() ? process.env.VAPID_PUBLIC_KEY!.trim() : null,
    serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    cronConfigured: Boolean(process.env.LICIA_CRON_SECRET?.trim()),
  }, { headers: { "Cache-Control": "no-store" } });
}
