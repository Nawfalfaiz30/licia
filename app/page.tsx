import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PublicLanding } from "@/components/PublicLanding";

export const metadata: Metadata = {
  title: "Licia — Personal Life OS",
  description: "Asisten AI untuk tugas, kalender, catatan, fokus, keuangan, kebiasaan, dan kehidupan sehari-hari.",
  openGraph: {
    title: "Licia — Personal Life OS",
    description: "Satu ruang untuk berpikir, merencanakan, dan menjalani hidup.",
    type: "website",
    siteName: "Licia",
  },
};

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <PublicLanding />;

  const { data: profile } = await supabase.from("users").select("preferences").eq("id", user.id).single();
  const startPage = (profile?.preferences as any)?.startPage;
  const startRoutes: Record<string, string> = {
    today: "/today",
    dashboard: "/dashboard",
    brief: "/brief",
    focus: "/focus",
    inbox: "/inbox",
    projects: "/projects",
    chat: "/chat",
    analytics: "/analytics",
    automations: "/automations",
  };
  redirect(startRoutes[startPage] || "/today");
}
