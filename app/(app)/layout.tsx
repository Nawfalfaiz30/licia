import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { PWARegister } from "@/components/PWARegister";
import { SyncManager } from "@/components/SyncManager";
import { GlobalQuickCapture } from "@/components/GlobalQuickCapture";
import { MotionRuntime } from "@/components/MotionRuntime";
import { CommandCenter } from "@/components/v35/CommandCenter";
import { TopBar } from "@/components/layout/TopBar";
import { SkipLink } from "@/components/layout/SkipLink";
import { KeyboardShortcuts } from "@/components/layout/KeyboardShortcuts";
import { DataRefreshBridge } from "@/components/layout/DataRefreshBridge";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div id="licia-app" className="min-h-screen bg-bg">
      <SkipLink />
      <Sidebar />
      <main
        id="main-content"
        tabIndex={-1}
        className="licia-main min-w-0 max-w-full overflow-x-clip pb-[calc(64px+env(safe-area-inset-bottom)+16px)] md:pl-[72px] md:pb-0 xl:pl-64"
      >
        <TopBar />
        <div className="licia-v33-page-in mx-auto w-full max-w-[1280px] min-w-0 px-4 py-2 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
      <BottomNav />
      <PWARegister />
      <SyncManager />
      <GlobalQuickCapture />
      <CommandCenter />
      <KeyboardShortcuts />
      <MotionRuntime />
      <DataRefreshBridge />
    </div>
  );
}
