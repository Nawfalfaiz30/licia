"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DASHBOARD_LAYOUT_KEY, normalizeLayout, parseLayout, resetLayout, serializeLayout, type DashboardLayout } from "@/lib/dashboardLayout";

type Ctx = { layout: DashboardLayout; ready: boolean; update: (next: DashboardLayout) => void };
const DashboardLayoutContext = createContext<Ctx>({ layout: resetLayout(), ready: false, update: () => undefined });

/**
 * Menyimpan tata letak dashboard di localStorage dan menyiarkannya ke seluruh widget (A8).
 * Server selalu merender urutan bawaan; tata letak pengguna diterapkan setelah mount agar HTML tetap konsisten.
 * Perubahan dari perangkat lain tiba lewat event "licia:preferences-change" (lib/preferences.ts).
 */
export function DashboardLayoutProvider({ children }: { children: React.ReactNode }) {
  const [layout, setLayout] = useState<DashboardLayout>(() => resetLayout());
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    const read = () => { try { setLayout(parseLayout(localStorage.getItem(DASHBOARD_LAYOUT_KEY))); } catch { /* storage diblokir */ } setReady(true); };
    read();
    window.addEventListener("licia:preferences-change", read);
    window.addEventListener("storage", read);
    return () => { window.removeEventListener("licia:preferences-change", read); window.removeEventListener("storage", read); };
  }, []);

  const update = useCallback((next: DashboardLayout) => {
    const clean = normalizeLayout(next);
    setLayout(clean);
    try { localStorage.setItem(DASHBOARD_LAYOUT_KEY, serializeLayout(clean)); } catch { /* ignore */ }
    // Sinkron ke server (digabung ke users.preferences) setelah jeda singkat; gagal/offline → tetap tersimpan lokal.
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        if (!navigator.onLine) return;
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from("users").select("preferences").eq("id", user.id).maybeSingle();
        const prefs = ((data?.preferences || {}) as Record<string, unknown>);
        await supabase.from("users").update({ preferences: { ...prefs, dashboardLayout: serializeLayout(clean) } }).eq("id", user.id);
      } catch { /* tidak kritis */ }
    }, 700);
  }, []);

  const value = useMemo(() => ({ layout, ready, update }), [layout, ready, update]);
  return <DashboardLayoutContext.Provider value={value}>{children}</DashboardLayoutContext.Provider>;
}

export const useDashboardLayout = () => useContext(DashboardLayoutContext);
