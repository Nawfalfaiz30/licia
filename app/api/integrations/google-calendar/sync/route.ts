import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authenticatedRateLimit, enforceSameOrigin } from "@/lib/security";
import {
  createGoogleEvent,
  deleteGoogleEvent,
  getGoogleAccessToken,
  getPrimaryCalendar,
  listGoogleEvents,
  scheduleToGoogleEvent,
  updateGoogleEvent,
} from "@/lib/integrations/googleCalendar";

export async function POST(req: Request) {
  const origin = enforceSameOrigin(req);
  if (origin) return origin;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const gate = await authenticatedRateLimit(supabase, user.id, "calendar-sync", 6, 60_000);
  if (gate) return gate;
  try {
    const accessToken = await getGoogleAccessToken(supabase, user.id);
    const calendar = await getPrimaryCalendar(accessToken);
    const { data: connection } = await supabase
      .from("integration_connections")
      .select("id,cursor")
      .eq("user_id", user.id)
      .eq("provider", "google_calendar")
      .maybeSingle();
    if (!connection) throw new Error("Koneksi Google Calendar tidak ditemukan.");

    let pageToken: string | undefined;
    let nextSyncToken: string | null = null;
    let pulled = 0;
    do {
      const page = await listGoogleEvents(accessToken, connection.cursor, pageToken);
      for (const event of page.items || []) {
        const eventId = String(event.id || "");
        if (!eventId) continue;
        if (event.status === "cancelled") {
          await supabase
            .from("schedule_blocks")
            .delete()
            .eq("user_id", user.id)
            .eq("google_calendar_id", calendar.id)
            .eq("google_event_id", eventId);
          pulled++;
          continue;
        }
        const startDateTime = event.start?.dateTime ? new Date(event.start.dateTime) : null;
        const endDateTime = event.end?.dateTime ? new Date(event.end.dateTime) : null;
        const blockDate = startDateTime
          ? startDateTime.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" })
          : String(event.start?.date || "");
        if (!blockDate) continue;
        const payload: any = {
          user_id: user.id,
          title: String(event.summary || "Google Calendar"),
          description: event.description ? String(event.description) : null,
          block_date: blockDate,
          start_time: startDateTime
            ? new Intl.DateTimeFormat("en-GB", {
                timeZone: "Asia/Jakarta",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }).format(startDateTime)
            : null,
          end_time: endDateTime
            ? new Intl.DateTimeFormat("en-GB", {
                timeZone: "Asia/Jakarta",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }).format(endDateTime)
            : null,
          google_calendar_id: calendar.id,
          google_event_id: eventId,
          google_etag: event.etag || null,
          google_updated_at: event.updated || null,
          sync_source: "google",
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase
          .from("schedule_blocks")
          .upsert(payload, { onConflict: "user_id,google_calendar_id,google_event_id" });
        if (!error) pulled++;
      }
      pageToken = page.nextPageToken;
      nextSyncToken = page.nextSyncToken || null;
    } while (pageToken);

    if (nextSyncToken) {
      await supabase
        .from("integration_connections")
        .update({
          cursor: nextSyncToken,
          last_synced_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id)
        .eq("user_id", user.id);
    }

    const { data: localBlocks } = await supabase
      .from("schedule_blocks")
      .select(
        "id,title,description,block_date,start_time,end_time,google_calendar_id,google_event_id,google_updated_at,sync_source",
      )
      .eq("user_id", user.id)
      .gte("block_date", new Date().toISOString().slice(0, 10))
      .limit(500);

    let pushed = 0;
    for (const block of localBlocks || []) {
      const googleEvent = scheduleToGoogleEvent({ ...block, timezone: "Asia/Jakarta" });
      if (block.google_event_id && block.google_calendar_id === calendar.id) {
        const updated = await updateGoogleEvent(accessToken, block.google_event_id, googleEvent);
        await supabase
          .from("schedule_blocks")
          .update({
            google_etag: updated.etag || null,
            google_updated_at: updated.updated || null,
            sync_source: "licia",
            updated_at: new Date().toISOString(),
          })
          .eq("id", block.id)
          .eq("user_id", user.id);
      } else if (!block.google_event_id) {
        const created = await createGoogleEvent(accessToken, googleEvent);
        await supabase
          .from("schedule_blocks")
          .update({
            google_calendar_id: calendar.id,
            google_event_id: created.id,
            google_etag: created.etag || null,
            google_updated_at: created.updated || null,
            sync_source: "licia",
            updated_at: new Date().toISOString(),
          })
          .eq("id", block.id)
          .eq("user_id", user.id);
      }
      pushed++;
    }
    return NextResponse.json({
      ok: true,
      calendar: { id: calendar.id, summary: calendar.summary },
      pulled,
      pushed,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    await supabase
      .from("integration_connections")
      .update({
        status: "error",
        last_error: error instanceof Error ? error.message : "Google sync failed",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("provider", "google_calendar");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Google Calendar sync gagal." },
      { status: 502 },
    );
  }
}
void deleteGoogleEvent;
