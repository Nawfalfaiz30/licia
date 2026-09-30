
"use client";

import { useState } from "react";
import { LogOut, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function MobileAccountAction({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function logout() {
    if (busy) return;
    setBusy(true);
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (compact) return <button onClick={() => setOpen(true)} className="touch-target inline-flex items-center justify-center rounded-xl text-textMuted hover:text-text" aria-label="Akun"><UserRound size={17}/></button>;
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface px-3.5 py-3 text-left text-sm font-semibold text-text transition hover:border-accent/30 hover:text-accent">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent"><UserRound size={17}/></span>
        <span className="min-w-0 flex-1"><span className="block">Akun & sesi</span><span className="mt-0.5 block text-[10px] font-normal text-textMuted">Keluar dari Licia di perangkat ini</span></span>
      </button>
      {open && <div className="fixed inset-0 z-[180] flex items-end justify-center bg-black/45 p-3 backdrop-blur-sm" role="dialog" aria-modal="true">
        <div className="w-full max-w-md rounded-[1.6rem] border border-border bg-surface p-4 shadow-2xl animate-licia-pop-in">
          <div className="flex items-center justify-between gap-3"><div><p className="font-display text-lg text-text">Akun</p><p className="text-xs text-textMuted">Tindakan sesi</p></div><button className="touch-target rounded-xl text-textMuted" onClick={() => setOpen(false)} aria-label="Tutup"><X size={17}/></button></div>
          <button onClick={() => void logout()} disabled={busy} className="mt-4 flex min-h-12 w-full items-center gap-3 rounded-2xl border border-danger/20 bg-danger/5 px-4 text-left text-sm font-semibold text-danger transition hover:bg-danger/10 disabled:opacity-50"><LogOut size={17}/><span>{busy ? "Keluar…" : "Keluar / Log out"}</span></button>
        </div>
      </div>}
    </>
  );
}
