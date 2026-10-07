import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { V35_FEATURES, V35_FEATURE_COUNT } from "@/lib/v35/featureRegistry";
import { enforceSameOrigin } from "@/lib/security";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const ready = V35_FEATURES.filter((x) => x.status === "ready").length;
  const enhanced = V35_FEATURES.filter((x) => x.status === "enhanced").length;
  return NextResponse.json({
    ok: true,
    count: V35_FEATURE_COUNT,
    ready,
    enhanced,
    foundation: V35_FEATURE_COUNT - ready - enhanced,
    features: V35_FEATURES,
  });
}
