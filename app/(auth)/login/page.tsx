"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { GoogleButton } from "@/components/auth/GoogleButton";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-bg">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-4xl mb-2 text-text">Halo lagi.</h1>
        <p className="text-textMuted mb-8">Licia sudah menunggu ceritamu hari ini.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-textMuted mb-1 block">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-text outline-none focus:ring-2 focus:ring-accent"
              placeholder="kamu@email.com"
            />
          </div>
          <div>
            <label className="text-sm text-textMuted mb-1 block">Kata sandi</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-text outline-none focus:ring-2 focus:ring-accent"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-accent text-white py-3 font-medium hover:opacity-90 transition disabled:opacity-60"
          >
            {loading ? "Masuk..." : "Masuk"}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-textMuted">atau</span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <GoogleButton />

        <p className="text-sm text-textMuted mt-6 text-center">
          Belum punya akun?{" "}
          <Link href="/signup" className="text-accent font-medium">
            Daftar
          </Link>
        </p>
      </div>
    </div>
  );
}
