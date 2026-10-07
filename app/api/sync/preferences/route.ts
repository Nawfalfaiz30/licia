import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const { data, error } = await supabase
    .from("users")
    .select("display_name,timezone,preferences,updated_at")
    .eq("id", user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    {
      ok: true,
      preferences: data?.preferences && typeof data.preferences === "object" ? data.preferences : {},
      displayName: data?.display_name || null,
      timezone: data?.timezone || "Asia/Jakarta",
      updatedAt: data?.updated_at || null,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
