import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStepUpState, safeStepUpNextPath } from "@/lib/security/step-up";
import { StepUpAuth } from "@/components/auth/StepUpAuth";

export const dynamic = "force-dynamic";

export default async function StepUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const nextPath = safeStepUpNextPath(params?.next, "/chat");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/step-up?next=" + encodeURIComponent(nextPath))}`);
  }

  const state = await getStepUpState(supabase);
  if (state.status === "fresh") redirect(nextPath);

  return <StepUpAuth nextPath={nextPath} />;
}
