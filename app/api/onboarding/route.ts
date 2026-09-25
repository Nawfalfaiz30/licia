import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin, rateLimit } from "@/lib/security";

export async function GET(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = rateLimit(`onboarding:${user.id}`, 30, 60_000);
  if (limited) return limited;

  const [profile, goals, projects, tasks, finance, habits] = await Promise.all([
    client.from("users").select("display_name").eq("id", user.id).maybeSingle(),
    client.from("goals").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    client.from("projects").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    client.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    client.from("expenses").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    client.from("habits").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  return NextResponse.json({
    status: {
      displayName: Boolean(profile.data?.display_name?.trim()),
      goal: (goals.count ?? 0) > 0,
      project: (projects.count ?? 0) > 0,
      task: (tasks.count ?? 0) > 0,
      finance: (finance.count ?? 0) > 0,
      habit: (habits.count ?? 0) > 0,
    }
  }, { headers: { "Cache-Control": "private, no-store" } });
}
