import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin, rateLimit } from "@/lib/security";
import { sendPushToUser, getPushConfig } from "@/lib/notifications/push";

export async function POST(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const gate = rateLimit(`push-test:${user.id}`, 3, 60_000);
  if (gate) return gate;
  const pushConfig = getPushConfig();
  if (!pushConfig.sendReady) {
    const missing = pushConfig.missing.filter((name) => name !== "LICIA_CRON_SECRET");
    return NextResponse.json({
      error: missing.length
        ? `Push server belum siap. Lengkapi: ${missing.join(", ")}.`
        : "Push server belum siap. Pastikan konfigurasi Supabase dan VAPID tersedia.",
      code: "PUSH_SERVER_NOT_READY",
      sendReady: false,
      workerReady: pushConfig.workerReady,
      missing,
    }, { status: 503 });
  }
  try {
    const results = await sendPushToUser(user.id, { title: "Licia siap memberi kabar", body: "Notifikasi push berhasil terhubung ke perangkat ini.", href: "/settings", tag: `licia-test-${Date.now()}` });
    const delivered = results.filter((x) => x.ok).length;
    const failed = results.filter((x) => !x.ok);
    if (!results.length) return NextResponse.json({ ok: false, code: "NO_PUSH_SUBSCRIPTION", delivered: 0, total: 0, error: "Belum ada perangkat yang berlangganan Web Push. Aktifkan push pada perangkat ini terlebih dahulu." }, { status: 503 });
    if (delivered === 0) {
      const first = failed[0];
      const detail = [400,401,403,404,410].includes(first?.status ?? 0)
        ? "Subscription perangkat tidak cocok atau sudah tidak berlaku. Tekan Aktifkan push untuk memperbarui koneksi perangkat."
        : first?.error || "Server menerima permintaan, tetapi push tidak berhasil dikirim.";
      return NextResponse.json({ ok: false, code: "PUSH_DELIVERY_FAILED", delivered, total: results.length, failed: failed.length, error: detail, repairable: [400,401,403,404,410].includes(first?.status ?? 0), workerReady: pushConfig.workerReady }, { status: 502 });
    }
    return NextResponse.json({ ok: true, delivered, total: results.length, failed: failed.length, workerReady: pushConfig.workerReady });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Push gagal dikirim." }, { status: 500 });
  }
}
