import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin } from "@/lib/security";
import { googleAuthorizationUrl, makeOAuthState } from "@/lib/integrations/googleCalendar";
import { hmacSha256Hex } from "@/lib/integrations/secretBox";

export async function GET(req: Request) {
  const origin = enforceSameOrigin(req);
  if (origin) return origin;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  try {
    const state = makeOAuthState();
    const { error } = await supabase.from("integration_oauth_states").insert({
      user_id: user.id,
      provider: "google_calendar",
      state_hash: hmacSha256Hex(state),
      redirect_path: "/settings",
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    if (error) return NextResponse.json({ error: "State OAuth gagal disimpan." }, { status: 500 });
    return NextResponse.redirect(googleAuthorizationUrl(state, user.email));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Google Calendar belum dikonfigurasi." },
      { status: 503 },
    );
  }
}
