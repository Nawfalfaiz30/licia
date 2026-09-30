import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin } from "@/lib/security";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const originError = enforceSameOrigin(req); if (originError) return originError;
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const sourceType = String(body?.sourceType || ""); const sourceId = String(body?.sourceId || "");
  if (!sourceType || !sourceId) return NextResponse.json({ error: "Sumber tidak valid." }, { status: 400 });
  const map: Record<string,{table:string;select:string}> = {
    tasks:{table:"tasks",select:"id,title,status,priority,due_at,project_id,estimated_minutes"}, projects:{table:"projects",select:"id,name,status,target_date,goal_id,updated_at"}, goals:{table:"goals",select:"id,title,status,progress,target_date,next_step"}, inbox:{table:"smart_inbox_items",select:"id,content,status,created_at"}, subscriptions:{table:"subscriptions",select:"id,name,amount,billing_cycle,next_billing_date,active"}, decisions:{table:"decisions",select:"id,title,decision,review_date,outcome"}, calendar:{table:"schedule_blocks",select:"id,title,block_date,start_time,end_time,task_id,project_id"}, projectsRisk:{table:"projects",select:"id,name,status,target_date,goal_id,updated_at"}, capacity:{table:"tasks",select:"id,title,status,estimated_minutes,due_at"},
  };
  const source = map[sourceType]; if (!source) return NextResponse.json({ error: "Jenis evidence belum didukung." }, { status: 400 });
  const { data, error } = await supabase.from(source.table).select(source.select).eq("id", sourceId).eq("user_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, sourceType, sourceId, data });
}
