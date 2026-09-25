import { createAdminClient } from "@/lib/supabase/admin";

let configured = false;

function getWebPush(): any {
  // `web-push` is intentionally loaded only on the server.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("web-push");
}

export function isPushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() && process.env.VAPID_PUBLIC_KEY?.trim() && process.env.VAPID_PRIVATE_KEY?.trim() && process.env.VAPID_SUBJECT?.trim());
}

function ensureConfigured() {
  if (!isPushConfigured()) throw new Error("VAPID belum dikonfigurasi.");
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
};

export async function sendPushToUser(userId: string, payload: PushPayload) {
  const supabase = createAdminClient();
  const webpush = ensureConfigured();
  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("id,endpoint,subscription")
    .eq("user_id", userId)
    .eq("enabled", true);
  if (error) throw new Error(error.message);

  const results: Array<{ id: string; ok: boolean; status?: number }> = [];
  for (const row of subscriptions ?? []) {
    try {
      await webpush.sendNotification(row.subscription, JSON.stringify(payload), { TTL: 300 });
      results.push({ id: row.id, ok: true });
    } catch (error: any) {
      const status = Number(error?.statusCode || 0) || undefined;
      results.push({ id: row.id, ok: false, status });
      if (status === 404 || status === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", row.id).eq("user_id", userId);
      } else {
        await supabase.from("push_subscriptions").update({ last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", row.id).eq("user_id", userId);
      }
    }
  }
  return results;
}
