import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("users").select("preferences").eq("id", user.id).single();
  const startPage = (profile?.preferences as any)?.startPage;
  const startRoutes: Record<string, string> = {
    dashboard: "/dashboard",
    today: "/today",
    brief: "/brief",
    focus: "/focus",
    inbox: "/inbox",
    projects: "/projects",
    chat: "/chat",
    analytics: "/analytics",
    automations: "/automations",
  };
  redirect(startRoutes[startPage] || "/dashboard");
}
