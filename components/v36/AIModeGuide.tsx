"use client";

import { useLanguage } from "@/components/LanguageProvider";
import Link from "next/link";
import { ArrowRight, CalendarDays, ClipboardCheck, Compass, Sparkles } from "lucide-react";
import { clsx } from "clsx";

type Mode = "now" | "future" | "past";

const modes: Array<{ id: Mode; label: string; title: string; description: string; href: string; icon: typeof Compass }> = [
  { id: "now", label: "Sekarang", title: "Life Copilot", description: "Membaca kondisi saat ini: risiko, agenda, prioritas, evidence, dan langkah berikutnya.", href: "/copilot", icon: Compass },
  { id: "future", label: "7 hari ke depan", title: "Perencana Mingguan AI", description: "Menyusun usulan minggu berdasarkan task, deadline, agenda, rutinitas, dan ruang fokus.", href: "/planner", icon: CalendarDays },
  { id: "past", label: "7 hari terakhir", title: "Review Mingguan", description: "Meninjau apa yang sudah terjadi: progres, fokus, inbox, pola, dan hal yang perlu dipelajari.", href: "/review-center", icon: ClipboardCheck },
];

export function AIModeGuide({ compact = false }: { compact?: boolean }) {
  const { t: tr } = useLanguage();
  return (
    <section className={clsx("rounded-[1.6rem] border border-accent/15 bg-gradient-to-br from-accent/5 via-surface to-surface p-4 sm:p-5", compact && "p-3 sm:p-4")}>
      <div className="flex items-start gap-3">
        <span className="rounded-2xl bg-accent/10 p-2.5 text-accent"><Sparkles size={16} /></span>
        <div className="min-w-0">
          <p className="text-2xs font-bold uppercase tracking-[.16em] text-accent">{tr("3 cara memakai AI Licia")}</p>
          <p className="mt-1 text-sm font-semibold text-text">{tr("Pilih berdasarkan waktunya, bukan berdasarkan nama fiturnya.")}</p>
          {!compact && <p className="mt-1 text-2xs leading-relaxed text-textMuted">{tr("Copilot membantu keadaan sekarang, Planner menyusun masa depan, dan Review membaca masa lalu. Ketiganya memakai konteks yang sama tetapi tujuan yang berbeda.")}</p>}
        </div>
      </div>
      <div className={clsx("mt-4 grid gap-2", compact ? "md:grid-cols-3" : "md:grid-cols-3")}>
        {modes.map(({ id, label, title, description, href, icon: Icon }) => (
          <Link key={id} href={href} className="group rounded-2xl border border-border bg-bg/70 p-3 transition hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-sm">
            <div className="flex items-center justify-between gap-2"><span className="rounded-xl bg-accent/10 p-2 text-accent"><Icon size={14} /></span><span className="rounded-full bg-surface px-2 py-1 text-2xs font-semibold text-textMuted">{tr(label)}</span></div>
            <p className="mt-3 text-xs font-semibold text-text">{tr(title)}</p>
            <p className="mt-1 line-clamp-3 text-2xs leading-relaxed text-textMuted">{tr(description)}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-2xs font-semibold text-accent">{tr("Buka")}{" "}<ArrowRight size={10} className="transition group-hover:translate-x-0.5" /></span>
          </Link>
        ))}
      </div>
    </section>
  );
}
