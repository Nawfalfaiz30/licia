import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin } from "@/lib/security";
import { exchangeCode } from "@/lib/integrations/googleCalendar";
import { encryptSecret, sha256Hex } from "@/lib/integrations/secretBox";

export async function GET(req: Request) {
  const origin = enforceSameOrigin(req);
  if (origin) return origin;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return NextResponse.json({ error: "Callback Google tidak lengkap." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/settings", url.origin));

  const { data: stateRow, error: stateError } = await supabase
    .from("integration_oauth_states")
    .select("id,redirect_path,expires_at")
    .eq("user_id", user.id)
    .eq("provider", "google_calendar")
    .eq("state_hash", sha256Hex(state))
    .maybeSingle();
  if (stateError || !stateRow || new Date(stateRow.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "State OAuth tidak valid atau sudah kedaluwarsa." }, { status: 400 });
  }

  try {
    const token = await exchangeCode(code);
    const access = String(token.access_token || "");
    const refresh = token.refresh_token ? String(token.refresh_token) : null;
    if (!access) throw new Error("Google tidak memberikan access token.");
    const { data: existing } = await supabase
      .from("integration_connections")
      .select("refresh_token_encrypted")
      .eq("user_id", user.id)
      .eq("provider", "google_calendar")
      .maybeSingle();
    const { error } = await supabase.from("integration_connections").upsert(
      {
        user_id: user.id,
        provider: "google_calendar",
        account_email: user.email || null,
        status: "active",
        scopes: ["https://www.googleapis.com/auth/calendar"],
        access_token_encrypted: encryptSecret(access),
        refresh_token_encrypted: refresh ? encryptSecret(refresh) : existing?.refresh_token_encrypted || null,
        token_expires_at: new Date(Date.now() + Number(token.expires_in || 3600) * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" },
    );
    if (error) throw new Error("Koneksi Google gagal disimpan.");
    await supabase.from("integration_oauth_states").delete().eq("id", stateRow.id).eq("user_id", user.id);
    return NextResponse.redirect(
      new URL(String(stateRow.redirect_path || "/settings") + "?google_calendar=connected", url.origin),
    );
  } catch (error) {
    await supabase.from("integration_oauth_states").delete().eq("id", stateRow.id).eq("user_id", user.id);
    return NextResponse.redirect(new URL("/settings?google_calendar=error", url.origin));
  }
}
