"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";

type Factor = {
  id: string;
  friendly_name?: string | null;
  factor_type?: string;
  status?: string;
};

type Enrollment = {
  id: string;
  friendly_name?: string | null;
  totp?: {
    qr_code?: string | null;
    secret?: string | null;
    uri?: string | null;
  } | null;
};

export function StepUpAuth({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const { t: tr } = useLanguage();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [verifiedFactor, setVerifiedFactor] = useState<Factor | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    void (async () => {
      setLoading(true);
      const { data, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (!alive) return;
      if (factorsError) {
        setError(factorsError.message || tr("Faktor keamanan tidak dapat dimuat."));
        setLoading(false);
        return;
      }
      const verified = (data?.totp || []).find((factor) => factor.status === "verified") || null;
      setVerifiedFactor(verified);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [supabase, tr]);

  async function beginEnrollment() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Licia Step-up",
      });
      if (enrollError || !data) throw enrollError || new Error(tr("Authenticator tidak dapat dibuat."));
      setEnrollment(data as Enrollment);
      setNotice(tr("Authenticator dibuat. Tambahkan ke aplikasi authenticator lalu masukkan kode 6 digit."));
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("Authenticator tidak dapat dibuat."));
    } finally {
      setBusy(false);
    }
  }

  async function verify(factorId: string) {
    const trimmed = code.replace(/\D/g, "").slice(0, 6);
    if (!/^\d{6}$/.test(trimmed)) {
      setError(tr("Masukkan kode 6 digit dari authenticator."));
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError || !challenge?.id) {
        throw challengeError || new Error(tr("Challenge MFA gagal dibuat."));
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: trimmed,
      });
      if (verifyError) throw verifyError;

      await supabase.auth.getClaims();
      router.replace(nextPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("Kode verifikasi tidak valid."));
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function verifyEnrollment() {
    if (!enrollment?.id) return;
    await verify(enrollment.id);
  }

  function cancel() {
    router.replace(nextPath);
  }

  if (loading) {
    return (
      <main className="min-h-[70dvh] bg-bg px-4 py-10">
        <div className="mx-auto flex max-w-md items-center justify-center rounded-3xl border border-border bg-surface p-10 text-textMuted shadow-sm">
          <Loader2 size={20} className="animate-spin" aria-hidden="true" />
          <span className="ml-2 text-sm">{tr("Memeriksa keamanan sesi…")}</span>
        </div>
      </main>
    );
  }

  const needsEnrollment = !verifiedFactor && !enrollment;

  return (
    <main className="min-h-[80dvh] bg-bg px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-lg flex-col gap-5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={cancel}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-textMuted transition hover:bg-surface hover:text-text"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            {tr("Kembali")}
          </button>
          <div className="flex items-center gap-2 text-xs font-semibold text-textMuted">
            <Image src="/licia-avatar.png" alt="" width={26} height={26} className="rounded-full" />
            {tr("Licia")}
          </div>
        </div>

        <section className="rounded-[2rem] border border-border bg-surface p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent">
              <ShieldCheck size={21} aria-hidden="true" />
            </span>
            <div>
              <p className="text-2xs font-bold uppercase tracking-[.16em] text-accent">{tr("Step-up security")}</p>
              <h1 className="mt-1 font-display text-2xl text-text sm:text-3xl">{tr("Verifikasi sebelum aksi sensitif")}</h1>
              <p className="mt-2 text-sm leading-relaxed text-textMuted">
                {tr("Licia meminta faktor kedua sebelum ekspor data penuh, pemulihan backup, operasi Vault, transfer uang, atau penghapusan massal.")}
              </p>
            </div>
          </div>

          {needsEnrollment ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-accent/20 bg-accent/5 p-4">
                <div className="flex items-start gap-3">
                  <KeyRound size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-text">{tr("Aktifkan Authenticator")}</p>
                    <p className="mt-1 text-xs leading-relaxed text-textMuted">
                      {tr("Licia menggunakan TOTP seperti Google Authenticator, Microsoft Authenticator, atau 1Password. Setelah verifikasi pertama selesai, sesi Licia lain dapat diminta login ulang oleh Supabase.")}
                    </p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void beginEnrollment()}
                disabled={busy}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                {busy ? tr("Menyiapkan…") : tr("Aktifkan Authenticator")}
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {enrollment?.totp?.qr_code ? (
                <div className="rounded-2xl border border-border bg-bg p-4">
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-sm font-semibold text-text">{tr("Pindai QR code")}</p>
                    <Image
                      src={enrollment.totp.qr_code}
                      alt={tr("QR code untuk Authenticator")}
                      width={220}
                      height={220}
                      unoptimized
                      className="rounded-xl border border-border bg-white p-2"
                    />
                    <div className="w-full rounded-xl border border-border bg-surface p-3">
                      <p className="text-2xs font-bold uppercase tracking-[.1em] text-textMuted">{tr("Secret manual")}</p>
                      <code className="mt-1 block break-all text-xs font-semibold text-text">{enrollment.totp.secret || "—"}</code>
                    </div>
                  </div>
                </div>
              ) : null}

              <label className="block">
                <span className="text-2xs font-bold uppercase tracking-[.08em] text-textMuted">{tr("Kode 6 digit")}</span>
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      if (enrollment?.id) void verifyEnrollment();
                      else if (verifiedFactor?.id) void verify(verifiedFactor.id);
                    }
                  }}
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  className="mt-2 min-h-12 w-full rounded-xl border border-border bg-bg px-3 text-center text-lg tracking-[.35em] text-text outline-none ring-accent/20 transition focus:border-accent focus:ring-4"
                  placeholder="123456"
                  aria-label={tr("Kode 6 digit")}
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  if (enrollment?.id) void verifyEnrollment();
                  else if (verifiedFactor?.id) void verify(verifiedFactor.id);
                }}
                disabled={busy || code.length !== 6 || (!enrollment?.id && !verifiedFactor?.id)}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {busy ? tr("Memverifikasi…") : tr("Verifikasi & lanjutkan")}
              </button>

              {verifiedFactor && !enrollment ? (
                <p className="text-center text-xs text-textMuted">
                  {tr("Faktor aktif")}: {verifiedFactor.friendly_name || tr("Authenticator")}
                </p>
              ) : null}
            </div>
          )}

          {notice ? (
            <div className="mt-4 rounded-2xl border border-accent/20 bg-accent/5 p-3 text-xs leading-relaxed text-text">
              {notice}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-danger/20 bg-danger/5 p-3 text-xs leading-relaxed text-danger" role="alert">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          <p className="mt-5 text-2xs leading-relaxed text-textMuted">
            {tr("Verifikasi step-up berlaku sekitar 10 menit. Untuk keamanan, jangan berikan kode authenticator kepada siapa pun.")}
          </p>
        </section>
      </div>
    </main>
  );
}
