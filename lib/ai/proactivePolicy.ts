export type ProactivePreferences = {
  enabled?: boolean;
  max_suggestions_per_day?: number;
  quiet_start?: string | null;
  quiet_end?: string | null;
};

function minutes(value: string | null | undefined) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? hour * 60 + minute : null;
}

export function isWithinQuietHours(now: Date, prefs: ProactivePreferences) {
  const start = minutes(prefs.quiet_start);
  const end = minutes(prefs.quiet_end);
  if (start == null || end == null || start === end) return false;
  const local = now.getHours() * 60 + now.getMinutes();
  return start < end ? local >= start && local < end : local >= start || local < end;
}

export function shouldProactivelyNotify(input: {
  now?: Date;
  prefs?: ProactivePreferences;
  suggestionsToday: number;
  candidateScore: number;
  quietHours?: boolean;
}) {
  const prefs = input.prefs || {};
  if (prefs.enabled === false) return { allowed: false, reason: "disabled" as const };
  const limit = Math.max(0, Math.min(Number(prefs.max_suggestions_per_day ?? 3), 24));
  if (input.suggestionsToday >= limit) return { allowed: false, reason: "daily_limit" as const };
  const quiet = input.quietHours ?? isWithinQuietHours(input.now || new Date(), prefs);
  if (quiet) return { allowed: false, reason: "quiet_hours" as const };
  if (input.candidateScore < 70) return { allowed: false, reason: "low_relevance" as const };
  return { allowed: true, reason: "eligible" as const };
}
