import Link from "next/link";
import { Brain, BookOpen, LibraryBig, StickyNote, GraduationCap } from "lucide-react";
import { Card } from "@/components/ui";
import { getServerI18n } from "@/lib/i18n/server";

const items = [
  { href: "/learning", title: "Belajar & Keahlian", detail: "Skill, materi, level, target belajar, dan sesi latihan yang kamu bangun.", icon: GraduationCap },
  { href: "/notes", title: "Catatan", detail: "Hal yang kamu tulis sendiri dan ingin dicatat.", icon: StickyNote },
  { href: "/memory", title: "Memori Licia", detail: "Fakta dan preferensi yang sengaja kamu minta Licia ingat.", icon: Brain },
  { href: "/vault", title: "Vault", detail: "Dokumen, referensi, dan bahan pengetahuan pribadi.", icon: LibraryBig },
  { href: "/reading", title: "Bacaan", detail: "Daftar bacaan, progres, rating, dan sesi membaca.", icon: BookOpen },
];

export default async function KnowledgePage() {
  const { tr } = await getServerI18n();
  return <div className="space-y-5">
    <section className="rounded-[2rem] border border-accent/15 bg-surface p-5 sm:p-7">
      <p className="text-[10px] font-bold uppercase tracking-[.14em] text-accent">{tr("Knowledge")}</p>
      <h1 className="mt-2 font-display text-3xl text-text">{tr("Satu tempat untuk hal yang ingin kamu simpan")}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-textMuted">{tr("Catatan, Memory, Vault, Bacaan, dan Belajar tetap punya mesin sendiri, tetapi pintu masuknya satu supaya tidak terasa seperti banyak aplikasi kecil.")}</p>
    </section>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map(({ href,title,detail,icon:Icon }) => <Link key={href} href={href}><Card className="h-full p-5 transition hover:-translate-y-0.5 hover:border-accent/30"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent"><Icon size={19}/></div><h2 className="mt-4 font-display text-xl text-text">{tr(title)}</h2><p className="mt-1 text-xs leading-relaxed text-textMuted">{tr(detail)}</p></Card></Link>)}</div>
  </div>;
}
