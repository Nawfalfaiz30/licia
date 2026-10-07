"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Database, Eye, LockKeyhole, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, SoftButton, notifyToast } from "@/components/ui";
import { useLanguage } from "@/components/LanguageProvider";
const keys = [
  ["aiReadAllData", "AI dapat membaca konteks Life OS"],
  ["aiAutoLink", "AI boleh menghubungkan entitas otomatis"],
  ["aiProactive", "Insight proaktif"],
  ["aiSuggestActions", "AI boleh menyarankan aksi"],
  ["aiConfirmDestructive", "Konfirmasi aksi destruktif"],
  ["aiConfirmMassive", "Konfirmasi perubahan massal"],
  ["privacySensitiveAi", "Perlindungan konteks sensitif"],
] as const;
export default function PrivacyPage() {
  const { t: tr } = useLanguage();
  const supabase = createClient();
  const [prefs, setPrefs] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("users").select("preferences").eq("id", user.id).maybeSingle();
      setPrefs((data?.preferences as any) || {});
    })();
  }, []);
  function toggle(k: string) {
    setPrefs((p) => ({ ...p, [k]: p[k] !== true }));
  }
  async function save() {
    setBusy(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error(tr("Belum masuk."));
      const { error } = await supabase.from("users").update({ preferences: prefs }).eq("id", user.id);
      if (error) throw error;
      window.dispatchEvent(new CustomEvent("licia:preferences-change", { detail: prefs }));
      notifyToast({ title: "Privasi tersimpan", message: "Aturan akses AI diperbarui.", tone: "success" });
    } catch (e) {
      notifyToast({
        title: "Belum tersimpan",
        message: e instanceof Error ? e.message : tr("Terjadi kesalahan."),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5 animate-licia-page-in">
      <header className="rounded-[2rem] border border-accent/15 bg-gradient-to-br from-accent/10 via-surface to-surface p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <span className="rounded-2xl bg-accent/10 p-3 text-accent">
            <LockKeyhole size={22} />
          </span>
          <div>
            <p className="text-2xs font-bold uppercase tracking-[.16em] text-accent">{tr("Privacy Center")}</p>
            <h1 className="mt-1 font-display text-3xl text-text">{tr("Kamu yang mengatur batas Licia.")}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-textMuted">
              {tr("Lihat data apa yang dapat dipakai AI, bagaimana aksi dikonfirmasi, dan jalur backup/pemulihan.")}
            </p>
          </div>
        </div>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-4">
          <ShieldCheck className="text-accent" size={18} />
          <p className="mt-3 text-xs font-semibold text-text">{tr("AI Safety")}</p>
          <p className="mt-1 text-2xs leading-relaxed text-textMuted">
            {tr("Perubahan destruktif dan massal tetap memiliki lapisan konfirmasi.")}
          </p>
        </Card>
        <Card className="p-4">
          <Eye className="text-accent" size={18} />
          <p className="mt-3 text-xs font-semibold text-text">{tr("Evidence")}</p>
          <p className="mt-1 text-2xs leading-relaxed text-textMuted">
            {tr("Insight V36 dapat ditelusuri kembali ke record sumber.")}
          </p>
        </Card>
        <Card className="p-4">
          <Database className="text-accent" size={18} />
          <p className="mt-3 text-xs font-semibold text-text">{tr("Data Portability")}</p>
          <p className="mt-1 text-2xs leading-relaxed text-textMuted">
            {tr("Backup dan export tetap tersedia dari Pengaturan.")}
          </p>
        </Card>
      </div>
      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <LockKeyhole size={16} className="text-accent" />
          <div>
            <p className="text-sm font-semibold text-text">{tr("Kontrol konteks AI")}</p>
            <p className="text-2xs text-textMuted">
              {tr("Preferensi ini menjadi guardrail tambahan di atas policy AI dan konfirmasi aksi.")}
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {keys.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-bg p-3 text-left"
            >
              <span
                className={`h-5 w-9 rounded-full p-0.5 transition ${prefs[key] === false ? "bg-border" : "bg-accent"}`}
              >
                <span
                  className={`block h-4 w-4 rounded-full bg-white transition ${prefs[key] === false ? "" : "translate-x-4"}`}
                />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-xs font-semibold text-text">{tr(label)}</b>
                <span className="text-2xs text-textMuted">{prefs[key] === false ? tr("Nonaktif") : tr("Aktif")}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <SoftButton onClick={() => void save()} disabled={busy}>
            <Sparkles size={13} />
            {busy ? tr("Menyimpan…") : tr("Simpan batas AI")}
          </SoftButton>
          <Link
            href="/settings?section=data"
            className="inline-flex items-center rounded-xl bg-bg px-3 py-2 text-2xs font-semibold text-textMuted hover:text-accent"
          >
            {tr("Backup & export")}
          </Link>
          <Link
            href="/ai-history"
            className="inline-flex items-center rounded-xl bg-bg px-3 py-2 text-2xs font-semibold text-textMuted hover:text-accent"
          >
            {tr("Riwayat AI")}
          </Link>
        </div>
      </Card>
      <Card className="border-danger/15 bg-danger/5 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Trash2 size={18} className="text-danger" />
          <div>
            <p className="text-sm font-semibold text-text">{tr("Area sensitif")}</p>
            <p className="mt-1 text-2xs leading-relaxed text-textMuted">
              {tr(
                "Penghapusan permanen data tetap dilakukan lewat modul sumber dan kontrol backup. Tidak ada tombol mass-delete universal di sini.",
              )}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
