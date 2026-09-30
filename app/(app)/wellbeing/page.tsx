import Link from "next/link";
import { HeartPulse, Repeat, ArrowRight, Activity } from "lucide-react";
import { Card } from "@/components/ui";

const items = [
  { href: "/health", title: "Kesehatan", detail: "Metrik tubuh, nutrisi, tidur, aktivitas, dan ringkasan kesehatan pribadi.", icon: HeartPulse },
  { href: "/habits", title: "Rutinitas", detail: "Kebiasaan harian, checklist, streak, dan ritme yang ingin kamu bangun.", icon: Repeat },
];

export default function WellbeingPage() {
  return <div className="space-y-5">
    <section className="relative overflow-hidden rounded-[2rem] border border-accent/15 bg-surface p-5 shadow-sm sm:p-7">
      <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative flex items-start gap-3">
        <span className="rounded-2xl bg-accent/10 p-3 text-accent"><Activity size={20}/></span>
        <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-accent">Ruang hidup</p><h1 className="mt-2 font-display text-3xl text-text">Kesehatan & Rutinitas</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-textMuted">Dua sisi keseharian yang saling berhubungan: bagaimana kondisi tubuhmu dan kebiasaan yang membantu menjaganya. Mesin tetap terpisah, pintu masuknya cukup satu.</p></div>
      </div>
    </section>
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map(({href,title,detail,icon:Icon}) => <Link href={href} key={href}><Card className="h-full p-5 transition hover:-translate-y-0.5 hover:border-accent/30"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent"><Icon size={19}/></div><h2 className="mt-4 font-display text-xl text-text">{title}</h2><p className="mt-1 text-xs leading-relaxed text-textMuted">{detail}</p><span className="mt-4 inline-flex items-center gap-1.5 text-[10px] font-semibold text-accent">Buka <ArrowRight size={12}/></span></Card></Link>)}
    </div>
  </div>;
}
