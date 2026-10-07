import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sha256Hex } from "@/lib/integrations/secretBox";
import { assertJsonSize, rateLimit } from "@/lib/security";

type Params={params:Promise<{secret:string}>};

export async function POST(req:Request,{params}:Params){
  const {secret}=await params;
  const sizeError=assertJsonSize(req,256*1024); if(sizeError)return sizeError;
  if(!secret||secret.length<24)return NextResponse.json({error:"Webhook token tidak valid."},{status:401});
  const gate=rateLimit("automation-webhook:"+sha256Hex(secret),60,60_000); if(gate)return gate;
  const supabase=createAdminClient();
  const {data:webhook}=await supabase.from("automation_webhooks").select("id,user_id,events,enabled").eq("secret_hash",sha256Hex(secret)).maybeSingle();
  if(!webhook||webhook.enabled!==true)return NextResponse.json({error:"Webhook tidak aktif."},{status:404});
  const body=await req.json().catch(()=>null);
  if(!body||typeof body!=="object")return NextResponse.json({error:"Payload webhook harus JSON."},{status:400});
  const eventType=String(body.event_type||body.type||"webhook").slice(0,80);
  if(Array.isArray(webhook.events)&&webhook.events.length&&!webhook.events.includes(eventType))return NextResponse.json({ok:true,ignored:true});
  const {data,error}=await supabase.from("automation_webhook_events").insert({
    user_id:webhook.user_id,webhook_id:webhook.id,event_type,payload:body
  }).select("id,created_at").single();
  await supabase.from("automation_webhooks").update({last_triggered_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq("id",webhook.id);
  if(error)return NextResponse.json({error:"Webhook event gagal diantrikan."},{status:500});
  return NextResponse.json({ok:true,queued:true,event_id:data.id},{status:202});
}
