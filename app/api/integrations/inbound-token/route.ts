import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin } from "@/lib/security";
import { sha256Hex, randomToken } from "@/lib/integrations/secretBox";

export async function POST(req: Request) {
  const origin = enforceSameOrigin(req);
  if (origin) return origin;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Belum masuk."},{status:401});
  const body=await req.json().catch(()=>({}));
  const provider=["telegram","whatsapp","email","generic"].includes(String(body?.provider))?String(body.provider):"generic";
  const raw=randomToken(32);
  const {error}=await supabase.from("inbound_capture_tokens").insert({
    user_id:user.id,provider,token_hash:sha256Hex(raw),label:String(body?.label||"").slice(0,80),
    expires_at:body?.expires_at?new Date(body.expires_at).toISOString():null,
  });
  if(error)return NextResponse.json({error:"Token inbound gagal dibuat."},{status:500});
  return NextResponse.json({ok:true,provider,token:raw,warning:"Token hanya ditampilkan sekali. Simpan di konfigurasi provider."},{status:201});
}
