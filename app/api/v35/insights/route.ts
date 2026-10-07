import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

type HealthMetricKey = "weight_kg" | "systolic" | "diastolic" | "resting_hr";
type HealthMetricRow = {
  weight_kg: number | null;
  systolic: number | null;
  diastolic: number | null;
  resting_hr: number | null;
  measured_at: string;
};

export async function GET(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const now = new Date();
  const since14 = new Date(now.getTime() - 14 * 86400000).toISOString();
  const since7 = new Date(now.getTime() - 7 * 86400000).toISOString();
  const [expensesRes, focusRes, healthRes, subsRes] = await Promise.all([
    supabase.from("expenses").select("amount,category,occurred_at").eq("user_id", user.id).gte("occurred_at", since14),
    supabase
      .from("pomodoro_sessions")
      .select("focus_minutes,started_at")
      .eq("user_id", user.id)
      .gte("started_at", since14),
    supabase
      .from("health_metrics")
      .select("weight_kg,systolic,diastolic,resting_hr,measured_at")
      .eq("user_id", user.id)
      .order("measured_at", { ascending: false })
      .limit(12),
    supabase
      .from("subscriptions")
      .select("id,name,amount,next_billing_date,active")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("next_billing_date")
      .limit(8),
  ]);

  const expenses = expensesRes.data ?? [];
  const focus = focusRes.data ?? [];
  const health: HealthMetricRow[] = (healthRes.data ?? []) as HealthMetricRow[];
  const subscriptions = subsRes.data ?? [];
  const midpoint = new Date(now.getTime() - 7 * 86400000).toISOString();
  const spendRecent = expenses
    .filter((x: any) => String(x.occurred_at) >= midpoint)
    .reduce((s: number, x: any) => s + Number(x.amount || 0), 0);
  const spendPrevious = expenses
    .filter((x: any) => String(x.occurred_at) < midpoint)
    .reduce((s: number, x: any) => s + Number(x.amount || 0), 0);
  const focusRecent = focus
    .filter((x: any) => String(x.started_at) >= midpoint)
    .reduce((s: number, x: any) => s + Number(x.focus_minutes || 0), 0);
  const focusPrevious = focus
    .filter((x: any) => String(x.started_at) < midpoint)
    .reduce((s: number, x: any) => s + Number(x.focus_minutes || 0), 0);
  const byCategory = new Map<string, number>();
  for (const row of expenses as any[])
    byCategory.set(
      row.category || "Lainnya",
      (byCategory.get(row.category || "Lainnya") || 0) + Number(row.amount || 0),
    );
  const categories = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, amount]) => ({ category, amount }));
  const upcomingSubs = subscriptions.filter(
    (x: any) =>
      x.next_billing_date && new Date(`${x.next_billing_date}T23:59:59`).getTime() - now.getTime() <= 7 * 86400000,
  );
  const latestHealth = health[0] || null;
  const firstHealth = health.at(-1) || null;
  const trend = (key: HealthMetricKey) => {
    if (latestHealth?.[key] == null || firstHealth?.[key] == null) return null;
    const a = Number(firstHealth[key]);
    const b = Number(latestHealth[key]);
    return { from: a, to: b, delta: Number((b - a).toFixed(2)) };
  };
  return NextResponse.json(
    {
      ok: true,
      generatedAt: now.toISOString(),
      finance: { spendRecent, spendPrevious, delta: spendRecent - spendPrevious, categories },
      focus: { recentMinutes: focusRecent, previousMinutes: focusPrevious, delta: focusRecent - focusPrevious },
      health: {
        latest: latestHealth,
        trends: {
          weight_kg: trend("weight_kg"),
          systolic: trend("systolic"),
          diastolic: trend("diastolic"),
          resting_hr: trend("resting_hr"),
        },
      },
      subscriptions: { upcoming: upcomingSubs },
    },
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
}
