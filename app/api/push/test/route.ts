import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin, rateLimit } from "@/lib/security";
import { sendPushToUser, isPushConfigured } from "@/lib/notifications/push";

export async function POST(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const gate = rateLimit(`push-test:${user.id}`, 3, 60_000);
  if (gate) return gate;
  if (!isPushConfigured()) return NextResponse.json({ error: "Push server belum dikonfigurasi lengkap. Pastikan VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, SUPABASE_SERVICE_ROLE_KEY, dan cron tersedia di server." }, { status: 503 });
  try {
    const results = await sendPushToUser(user.id, { title: "Licia siap memberi kabar", body: "Notifikasi push berhasil terhubung ke perangkat ini.", href: "/settings", tag: `licia-test-${Date.now()}` });
    const delivered = results.filter((x) => x.ok).length;
    return NextResponse.json({ ok: delivered > 0, delivered, total: results.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Push gagal dikirim." }, { status: 500 });
  }
}
