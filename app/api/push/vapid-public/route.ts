import { NextResponse } from "next/server";
import { getPushConfig } from "@/lib/notifications/push";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const config = getPushConfig();
  return NextResponse.json(
    {
      enabled: config.enabled,
      sendReady: config.sendReady,
      workerReady: config.workerReady,
      vapidConfigured: config.vapid,
      serviceRoleConfigured: config.serviceRole,
      cronConfigured: config.cron,
      publicKey: config.publicKey,
      missing: config.missing,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
