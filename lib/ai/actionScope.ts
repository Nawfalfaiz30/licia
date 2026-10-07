import { dateStrInTimezone, startOfDayIsoForTimezone, endOfDayIsoForTimezone } from "@/lib/date";

export type ActionScopeKind = "none" | "day" | "range" | "after" | "before";

export type ActionScope = {
  kind: ActionScopeKind;
  label: string;
  fromDate?: string;
  toDate?: string;
  fromIso?: string;
  toIso?: string;
  explicit: boolean;
};

function shiftDate(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  const value = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return value.toISOString().slice(0, 10);
}

function isoBounds(fromDate: string, toDate: string, timezone: string) {
  const from = new Date(`${fromDate}T12:00:00Z`);
  const to = new Date(`${toDate}T12:00:00Z`);
  return {
    fromIso: startOfDayIsoForTimezone(from, timezone),
    toIso: endOfDayIsoForTimezone(to, timezone),
  };
}

export function resolveActionScope(message: string, now = new Date(), timezone = "Asia/Jakarta"): ActionScope {
  const text = String(message || "")
    .trim()
    .toLocaleLowerCase("id-ID");
  if (!text) return { kind: "none", label: "tanpa scope waktu", explicit: false };
  const today = dateStrInTimezone(now, timezone);

  // More specific relative scopes must be checked before the generic "hari ini"
  // token, otherwise "setelah hari ini" / "sebelum hari ini" would be misread as
  // a one-day scope.
  if (
    /\b(?:setelah|sesudah)\s+hari\s+ini\b|\bbesok\s+dan\s+seterusnya\b|\bsetelah\s+hari\s+ini\s+dan\s+seterusnya\b/i.test(
      text,
    )
  ) {
    const bounds = isoBounds(today, today, timezone);
    return { kind: "after", label: "setelah hari ini", fromDate: today, toDate: today, explicit: true, ...bounds };
  }
  if (/\b(?:sebelum|hingga)\s+hari\s+ini\b|\bsampai\s+kemarin\b/i.test(text)) {
    const yesterday = shiftDate(today, -1);
    const bounds = isoBounds(yesterday, yesterday, timezone);
    return {
      kind: "before",
      label: "sebelum hari ini",
      fromDate: yesterday,
      toDate: yesterday,
      explicit: true,
      ...bounds,
    };
  }
  if (/\b(hari ini|today)\b/i.test(text)) {
    const bounds = isoBounds(today, today, timezone);
    return { kind: "day", label: "hari ini", fromDate: today, toDate: today, explicit: true, ...bounds };
  }
  if (/\b(lusa)\b/i.test(text)) {
    const date = shiftDate(today, 2);
    const bounds = isoBounds(date, date, timezone);
    return { kind: "day", label: "lusa", fromDate: date, toDate: date, explicit: true, ...bounds };
  }
  if (/\b(besok|tomorrow)\b/i.test(text)) {
    const date = shiftDate(today, 1);
    const bounds = isoBounds(date, date, timezone);
    return { kind: "day", label: "besok", fromDate: date, toDate: date, explicit: true, ...bounds };
  }

  if (/\b(kemarin|yesterday)\b/i.test(text)) {
    const date = shiftDate(today, -1);
    const bounds = isoBounds(date, date, timezone);
    return { kind: "day", label: "kemarin", fromDate: date, toDate: date, explicit: true, ...bounds };
  }
  if (/\b(minggu depan)\b/i.test(text)) {
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay() || 7;
    const nextMonday = shiftDate(today, 8 - weekday);
    const nextSunday = shiftDate(nextMonday, 6);
    const bounds = isoBounds(nextMonday, nextSunday, timezone);
    return {
      kind: "range",
      label: "minggu depan",
      fromDate: nextMonday,
      toDate: nextSunday,
      explicit: true,
      ...bounds,
    };
  }
  if (/\b(minggu ini)\b/i.test(text)) {
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay() || 7;
    const monday = shiftDate(today, -(weekday - 1));
    const sunday = shiftDate(monday, 6);
    const bounds = isoBounds(monday, sunday, timezone);
    return { kind: "range", label: "minggu ini", fromDate: monday, toDate: sunday, explicit: true, ...bounds };
  }

  return { kind: "none", label: "tanpa scope waktu", explicit: false };
}

export function isConversationalUndoIntent(message: string, now = new Date(), timezone = "Asia/Jakarta"): boolean {
  const text = String(message || "")
    .trim()
    .toLocaleLowerCase("id-ID");
  if (!text) return false;

  // A date/range scope means "kembalikan/pulihkan" is an explicit status command,
  // not a request to undo the latest unrelated mutation.
  if (resolveActionScope(text, now, timezone).explicit) return false;

  // Keep direct status-restoration commands out of generic undo.
  if (/\b(?:ke|jadi|menjadi)\s+(?:belum\s+selesai|todo|pending)\b/i.test(text)) return false;

  if (
    /\b(?:undo|urungkan(?:\s+perubahan)?|batalkan\s+perubahan(?:\s+(?:tadi|terakhir))?|batalkan\s+aksi(?:\s+(?:tadi|terakhir))?)\b/i.test(
      text,
    )
  ) {
    return true;
  }
  if (/\b(?:kembalikan|pulihkan|balikkan)\b[\s\S]{0,60}\b(?:tadi|terakhir|seperti\s+semula|sebelumnya)\b/i.test(text)) {
    return true;
  }
  return /^\s*(?:kembalikan|pulihkan|balikkan)(?:\s+(?:tugas|task)(?:nya)?)?\s*[.!?]*\s*$/i.test(text);
}

export function mergeActionScope(current: ActionScope, fallback: ActionScope) {
  return current.explicit ? current : fallback.explicit ? fallback : current;
}
