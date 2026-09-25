import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(){
  const started=Date.now();
  const openaiConfigured=Boolean(process.env.OPENAI_API_KEY?.trim());
  const supabaseConfigured=Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());
  try{
    const supabase=createClient();
    const {data:{user}}=await supabase.auth.getUser();
    const db=await supabase.from("users").select("id").limit(1);
    const [reminders, notificationEvents, pushSubscriptions] = await Promise.all([
      supabase.from("reminders").select("id", { count: "exact", head: true }),
      supabase.from("notification_events").select("id", { count: "exact", head: true }),
      supabase.from("push_subscriptions").select("id", { count: "exact", head: true }),
    ]);
    const databaseOk=!db.error;
    const features={
      reminders:!reminders.error,
      notificationEvents:!notificationEvents.error,
      pushSubscriptions:!pushSubscriptions.error,
    };
    const featureErrors={
      reminders:reminders.error?.message||null,
      notificationEvents:notificationEvents.error?.message||null,
      pushSubscriptions:pushSubscriptions.error?.message||null,
    };
    const featuresReady=Object.values(features).every(Boolean);
    const ok=databaseOk && supabaseConfigured && featuresReady;
    return NextResponse.json({
      ok,
      app:"licia",
      user:!!user,
      database:databaseOk,
      configuration:{supabaseConfigured,openaiConfigured},
      features,
      featureErrors,
      latency_ms:Date.now()-started,
      at:new Date().toISOString()
    },{status:ok?200:503,headers:{"Cache-Control":"no-store"}});
  }catch(error){
    return NextResponse.json({
      ok:false,
      app:"licia",
      database:false,
      configuration:{supabaseConfigured,openaiConfigured},
      error:error instanceof Error?error.message:"healthcheck_failed",
      latency_ms:Date.now()-started
    },{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
