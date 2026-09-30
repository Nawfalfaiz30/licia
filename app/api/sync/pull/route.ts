import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const url = new URL(req.url);
  const cursor = Math.max(0, Number(url.searchParams.get("cursor") || 0));
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 100)));
  const deviceId = String(url.searchParams.get("deviceId") || "").trim();

  if (cursor === 0) {
    const { data: latest } = await supabase.from("life_os_sync_events").select("sequence").eq("user_id", user.id).order("sequence", { ascending: false }).limit(1).maybeSingle();
    const bootstrapCursor = Number(latest?.sequence || 0);
    if (deviceId) await supabase.from("life_os_sync_devices").update({ last_seen_at: new Date().toISOString(), last_sync_at: new Date().toISOString(), last_cursor: bootstrapCursor, sync_status: "online", last_error: null, updated_at: new Date().toISOString() }).eq("user_id", user.id).eq("device_id", deviceId);
    return NextResponse.json({ ok: true, cursor: bootstrapCursor, nextCursor: bootstrapCursor, events: [], bootstrapped: true, serverTime: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  }

  const { data: oldestEvent } = await supabase.from("life_os_sync_events").select("sequence").eq("user_id", user.id).order("sequence", { ascending: true }).limit(1).maybeSingle();
  const oldestSequence = Number(oldestEvent?.sequence || 0);
  if (oldestSequence && cursor < oldestSequence - 1) {
    if (deviceId) await supabase.from("life_os_sync_devices").update({ last_seen_at: new Date().toISOString(), sync_status: "resync_required", last_error: "SYNC_HISTORY_GAP", updated_at: new Date().toISOString() }).eq("user_id", user.id).eq("device_id", deviceId);
    return NextResponse.json({ ok: true, resyncRequired: true, reason: "SYNC_HISTORY_GAP", cursor, oldestSequence, serverTime: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  }

  const { data: events, error } = await supabase.from("life_os_sync_events").select("sequence,id,entity_type,entity_id,operation,payload,changed_fields,created_at").eq("user_id", user.id).gt("sequence", cursor).order("sequence", { ascending: true }).limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = events ?? [];
  const nextCursor = rows.length ? Number(rows[rows.length - 1].sequence) : cursor;
  if (deviceId) await supabase.from("life_os_sync_devices").update({ last_seen_at: new Date().toISOString(), last_sync_at: new Date().toISOString(), last_cursor: nextCursor, sync_status: "online", last_error: null, updated_at: new Date().toISOString() }).eq("user_id", user.id).eq("device_id", deviceId);
  return NextResponse.json({ ok: true, cursor, nextCursor, events: rows, hasMore: rows.length === limit, serverTime: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
