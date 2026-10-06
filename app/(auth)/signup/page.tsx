"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { getAuthCallbackUrl } from "@/lib/authRedirect";

import { useLanguage } from "@/components/LanguageProvider";
export default function SignupPage() {
  const { t: tr } = useLanguage();
  const supabase = createClient();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getAuthCallbackUrl(),
        data: {
          display_name: displayName,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "Asia/Jakarta",
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Profil dibuat otomatis lewat DB trigger (lihat schema_fix_profile_trigger.sql),
    // jadi tidak bergantung sesi aktif — aman walau perlu konfirmasi email dulu.
    setLoading(false);
    setDone(true);
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-bg text-center">
        <div>
          <h1 className="font-display text-3xl mb-3 text-text">{tr("Cek email kamu")}</h1>
          <p className="text-textMuted max-w-sm">
            {tr("Licia sudah mengirim tautan konfirmasi. Setelah dikonfirmasi, kamu bisa langsung masuk.")}</p>
          <Link href="/login" className="text-accent font-medium mt-4 inline-block">
            {tr("Kembali ke halaman masuk")}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-bg">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-4xl mb-2 text-text">{tr("Kenalan dulu, yuk.")}</h1>
        <p className="text-textMuted mb-8">{tr("Licia siap jadi teman cerita harianmu.")}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-textMuted mb-1 block">{tr("Nama panggilan")}</label>
            <input
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-text outline-none focus:ring-2 focus:ring-accent"
              placeholder={tr("Panggil aku...")}
            />
          </div>
          <div>
            <label className="text-sm text-textMuted mb-1 block">{tr("Email")}</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-text outline-none focus:ring-2 focus:ring-accent"
              placeholder={tr("kamu@email.com")}
            />
          </div>
          <div>
            <label className="text-sm text-textMuted mb-1 block">{tr("Kata sandi")}</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-text outline-none focus:ring-2 focus:ring-accent"
              placeholder={tr("Minimal 6 karakter")}
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-accent text-white py-3 font-medium hover:opacity-90 transition disabled:opacity-60"
          >
            {loading ? tr("Membuat akun...") : tr("Daftar")}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-textMuted">{tr("atau")}</span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <GoogleButton />

        <p className="text-sm text-textMuted mt-6 text-center">
          {tr("Sudah punya akun?")}{" "}
          <Link href="/login" className="text-accent font-medium">
            {tr("Masuk")}</Link>
        </p>
      </div>
    </div>
  );
}
