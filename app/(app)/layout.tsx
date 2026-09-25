import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { PWARegister } from "@/components/PWARegister";
import { TopBar } from "@/components/layout/TopBar";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar />
      <main className="licia-main min-w-0 max-w-full overflow-x-clip pb-20 md:pl-64 md:pb-0">
        <TopBar />
        <div className="mx-auto w-full max-w-6xl min-w-0 px-4 py-2 sm:px-6 sm:py-6 lg:px-8 lg:py-10">
          {children}
        </div>
      </main>
      <BottomNav />
      <PWARegister />
    </div>
  );
}
