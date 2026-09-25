"use client";

import { useEffect } from "react";
import { RefreshCcw, AlertTriangle } from "lucide-react";
import { PrimaryButton } from "@/components/ui";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Licia app error", error); }, [error]);
  return (
    <main className="licia-main flex min-h-[65vh] items-center justify-center">
      <div className="licia-card-motion w-full max-w-lg rounded-3xl border border-danger/20 bg-surface p-7 text-center shadow-sm">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-danger/10 text-danger"><AlertTriangle size={22}/></div>
        <h1 className="font-display text-2xl text-text">Licia mengalami gangguan</h1>
        <p className="mt-2 text-sm leading-relaxed text-textMuted">Halaman ini tidak bisa dimuat dengan benar. Data yang sudah tersimpan tetap aman.</p>
        <PrimaryButton className="mt-5" onClick={() => reset()}><RefreshCcw size={15}/> Coba lagi</PrimaryButton>
      </div>
    </main>
  );
}
