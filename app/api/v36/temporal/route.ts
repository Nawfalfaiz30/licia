import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin } from "@/lib/security";
import { resolveNaturalDate, validateWeekdayDate, buildTemporalContext } from "@/lib/v36/temporal";
import { dateStrInTimezone } from "@/lib/date";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { data: profile } = await supabase.from("users").select("timezone").eq("id", user.id).maybeSingle();
  const timezone = String(profile?.timezone || "Asia/Jakarta");
  const now = new Date();
  const input = String(body?.input || "").trim();
  const expectedWeekday = body?.expectedWeekday ? String(body.expectedWeekday) : null;
  const date = body?.date ? String(body.date) : null;
  const resolved = resolveNaturalDate(input || date || "hari ini", now, timezone);
  const validation =
    date && expectedWeekday
      ? validateWeekdayDate(date, expectedWeekday, timezone)
      : resolved[0]?.weekdayMatch === false
        ? {
            valid: false,
            actualWeekday: resolved[0].weekday,
            expectedWeekday: "hari pada input",
            date: resolved[0].date,
            timezone,
          }
        : null;
  return NextResponse.json({
    ok: true,
    timezone,
    context: buildTemporalContext(now, timezone),
    referenceDate: dateStrInTimezone(now, timezone),
    resolved,
    validation,
  });
}
