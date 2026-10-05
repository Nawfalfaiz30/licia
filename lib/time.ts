import { labelForTimezone, offsetForTimezone, TIMEZONE_OPTIONS } from "@/lib/date";

export function formatClock(value: Date | string | number, timezone: string, timeFormat: "12h" | "24h" = "24h", showSeconds = false): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    ...(showSeconds ? { second: "2-digit" as const } : {}),
    hour12: timeFormat === "12h",
  }).format(date);
}

export function formatDateTime(value: Date | string | number, timezone: string): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: timezone,
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function timezoneLabel(timezone: string): string {
  return labelForTimezone(timezone);
}

export function timezoneOptions() {
  return TIMEZONE_OPTIONS;
}

export function offsetMinutesForTimezone(timezone: string): number {
  const offset = offsetForTimezone(timezone);
  const sign = offset.startsWith("-") ? -1 : 1;
  const [hours, minutes] = offset.slice(1).split(":").map(Number);
  return sign * (hours * 60 + minutes);
}
