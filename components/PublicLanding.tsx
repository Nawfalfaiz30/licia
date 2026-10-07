import Link from "next/link";

const features = [
  ["Hari Ini", "Satu tempat untuk melihat langkah terbaik, agenda, prioritas, dan ritme harian."],
  [
    "AI yang bisa bertindak",
    "Licia dapat membaca konteks Life OS, menjalankan aksi terverifikasi, dan menyediakan undo.",
  ],
  ["Offline-first", "Perubahan dapat diantre saat offline dan disinkronkan kembali dengan resolusi konflik."],
  ["Pribadi", "RLS, Vault client-side, privacy controls, audit trail, dan proteksi aksi berisiko."],
];

export function PublicLanding() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-text">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-16 lg:px-10">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-accent">Licia Personal Life OS</p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
            Satu ruang untuk berpikir, merencanakan, dan menjalani hidup.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-textMuted">
            Tugas, kalender, catatan, keuangan, kebiasaan, fokus, dan AI bekerja sebagai satu sistem yang memahami
            konteksmu.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="min-h-11 rounded-2xl bg-accent px-6 py-3 font-semibold text-white shadow-sm">
              Masuk ke Licia
            </Link>
            <Link href="/guide" className="min-h-11 rounded-2xl border border-border px-6 py-3 font-semibold">
              Lihat panduan
            </Link>
          </div>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(([title, description]) => (
            <article key={title} className="rounded-3xl border border-border bg-surface/80 p-5 shadow-sm">
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-textMuted">{description}</p>
            </article>
          ))}
        </div>

        <footer className="mt-14 flex flex-wrap gap-4 text-sm text-textMuted">
          <Link href="/privacy" className="hover:text-text">
            Privasi
          </Link>
          <Link href="/security" className="hover:text-text">
            Keamanan
          </Link>
          <span>Licia 0.58.0</span>
        </footer>
      </section>
    </main>
  );
}
