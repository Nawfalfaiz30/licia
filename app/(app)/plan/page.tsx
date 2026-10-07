import { createClient } from "@/lib/supabase/server";
import { dateStrInTimezone } from "@/lib/date";
import { PlanWorkspace } from "@/components/plan/PlanWorkspace";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("users").select("timezone").eq("id", user.id).maybeSingle();
  const timezone = String(profile?.timezone || "Asia/Jakarta");
  const today = dateStrInTimezone(new Date(), timezone);
  const horizon = dateStrInTimezone(new Date(Date.now() + 7 * 86400000), timezone);
  const [{ data: tasks }, { data: blocks }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id,title,status,priority,due_at,estimated_minutes")
      .eq("user_id", user.id)
      .neq("status", "done")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(40),
    supabase
      .from("schedule_blocks")
      .select("id,title,block_date,start_time,end_time,task_id,completed_at")
      .eq("user_id", user.id)
      .gte("block_date", today)
      .lte("block_date", horizon)
      .order("block_date")
      .order("start_time")
      .limit(60),
  ]);
  return <PlanWorkspace tasks={(tasks || []) as any} blocks={(blocks || []) as any} timezone={timezone} />;
}
