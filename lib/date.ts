// IMPORTANT: never use `date.toISOString().slice(0, 10)` to get a "YYYY-MM-DD"
// label for a local calendar date — toISOString() converts to UTC first, which
// silently shifts the date by a day for anyone in a UTC+ timezone (like WIB)
// during certain hours. Always build the string from local getFullYear/getMonth/
// getDate instead, as localDateStr() does below.

export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfLocalDayIso(d: Date = new Date()): string {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

export function endOfLocalDayIso(d: Date = new Date()): string {
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
}

// =========================================================================
// SERVER-SIDE date helpers (server components, API routes, AI tool handlers).
// The server's own clock is almost always UTC, not WIB — so anything above
// that relies on Date's LOCAL getters/setters (localDateStr, setHours(0,0,0,0))
// gives the WRONG "today"/"start of day" for roughly 7 hours of every day
// (00:00-07:00 WIB, the server still thinks it's "yesterday" in UTC). This
// bit us more than once: tasks due "jam 7 malam" saved as 02:00, dashboard
// "today" stats off by a day near midnight, etc. Everything below computes
// WIB (UTC+7, no DST — always a fixed offset) via pure arithmetic, so it's
// correct regardless of what timezone the server process happens to run in.
// =========================================================================

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function wibCalendarParts(d: Date) {
  const shifted = new Date(d.getTime() + WIB_OFFSET_MS);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), day: shifted.getUTCDate() };
}

export function wibDateStr(d: Date = new Date()): string {
  const { y, m, day } = wibCalendarParts(d);
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}


export function dateStrInTimezone(d: Date = new Date(), timezone: string = "Asia/Jakarta"): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function startOfDayIsoForTimezone(d: Date = new Date(), timezone: string = "Asia/Jakarta"): string {
  const datePart = dateStrInTimezone(d, timezone);
  const [y, m, day] = datePart.split("-").map(Number);
  const offsetMinutes = offsetForTimezone(timezone).startsWith("-")
    ? -Number(offsetForTimezone(timezone).slice(1, 3)) * 60 - Number(offsetForTimezone(timezone).slice(4, 6))
    : Number(offsetForTimezone(timezone).slice(1, 3)) * 60 + Number(offsetForTimezone(timezone).slice(4, 6));
  return new Date(Date.UTC(y, m - 1, day, 0, 0, 0) - offsetMinutes * 60 * 1000).toISOString();
}

export function endOfDayIsoForTimezone(d: Date = new Date(), timezone: string = "Asia/Jakarta"): string {
  const datePart = dateStrInTimezone(d, timezone);
  const [y, m, day] = datePart.split("-").map(Number);
  const offset = offsetForTimezone(timezone);
  const sign = offset.startsWith("-") ? -1 : 1;
  const [hours, minutes] = offset.slice(1).split(":").map(Number);
  const offsetMs = sign * (hours * 60 + minutes) * 60 * 1000;
  return new Date(Date.UTC(y, m - 1, day, 23, 59, 59, 999) - offsetMs).toISOString();
}

export function startOfMonthIsoForTimezone(d: Date = new Date(), timezone: string = "Asia/Jakarta"): string {
  const datePart = dateStrInTimezone(d, timezone);
  const [y, m] = datePart.split("-").map(Number);
  const offset = offsetForTimezone(timezone);
  const sign = offset.startsWith("-") ? -1 : 1;
  const [hours, minutes] = offset.slice(1).split(":").map(Number);
  const offsetMs = sign * (hours * 60 + minutes) * 60 * 1000;
  return new Date(Date.UTC(y, m - 1, 1, 0, 0, 0) - offsetMs).toISOString();
}

export function startOfWeekIsoForTimezone(d: Date = new Date(), timezone: string = "Asia/Jakarta"): string {
  const datePart = dateStrInTimezone(d, timezone);
  const [y, m, day] = datePart.split("-").map(Number);
  const noon = new Date(Date.UTC(y, m - 1, day, 12, 0, 0));
  const jsDay = noon.getUTCDay();
  const isoDay = jsDay === 0 ? 7 : jsDay;
  const monday = day - (isoDay - 1);
  const offset = offsetForTimezone(timezone);
  const sign = offset.startsWith("-") ? -1 : 1;
  const hours = Number(offset.slice(1, 3));
  const minutes = Number(offset.slice(4, 6));
  const offsetMs = sign * (hours * 60 + minutes) * 60 * 1000;
  return new Date(Date.UTC(y, m - 1, monday, 0, 0, 0) - offsetMs).toISOString();
}

export function wibStartOfDayIso(d: Date = new Date()): string {
  const { y, m, day } = wibCalendarParts(d);
  return new Date(Date.UTC(y, m, day, 0, 0, 0) - WIB_OFFSET_MS).toISOString();
}

export function wibEndOfDayIso(d: Date = new Date()): string {
  const { y, m, day } = wibCalendarParts(d);
  return new Date(Date.UTC(y, m, day, 23, 59, 59, 999) - WIB_OFFSET_MS).toISOString();
}

export function wibStartOfMonthIso(d: Date = new Date()): string {
  const { y, m } = wibCalendarParts(d);
  return new Date(Date.UTC(y, m, 1, 0, 0, 0) - WIB_OFFSET_MS).toISOString();
}

export function wibStartOfWeekIso(d: Date = new Date()): string {
  const { y, m, day } = wibCalendarParts(d);
  const asUtcNoon = new Date(Date.UTC(y, m, day, 12, 0, 0)); // noon avoids DST-less edge cases
  const jsDay = asUtcNoon.getUTCDay(); // 0=Sun..6=Sat
  const isoDay = jsDay === 0 ? 7 : jsDay; // 1=Mon..7=Sun
  const mondayDay = day - (isoDay - 1);
  return new Date(Date.UTC(y, m, mondayDay, 0, 0, 0) - WIB_OFFSET_MS).toISOString();
}

// CRITICAL: the AI supplies date/time strings (due_at, occurred_at, etc.) based
// on its own reasoning about "today"/"jam 7 malam" in WIB — but if it sends an
// ISO-like string WITHOUT a timezone offset (e.g. "2026-09-20T19:00:00"), OR
// with "Z" (meaning UTC), Postgres/JS treats that as UTC. "7pm WIB" then
// silently becomes "7pm UTC" = 2am WIB the next day — exactly the bug where a
// task due "jam 7 malam" showed up as "02:00". This app has no legitimate case
// where the AI means actual UTC, so we treat "Z" the same as "no offset at
// all": strip it and force +07:00. An explicit numeric offset (+HH:MM/-HH:MM)
// is left untouched, since that's unambiguous and was set on purpose.
// Every write path that takes a date/time string from the AI MUST pass it
// through this first.
export function ensureTimezoneOffset(isoLike: string | null | undefined, timezone: string = "Asia/Jakarta"): string | null {
  if (!isoLike) return null;
  let s = isoLike.trim();
  const explicitNumericOffset = /[+-]\d{2}:\d{2}$/.test(s);
  if (explicitNumericOffset) return s;
  if (s.endsWith("Z")) s = s.slice(0, -1);
  if (!s.includes("T")) s += "T00:00:00";
  return `${s}${offsetForTimezone(timezone)}`;
}

export function ensureWibOffset(isoLike: string | null | undefined): string | null {
  return ensureTimezoneOffset(isoLike, "Asia/Jakarta");
}

// Zona waktu Indonesia yang bisa dipilih pengguna di Pengaturan. Semua fixed
// offset, tidak ada DST, jadi aman dihitung sebagai konstanta.
export const TIMEZONE_OPTIONS = [
  { value: "Asia/Jakarta", label: "WIB (UTC+7)", offset: "+07:00" },
  { value: "Asia/Makassar", label: "WITA (UTC+8)", offset: "+08:00" },
  { value: "Asia/Jayapura", label: "WIT (UTC+9)", offset: "+09:00" },
] as const;

export function offsetForTimezone(tz: string | null | undefined): string {
  return TIMEZONE_OPTIONS.find((t) => t.value === tz)?.offset ?? "+07:00";
}

export function labelForTimezone(tz: string | null | undefined): string {
  return TIMEZONE_OPTIONS.find((t) => t.value === tz)?.label ?? "WIB (UTC+7)";
}


/** Convert an HTML date/time-local pair interpreted in one of Licia's timezones into UTC ISO. */
export function localDateTimeToIso(date: string, time: string, timezone: string = "Asia/Jakarta"): string | null {
  if (!date) return null;
  const safeTime = time || "00:00";
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = safeTime.split(":").map(Number);
  if (![y, m, d, hh, mm].every(Number.isFinite)) return null;
  const offset = offsetForTimezone(timezone);
  const sign = offset.startsWith("-") ? -1 : 1;
  const [oh, om] = offset.slice(1).split(":").map(Number);
  const offsetMinutes = sign * (oh * 60 + om);
  return new Date(Date.UTC(y, m - 1, d, hh, mm, 0) - offsetMinutes * 60 * 1000).toISOString();
}
