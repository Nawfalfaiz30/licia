import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin, rateLimit } from "@/lib/security";
import { sha256Hex, randomToken } from "@/lib/integrations/secretBox";

export async function GET(req: Request) {
  const origin=enforceSameOrigin(req); if(origin)return origin;
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Belum masuk."},{status:401});
  const {data,error}=await supabase.from("automation_webhooks").select("id,automation_id,url,events,enabled,last_triggered_at,last_error,created_at,updated_at")
    .eq("user_id",user.id).order("created_at",{ascending:false});
  if(error)return NextResponse.json({error:"Webhook gagal dibaca."},{status:500});
  return NextResponse.json({webhooks:data||[]});
}

export async function POST(req: Request) {
  const origin=enforceSameOrigin(req); if(origin)return origin;
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Belum masuk."},{status:401});
  const gate=rateLimit("automation-webhook-create:"+user.id,10,60_000); if(gate)return gate;
  const body=await req.json().catch(()=>null);
  const events=Array.isArray(body?.events)?body.events.map((x:any)=>String(x).slice(0,80)).slice(0,20):[];
  const raw=randomToken(32);
  const {data,error}=await supabase.from("automation_webhooks").insert({
    user_id:user.id, automation_id:body?.automation_id||null, url:"/api/automations/webhook/"+raw,
    secret_hash:sha256Hex(raw), events, enabled:body?.enabled!==false
  }).select("id,automation_id,url,events,enabled,created_at").single();
  if(error)return NextResponse.json({error:"Webhook gagal dibuat."},{status:500});
  return NextResponse.json({ok:true,webhook:data,secret:raw,warning:"Secret webhook hanya diberikan sekali."},{status:201});
}

export async function PATCH(req: Request) {
  const origin=enforceSameOrigin(req); if(origin)return origin;
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Belum masuk."},{status:401});
  const body=await req.json().catch(()=>null); const id=String(body?.id||"");
  if(!id)return NextResponse.json({error:"ID webhook tidak valid."},{status:400});
  const patch:any={updated_at:new Date().toISOString()};
  if(body.enabled!==undefined)patch.enabled=body.enabled===true;
  if(body.events!==undefined)patch.events=Array.isArray(body.events)?body.events.map((x:any)=>String(x).slice(0,80)).slice(0,20):[];
  const {data,error}=await supabase.from("automation_webhooks").update(patch).eq("id",id).eq("user_id",user.id)
    .select("id,automation_id,url,events,enabled,last_triggered_at,last_error,created_at,updated_at").single();
  if(error)return NextResponse.json({error:"Webhook gagal diperbarui."},{status:500});
  return NextResponse.json({ok:true,webhook:data});
}

export async function DELETE(req: Request) {
  const origin=enforceSameOrigin(req); if(origin)return origin;
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Belum masuk."},{status:401});
  const id=new URL(req.url).searchParams.get("id"); if(!id)return NextResponse.json({error:"ID webhook tidak valid."},{status:400});
  const {error}=await supabase.from("automation_webhooks").delete().eq("id",id).eq("user_id",user.id);
  if(error)return NextResponse.json({error:"Webhook gagal dihapus."},{status:500});
  return NextResponse.json({ok:true});
}

void crypto;
