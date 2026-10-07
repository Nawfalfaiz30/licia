import { NextResponse } from "next/server";
import { sha256Hex } from "@/lib/integrations/secretBox";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic="force-dynamic";

function tokenFrom(req:Request){
  const auth=req.headers.get("authorization")||"";
  if(auth.startsWith("Bearer "))return auth.slice(7).trim();
  const url=new URL(req.url);
  return url.searchParams.get("token")||"";
}

export async function POST(req:Request){
  const token=tokenFrom(req);
  if(!token)return NextResponse.json({error:"Token inbound diperlukan."},{status:401});
  const supabase=createAdminClient();
  const {data:tokenRow}=await supabase.from("inbound_capture_tokens")
    .select("id,user_id,provider,expires_at").eq("token_hash",sha256Hex(token)).maybeSingle();
  if(!tokenRow)return NextResponse.json({error:"Token inbound tidak valid."},{status:401});
  if(tokenRow.expires_at&&new Date(tokenRow.expires_at).getTime()<Date.now())return NextResponse.json({error:"Token inbound sudah kedaluwarsa."},{status:401});
  const body=await req.json().catch(()=>null);
  const text=String(body?.text||body?.message||"").trim().slice(0,20000);
  if(!text)return NextResponse.json({error:"Pesan kosong."},{status:400});
  const kind=["task","note","idea","decision","learning"].includes(String(body?.kind))?String(body.kind):"inbox";
  const {data,itemError}=await supabase.from("smart_inbox_items").insert({
    user_id:tokenRow.user_id,content:text,kind,status:"open",
    ai_suggestion:{source:tokenRow.provider,external_id:String(body?.external_id||"").slice(0,200),has_attachment:Array.isArray(body?.attachments)&&body.attachments.length>0}
  }).select("id,content,kind,status,created_at").single();
  await supabase.from("inbound_capture_tokens").update({last_used_at:new Date().toISOString()}).eq("id",tokenRow.id);
  if(itemError)return NextResponse.json({error:"Pesan gagal dimasukkan ke Inbox."},{status:500});
  return NextResponse.json({ok:true,item:data});
}
