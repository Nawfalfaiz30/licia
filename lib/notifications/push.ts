import { createAdminClient } from "@/lib/supabase/admin";

let configured = false;

function getWebPush(): any {
  // `web-push` is intentionally loaded only on the server.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("web-push");
}

export type PushConfig = {
  enabled: boolean;
  sendReady: boolean;
  workerReady: boolean;
  vapid: boolean;
  serviceRole: boolean;
  cron: boolean;
  publicKey: string | null;
  missing: string[];
};

export function getPushConfig(): PushConfig {
  const checks = [
    ["VAPID_SUBJECT", Boolean(process.env.VAPID_SUBJECT?.trim())],
    ["VAPID_PUBLIC_KEY", Boolean(process.env.VAPID_PUBLIC_KEY?.trim())],
    ["VAPID_PRIVATE_KEY", Boolean(process.env.VAPID_PRIVATE_KEY?.trim())],
    ["SUPABASE_SERVICE_ROLE_KEY", Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())],
    ["LICIA_CRON_SECRET", Boolean(process.env.LICIA_CRON_SECRET?.trim())],
  ] as const;
  const missing = checks.filter(([, ok]) => !ok).map(([name]) => name);
  const vapid = checks.slice(0, 3).every(([, ok]) => ok);
  const serviceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  const cron = Boolean(process.env.LICIA_CRON_SECRET?.trim());
  const hasSupabaseUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim());
  const sendReady = vapid && serviceRole && hasSupabaseUrl;
  const workerReady = sendReady && cron;
  return {
    enabled: sendReady,
    sendReady,
    workerReady,
    vapid,
    serviceRole,
    cron,
    publicKey: vapid ? process.env.VAPID_PUBLIC_KEY!.trim() : null,
    missing,
  };
}

export function isPushConfigured() {
  return getPushConfig().enabled;
}

function ensureConfigured() {
  const config = getPushConfig();
  if (!config.vapid) throw new Error(`VAPID belum dikonfigurasi. Isi: ${config.missing.filter((x) => x.startsWith("VAPID_")).join(", ") || "VAPID_*"}.`);
  if (!config.serviceRole) throw new Error("Supabase service-role belum dikonfigurasi di server.");
  // Manual push delivery does not require the worker/cron secret.
  // The cron secret is only required by the reminder dispatcher endpoint/worker.
  if (configured) return getWebPush();
  const webpush = getWebPush();
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!.trim(),
    process.env.VAPID_PUBLIC_KEY!.trim(),
    process.env.VAPID_PRIVATE_KEY!.trim(),
  );
  configured = true;
  return webpush;
}

export type PushPayload = {
  title: string;
  body?: string | null;
  href?: string | null;
  tag?: string | null;
  actions?: Array<{ action: string; title: string; href?: string | null; icon?: string | null }>;
};

export async function sendPushToUser(userId: string, payload: PushPayload) {
  const webpush = ensureConfigured();
  const supabase = createAdminClient();
  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("id,endpoint,subscription")
    .eq("user_id", userId)
    .eq("enabled", true);
  if (error) throw new Error(error.message);

  const results: Array<{ id: string; ok: boolean; status?: number; error?: string }> = [];
  for (const row of subscriptions ?? []) {
    try {
      await webpush.sendNotification(row.subscription, JSON.stringify(payload), { TTL: 300 });
      results.push({ id: row.id, ok: true });
      await supabase.from("push_subscriptions").update({ last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", row.id).eq("user_id", userId);
    } catch (error: any) {
      const status = Number(error?.statusCode || 0) || undefined;
      results.push({ id: row.id, ok: false, status, error: error instanceof Error ? error.message : "Push gagal dikirim." });
      if ([400, 401, 403, 404, 410].includes(status ?? 0)) {
        await supabase.from("push_subscriptions").delete().eq("id", row.id).eq("user_id", userId);
      } else {
        await supabase.from("push_subscriptions").update({ last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", row.id).eq("user_id", userId);
      }
    }
  }
  return results;
}
