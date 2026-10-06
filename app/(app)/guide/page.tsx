"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  Database,
  HeartPulse,
  Lightbulb,
  Search,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  Wallet,
  X,
} from "lucide-react";
import { clsx } from "clsx";

import { useLanguage } from "@/components/LanguageProvider";

type GuideItem = {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  example?: string;
  href: string;
  icon: typeof BookOpen;
  category: "Mulai" | "Rencana" | "Personal" | "AI & Privasi" | "Sistem";
};

const guide: GuideItem[] = [
  { id:"home", title:"Beranda", summary:"Ringkasan pribadi untuk agenda, keuangan, target & proyek, dan sinyal penting.", steps:["Mulai dari kondisi hari ini sebelum membuka modul lain.","Kartu informasi membawa kamu langsung ke sumber data tanpa membuat dashboard penuh.","Gunakan Chat Licia ketika perlu bertanya atau meminta tindakan yang tidak punya tombol khusus."], href:"/dashboard", icon:Sparkles, category:"Mulai" },
  { id:"plan", title:"Rencana", summary:"Pusat aktivitas berbasis waktu: tugas, kalender, fokus, perencana, Inbox, dan pengingat.", steps:["Tugas, Kalender, Fokus, dan Pengingat mengikuti satu alur Rencana.","Prioritas dengan Licia langsung menyusun dan memperbarui prioritas dari halaman Tugas tanpa membuka Chat.","Agenda → Tugas membuat task dan menghubungkannya ke agenda; Tugas → Agenda langsung mencari slot waktu dan membuat agenda.","Perencana dan Inbox menjadi alat pendukung di dalam alur yang sama."], example:"Jadwalkan dua jam belajar besok lalu buat pengingat 30 menit sebelumnya.", href:"/plan", icon:CalendarDays, category:"Rencana" },
  { id:"goals", title:"Target & Proyek", summary:"Satu ruang untuk tujuan, proyek, progres, dan pekerjaan yang mengarah kepadanya.", steps:["Gunakan tab gabungan untuk melihat target dan proyek dalam satu konteks.","Hubungkan proyek ke target agar progres tidak terputus.","Tugas dan fokus dapat dijalankan tanpa berpindah ke workspace target yang lain."], example:"Buat target lulus kuliah lalu hubungkan proyek tugas akhir ke target itu.", href:"/goals-projects", icon:Target, category:"Rencana" },
  { id:"knowledge", title:"Knowledge & Belajar", summary:"Semua pengetahuan pribadi berada di satu tempat, termasuk catatan, memory, dokumen, bacaan, dan pembelajaran.", steps:["Catatan, memory, dokumen, bacaan, dan materi belajar dikelola dari workspace yang sama.","Gunakan pencarian workspace untuk menemukan informasi tanpa membuka halaman teknis.","Chat Licia dapat membantu mencari, merangkum, atau mengubah pengetahuan menjadi tindakan."], href:"/knowledge", icon:BookOpen, category:"Personal" },
  { id:"wellbeing", title:"Kesehatan & Rutinitas", summary:"Hub gabungan untuk kesehatan, aktivitas, tidur, nutrisi, dan rutinitas harian.", steps:["Masukkan data kesehatan di bagian yang sesuai.","Checklist rutinitas tetap mengikuti hari yang benar.","Gunakan ringkasan untuk melihat pola, bukan hanya daftar entri."], href:"/wellbeing", icon:HeartPulse, category:"Personal" },
  { id:"finance", title:"Keuangan", summary:"Transaksi, anggaran, dompet, dan langganan berada dalam satu pusat keuangan.", steps:["Catat pemasukan, pengeluaran, dan transfer saldo tanpa berpindah workspace.","Tambahkan langganan langsung dari Keuangan dan tentukan siklus serta tanggal tagihannya.","Catat pembayaran langganan sebagai pengeluaran dari workspace yang sama.","Gunakan ringkasan untuk melihat saldo, arus kas, komitmen rutin, dan kategori pengeluaran."], example:"Tambahkan langganan internet bulanan, lalu catat pembayarannya saat tagihan masuk.", href:"/finance", icon:Wallet, category:"Personal" },
  { id:"capture", title:"Tangkap", summary:"Masukkan teks atau gambar lalu biarkan Licia membantu menempatkannya di ruang kerja yang tepat.", steps:["Gunakan Tangkap untuk ide atau informasi yang ingin disimpan dengan cepat.","Gambar dapat dibaca untuk jadwal, dokumen, struk, atau informasi visual lain.","Periksa hasil sebelum menerapkan perubahan dalam jumlah besar."], example:"Ambil jadwal dari foto lalu masukkan agenda yang benar ke Kalender.", href:"/capture", icon:Camera, category:"Mulai" },
  { id:"chat", title:"Chat Licia", summary:"Tempat bercakap dan meminta bantuan yang membutuhkan konteks. Aksi yang sudah punya tombol khusus tetap dijalankan langsung di workspace masing-masing.", steps:["Gunakan Chat untuk pertanyaan, penjelasan, ide, pencarian lintas Life OS, atau permintaan yang belum punya alur khusus.","Tombol seperti Prioritas dengan Licia, Agenda → Tugas, dan Tugas → Agenda tidak membuka Chat; hasilnya langsung dikerjakan di workspace.","Perubahan massal yang berisiko akan muncul sebagai ringkasan persetujuan di dalam percakapan, bukan panel yang menumpuk.","Gunakan tombol Batalkan ketika aksi terakhir masih dapat dipulihkan."], example:"Tanya kondisi minggu ini, lalu minta Licia menjelaskan faktor yang paling memengaruhinya.", href:"/chat", icon:Sparkles, category:"AI & Privasi" },
  { id:"insights", title:"Insights", summary:"Pusat wawasan untuk review, pola, peta, aktivitas, dan otomasi.", steps:["Gunakan ringkasan untuk memahami sinyal penting terlebih dahulu.","Peta Hidup + Peta Koneksi tersedia dari satu konteks Peta & Relasi.","Linimasa + Analitik + Review dijelajahi melalui konteks Review & Pola.","Otomasi tetap tersedia dari Insights, bukan sebagai menu utama baru."], href:"/insights", icon:Lightbulb, category:"Personal" },
  { id:"system", title:"Sistem, Privasi & Perangkat", summary:"Kontrol teknis disederhanakan agar pengguna tidak perlu memilih antara banyak pusat sistem.", steps:["Pengaturan menjadi pintu utama untuk privasi AI, sinkronisasi, notifikasi, data, dan pemeriksaan sistem.","Riwayat aksi AI digunakan untuk transparansi dan undo dari operasi yang mendukung pemulihan.","Fitur yang sudah digabung tidak muncul kembali sebagai menu terpisah di ponsel maupun desktop."], href:"/settings", icon:Settings2, category:"Sistem" },
  { id:"mobile-more", title:"Lainnya di ponsel", summary:"Lainnya adalah katalog tujuan aktif di ponsel. Workspace yang sudah digabung tidak kembali muncul sebagai menu lama.", steps:["Ketuk Lainnya pada footer untuk membuka seluruh tujuan aktif.","Pilih workspace seperti Rencana, Target & Proyek, Knowledge & Belajar, Keuangan, Kesehatan & Rutinitas, atau Insights.","Pintasan gabungan seperti Kalender & Pengingat, Perencana & Inbox, Peta & Relasi, dan Review & Pola tetap menuju workspace induknya.","Menu lama seperti Target, Proyek, Langganan, Catatan, Memory, Vault, Analitik, Timeline, atau Pengingat tidak ditampilkan lagi sebagai tujuan terpisah."], href:"/dashboard", icon:Smartphone, category:"Mulai" },
  { id:"privacy", title:"Privasi AI", summary:"Tentukan bagian data mana yang boleh dibaca Licia.", steps:["Izin mengikuti workspace yang terlihat oleh pengguna.","Keuangan dan Kesehatan tetap dapat dibatasi secara terpisah.","Mode konteks luas tidak mengabaikan izin domain sensitif."], href:"/settings#ai", icon:ShieldCheck, category:"AI & Privasi" },
  { id:"settings", title:"Pengaturan", summary:"Satu tempat untuk tampilan, workspace, AI, interaksi, perangkat, notifikasi, data, dan kompatibilitas fitur gabungan.", steps:["Tampilan mengatur font, tema, ukuran, bahasa, dan halaman awal.","Workspace menjelaskan struktur canonical yang sama di desktop dan ponsel.","AI & Privasi mengatur perilaku dan izin data tanpa mengembalikan menu teknis lama.","Perangkat & Notifikasi dan Data & Akun menampung kontrol teknis yang jarang dipakai."], href:"/settings", icon:Settings2, category:"Sistem" },
  { id:"search", title:"Pencarian", summary:"Cari lintas workspace tanpa perlu mengetahui asal fitur sebelumnya.", steps:["Gunakan kata yang spesifik atau nama entitas.","Buka workspace sumber untuk melanjutkan tindakan.","Gunakan Chat hanya ketika pencarian perlu ditafsirkan atau ditindaklanjuti."], href:"/search", icon:Search, category:"Mulai" },
  { id:"backup", title:"Ekspor & Backup", summary:"Simpan salinan data pribadi untuk arsip atau pemulihan.", steps:["Buka Pengaturan → Data & Akun.","Gunakan Ekspor untuk membuat salinan.","Gunakan Backup & Restore untuk pemulihan atau pemindahan data."], href:"/settings#data", icon:Database, category:"Sistem" },
];



const quickPrompts = [
  "Apa yang paling penting hari ini?",
  "Rapikan jadwal saya besok dan cari konflik.",
  "Buat tugas dari ide ini dan beri deadline yang masuk akal.",
];



export default function GuidePage() {
  const { t: tr } = useLanguage();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>("home");
  const [category, setCategory] = useState<GuideItem["category"] | "Semua">("Semua");

  const categories = ["Semua", "Mulai", "Rencana", "Personal", "AI & Privasi", "Sistem"] as const;

  const counts = useMemo(
    () =>
      categories.reduce<Record<string, number>>((acc, item) => {
        acc[item] = item === "Semua" ? guide.length : guide.filter((x) => x.category === item).length;
        return acc;
      }, {}),
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return guide.filter(
      (x) =>
        (category === "Semua" || x.category === category) &&
        (!q ||
          `${x.title} ${tr(x.title)} ${tr(x.summary)} ${x.steps
            .map((st) => tr(st))
            .join(" ")} ${x.example ? tr(x.example) : ""}`
            .toLowerCase()
            .includes(q))
    );
  }, [query, category, tr]);

  const featured = guide.slice(0, 3);

  return (
    <div className="guide-shell mx-auto max-w-6xl space-y-5 pb-8 animate-licia-page-in">
      <header className="relative overflow-hidden rounded-[2rem] border border-accent/15 bg-surface shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/[0.10] via-transparent to-transparent" />
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-accent/[0.06] blur-3xl" />

        <div className="relative grid gap-7 p-5 sm:p-7 lg:grid-cols-[1fr_320px] lg:items-center lg:p-9">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/15 bg-accent/5 px-3 py-1.5 text-2xs font-bold uppercase tracking-[0.14em] text-accent">
              <Sparkles size={12} />
              {tr("Pusat Bantuan Licia")}
            </div>

            <h1 className="mt-4 max-w-2xl font-display text-3xl leading-tight text-text sm:text-4xl lg:text-[2.75rem]">
              {tr("Kenali Licia, tanpa harus menghafal banyak menu.")}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-textMuted">
              {tr("Temukan workspace yang tepat, pelajari cara kerjanya, atau langsung minta bantuan Licia. Semua panduan mengikuti struktur aplikasi saat ini.")}
            </p>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Link
                href="/chat"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-xs font-bold text-white shadow-sm transition hover:opacity-90"
              >
                <Sparkles size={15} />
                {tr("Tanya Licia")}
                <ArrowRight size={13} />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-bg/70 px-4 text-xs font-bold text-text transition hover:border-accent/30 hover:text-accent"
              >
                <BookOpen size={15} />
                {tr("Mulai dari Beranda")}
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-border bg-bg/70 p-3 text-center backdrop-blur">
              <p className="font-display text-xl text-text">{guide.length}</p>
              <p className="mt-0.5 text-2xs text-textMuted">{tr("Panduan")}</p>
            </div>
            <div className="rounded-2xl border border-border bg-bg/70 p-3 text-center backdrop-blur">
              <p className="font-display text-xl text-text">{categories.length - 1}</p>
              <p className="mt-0.5 text-2xs text-textMuted">{tr("Kategori")}</p>
            </div>
            <div className="rounded-2xl border border-border bg-bg/70 p-3 text-center backdrop-blur">
              <p className="font-display text-xl text-text">AI</p>
              <p className="mt-0.5 text-2xs text-textMuted">{tr("Siap bantu")}</p>
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        {featured.map((item, index) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-4 transition duration-200 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md"
            >
              <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-accent/5 blur-2xl transition group-hover:bg-accent/10" />
              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <Icon size={18} />
                  </span>
                  <span className="rounded-full bg-bg px-2 py-1 text-2xs font-semibold text-textMuted">
                    {tr("Pilihan")}
                  </span>
                </div>
                <h2 className="mt-4 text-sm font-bold text-text">{tr(item.title)}</h2>
                <p className="mt-1.5 line-clamp-2 text-2xs leading-relaxed text-textMuted">{tr(item.summary)}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-2xs font-bold text-accent">
                  {tr("Buka workspace")}
                  <ArrowRight size={11} className="transition group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {quickPrompts.map((prompt, index) => (
          <Link
            key={prompt}
            href={`/chat?prompt=${encodeURIComponent(tr(prompt))}`}
            className="group rounded-2xl border border-border bg-surface p-4 transition duration-200 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/10 text-2xs font-bold text-accent">
                {index + 1}
              </span>
              <ArrowRight size={14} className="text-textMuted transition group-hover:translate-x-0.5 group-hover:text-accent" />
            </div>
            <p className="mt-4 text-xs font-bold leading-relaxed text-text">{tr(prompt)}</p>
            <p className="mt-1.5 text-2xs text-textMuted">{tr("Tanya Licia")}</p>
          </Link>
        ))}
      </section>

      <section className="sticky top-2 z-30 rounded-2xl border border-border bg-surface/95 p-2 shadow-lg shadow-black/[0.03] backdrop-blur-xl">
        <div className="flex flex-col gap-2">
          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-bg px-3">
            <Search size={16} className="shrink-0 text-textMuted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr("Cari panduan, task, kalender, AI, keuangan…")}
              className="min-w-0 flex-1 bg-transparent py-3 text-xs text-text outline-none placeholder:text-textMuted"
              aria-label={tr("Cari panduan")}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded-lg p-1.5 text-textMuted transition hover:bg-surface hover:text-text"
                aria-label={tr("Hapus pencarian")}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={clsx(
                  "flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-2xs font-bold transition",
                  category === item
                    ? "bg-accent text-white shadow-sm"
                    : "border border-border bg-bg text-textMuted hover:border-accent/25 hover:text-text"
                )}
              >
                {tr(item)}
                <span
                  className={clsx(
                    "rounded-full px-1.5 py-0.5 text-2xs",
                    category === item ? "bg-white/15 text-white" : "bg-surface text-textMuted"
                  )}
                >
                  {counts[item]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-2xs font-bold uppercase tracking-[0.14em] text-accent">{tr("Semua panduan")}</p>
          <h2 className="mt-1 font-display text-xl text-text">{tr("Pilih topik yang ingin kamu kuasai")}</h2>
        </div>
        <p className="text-2xs text-textMuted">
          {tr("Menampilkan")} <span className="font-bold text-text">{filtered.length}</span> {tr("panduan")}
        </p>
      </div>

      <section className="space-y-3">
        {filtered.map((item, index) => {
          const Icon = item.icon;
          const expanded = open === item.id;

          return (
            <article
              key={item.id}
              className={clsx(
                "overflow-hidden rounded-2xl border bg-surface transition-all duration-200",
                expanded ? "border-accent/25 shadow-md shadow-black/[0.03]" : "border-border hover:border-accent/15"
              )}
            >
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : item.id)}
                className="group flex w-full min-w-0 items-center gap-3 p-4 text-left sm:p-5"
                aria-expanded={expanded}
              >
                <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <Icon size={18} />
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-surface bg-bg px-1 text-2xs font-bold text-textMuted">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-bold text-text sm:text-sm">{tr(item.title)}</span>
                    <span className="rounded-full bg-bg px-2 py-0.5 text-2xs font-bold text-textMuted">
                      {tr(item.category)}
                    </span>
                  </span>
                  <span className="mt-1 block max-w-3xl text-2xs leading-relaxed text-textMuted sm:text-xs">
                    {tr(item.summary)}
                  </span>
                </span>

                <span
                  className={clsx(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-bg text-textMuted transition",
                    expanded && "bg-accent/10 text-accent"
                  )}
                >
                  <ChevronDown size={15} className={clsx("transition-transform", expanded && "rotate-180")} />
                </span>
              </button>

              {expanded && (
                <div className="border-t border-border bg-bg/35 px-4 pb-5 pt-4 sm:px-5">
                  <div className="grid gap-2 md:grid-cols-2">
                    {item.steps.map((step, stepIndex) => (
                      <div key={step} className="flex gap-3 rounded-xl border border-border/70 bg-surface p-3.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-2xs font-bold text-accent">
                          {stepIndex + 1}
                        </span>
                        <p className="min-w-0 pt-0.5 text-2xs leading-relaxed text-textMuted sm:text-xs">{tr(step)}</p>
                      </div>
                    ))}
                  </div>

                  {item.example && (
                    <div className="mt-3 rounded-2xl border border-accent/15 bg-accent/[0.06] p-4">
                      <div className="flex items-center gap-2 text-accent">
                        <Lightbulb size={14} />
                        <p className="text-2xs font-bold uppercase tracking-[0.12em]">{tr("Contoh")}</p>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-text">“{tr(item.example)}”</p>
                    </div>
                  )}

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Link
                      href={item.href}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-accent px-3.5 text-2xs font-bold text-white transition hover:opacity-90"
                    >
                      {tr("Buka {item_title}", { item_title: item.title })}
                      <ArrowRight size={12} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setOpen(null)}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3.5 text-2xs font-bold text-textMuted transition hover:text-text"
                    >
                      <Check size={12} />
                      {tr("Selesai membaca")}
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}

        {!filtered.length && (
          <div className="rounded-3xl border border-dashed border-border bg-surface p-10 text-center sm:p-14">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <Search size={24} />
            </div>
            <h3 className="mt-4 font-display text-xl text-text">{tr("Topik tidak ditemukan")}</h3>
            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-textMuted">
              {tr("Coba kata lain seperti task, agenda, AI, privacy, backup, atau pilih kategori berbeda.")}
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCategory("Semua");
              }}
              className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl bg-accent px-4 text-2xs font-bold text-white"
            >
              {tr("Tampilkan semua")}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
