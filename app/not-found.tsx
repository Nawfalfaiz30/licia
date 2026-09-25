import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return <main className="licia-main flex min-h-[70vh] items-center justify-center"><div className="w-full max-w-lg rounded-3xl border border-border bg-surface p-8 text-center shadow-sm licia-card-motion"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">404</p><h1 className="mt-2 font-display text-3xl text-text">Halaman tidak ditemukan</h1><p className="mt-2 text-sm leading-relaxed text-textMuted">Mungkin tautannya sudah berubah atau halaman tersebut memang tidak tersedia.</p><Link href="/today" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5"><ArrowLeft size={15}/> Kembali ke Hari Ini</Link></div></main>;
}
