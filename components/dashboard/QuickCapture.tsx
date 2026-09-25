"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Check, CloudUpload, FileText, ListPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui";
import { clsx } from "clsx";
import { enqueueOfflineAction, requestBackgroundSync } from "@/lib/pwa/offlineQueue";

export function QuickCapture() {
  const supabase = createClient();
  const router = useRouter();
  const [mode, setMode] = useState<"task" | "note">("task");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [offlineSaved, setOfflineSaved] = useState(false);

  async function submit() {
    const content = value.trim();
    if (!content || saving) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    if (!navigator.onLine) {
      await enqueueOfflineAction({ userId: user.id, type: "quick_capture", payload: { mode, content } });
      await requestBackgroundSync();
      setSaving(false);
      setValue("");
      setOfflineSaved(true);
      window.setTimeout(() => setOfflineSaved(false), 2200);
      return;
    }

    const result = mode === "task"
      ? await supabase.from("tasks").insert({ user_id: user.id, title: content, status: "todo", priority: "medium" })
      : await supabase.from("brain_dump_notes").insert({ user_id: user.id, content });

    let savedOfflineAfterFailure = false;

    if (result.error && !navigator.onLine) {
      await enqueueOfflineAction({ userId: user.id, type: "quick_capture", payload: { mode, content } });
      await requestBackgroundSync();
      savedOfflineAfterFailure = true;
      setOfflineSaved(true);
      window.setTimeout(() => setOfflineSaved(false), 2200);
    }

    setSaving(false);
    if (!result.error || savedOfflineAfterFailure) {
      setValue("");
      setSaved(true);
      router.refresh();
      window.setTimeout(() => setSaved(false), 1800);
    }
  }

  return (
    <Card className="relative overflow-hidden border-accent/20 bg-surfaceRaised/40">
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-accent/10 blur-2xl pointer-events-none" />
      <div className="relative flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="rounded-lg bg-accent/10 p-2 text-accent"><ArrowUpRight size={16} /></div>
              <p className="font-medium text-text text-sm">Tangkap cepat</p>
            </div>
            <p className="text-xs text-textMuted">Tuangkan ide sebelum lewat. Tidak perlu membuka modul lain.</p>
          </div>
          <Link href={mode === "task" ? "/tasks" : "/notes"} className="text-xs text-textMuted hover:text-accent transition flex items-center gap-1 shrink-0">
            Buka {mode === "task" ? "tugas" : "catatan"}
            <ArrowUpRight size={12} />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-xl bg-bg p-1 border border-border max-w-xs">
          <button onClick={() => setMode("task")} className={clsx("rounded-lg px-3 py-2 text-xs font-medium transition flex items-center justify-center gap-1.5", mode === "task" ? "bg-surface text-accent shadow-sm" : "text-textMuted hover:text-text")}>
            <ListPlus size={13} /> Tugas
          </button>
          <button onClick={() => setMode("note")} className={clsx("rounded-lg px-3 py-2 text-xs font-medium transition flex items-center justify-center gap-1.5", mode === "note" ? "bg-surface text-accent shadow-sm" : "text-textMuted hover:text-text")}>
            <FileText size={13} /> Catatan
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder={mode === "task" ? "Contoh: kirim CV sebelum Jumat" : "Contoh: ide tulisan yang baru muncul…"}
            className="flex-1 rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-text outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            onClick={submit}
            disabled={saving || !value.trim()}
            className="rounded-xl bg-accent text-white px-4 py-2.5 text-sm font-medium transition hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {offlineSaved ? <><CloudUpload size={16} /> Tersimpan offline</> : saved ? <Check size={16} /> : saving ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </div>
    </Card>
  );
}
