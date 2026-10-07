import { decryptSecret, encryptSecret, randomToken } from "@/lib/integrations/secretBox";
import type { SupabaseClient } from "@supabase/supabase-js";

export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_URL = "https://www.googleapis.com/calendar/v3";

function config() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) throw new Error("Google Calendar OAuth belum dikonfigurasi.");
  return { clientId, clientSecret, redirectUri };
}

export function googleAuthorizationUrl(state: string, loginHint?: string | null) {
  const { clientId, redirectUri } = config();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: GOOGLE_CALENDAR_SCOPE,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });
  if (loginHint) params.set("login_hint", loginHint);
  return AUTH_URL + "?" + params.toString();
}

async function jsonRequest(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), "content-type": "application/x-www-form-urlencoded" },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(body?.error_description || body?.error || response.statusText));
  return body;
}

export async function exchangeCode(code: string) {
  const { clientId, clientSecret, redirectUri } = config();
  return jsonRequest(TOKEN_URL, {
    method: "POST",
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
}

async function refreshAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = config();
  return jsonRequest(TOKEN_URL, {
    method: "POST",
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }).toString(),
  });
}

export async function getGoogleAccessToken(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("integration_connections")
    .select("id,access_token_encrypted,refresh_token_encrypted,token_expires_at,status")
    .eq("user_id", userId)
    .eq("provider", "google_calendar")
    .maybeSingle();
  if (error || !data) throw new Error("Koneksi Google Calendar belum tersedia.");
  const refresh = data.refresh_token_encrypted ? decryptSecret(data.refresh_token_encrypted) : null;
  const access = data.access_token_encrypted ? decryptSecret(data.access_token_encrypted) : null;
  if (!refresh && !access) throw new Error("Token Google Calendar tidak tersedia.");
  const expiresAt = data.token_expires_at ? new Date(data.token_expires_at).getTime() : 0;
  if (access && expiresAt > Date.now() + 60_000) return access;
  if (!refresh) return access!;
  const token = await refreshAccessToken(refresh);
  const nextAccess = String(token.access_token || "");
  if (!nextAccess) throw new Error("Google tidak mengembalikan access token baru.");
  await supabase
    .from("integration_connections")
    .update({
      access_token_encrypted: encryptSecret(nextAccess),
      token_expires_at: new Date(Date.now() + Number(token.expires_in || 3600) * 1000).toISOString(),
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.id)
    .eq("user_id", userId);
  return nextAccess;
}

export async function googleCalendarRequest<T>(accessToken: string, path: string, init: RequestInit = {}) {
  const response = await fetch(CALENDAR_URL + path, {
    ...init,
    headers: { authorization: "Bearer " + accessToken, "content-type": "application/json", ...(init.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(body?.error?.message || response.statusText));
  return body as T;
}

export async function getPrimaryCalendar(accessToken: string) {
  return googleCalendarRequest<{ id: string; summary: string }>(accessToken, "/calendars/primary");
}
export async function listGoogleEvents(accessToken: string, syncToken?: string | null, pageToken?: string | null) {
  const params = new URLSearchParams({ singleEvents: "true", showDeleted: "true", maxResults: "2500" });
  if (syncToken) params.set("syncToken", syncToken);
  else params.set("timeMin", new Date(Date.now() - 365 * 86400000).toISOString());
  if (pageToken) params.set("pageToken", pageToken);
  return googleCalendarRequest<{ items?: any[]; nextPageToken?: string; nextSyncToken?: string }>(
    accessToken,
    "/calendars/primary/events?" + params.toString(),
  );
}
export async function createGoogleEvent(accessToken: string, event: any) {
  return googleCalendarRequest<any>(accessToken, "/calendars/primary/events", {
    method: "POST",
    body: JSON.stringify(event),
  });
}
export async function updateGoogleEvent(accessToken: string, eventId: string, event: any) {
  return googleCalendarRequest<any>(accessToken, "/calendars/primary/events/" + encodeURIComponent(eventId), {
    method: "PATCH",
    body: JSON.stringify(event),
  });
}
export async function deleteGoogleEvent(accessToken: string, eventId: string) {
  return googleCalendarRequest<any>(accessToken, "/calendars/primary/events/" + encodeURIComponent(eventId), {
    method: "DELETE",
  });
}
export function scheduleToGoogleEvent(block: any) {
  const tz = String(block.timezone || "Asia/Jakarta");
  if (block.start_at && block.end_at) {
    return {
      summary: String(block.title || "Licia"),
      description: String(block.description || ""),
      start: { dateTime: new Date(block.start_at).toISOString(), timeZone: tz },
      end: { dateTime: new Date(block.end_at).toISOString(), timeZone: tz },
    };
  }
  return {
    summary: String(block.title || "Licia"),
    description: String(block.description || ""),
    start: { date: String(block.block_date) },
    end: { date: String(block.block_date) },
  };
}
export function makeOAuthState() {
  return randomToken(32);
}
