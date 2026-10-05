import Link from "next/link";
import { getServerI18n } from "@/lib/i18n/server";

export const metadata = {
  title: "Privasi · Licia",
  description: "Informasi privasi dan pengelolaan data Licia 2.0.",
};

export default async function PublicPrivacyPage() {
  const { tr } = await getServerI18n();
  return (
    <main className="min-h-screen bg-bg px-5 py-12 text-text sm:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="rounded-3xl border border-accent/15 bg-surface p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-accent">{tr("Privacy")}</p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl">{tr("Privasi Licia 2.0")}</h1>
          <p className="mt-3 text-sm leading-7 text-textMuted">
            {tr("Halaman ini menjelaskan secara umum bagaimana Licia memproses data agar fitur Life OS, sinkronisasi, pengingat, dan AI dapat bekerja.")}</p>
        </header>
        <section className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
          <div className="space-y-6 text-sm leading-7 text-textMuted">
            <div><h2 className="font-semibold text-text">{tr("Data yang diproses")}</h2><p>{tr("Licia dapat memproses data yang kamu masukkan sendiri seperti tugas, agenda, catatan, keuangan, pengingat, dan preferensi aplikasi. Fitur AI hanya menggunakan konteks yang diizinkan oleh pengaturan akun dan kebutuhan permintaan.")}</p></div>
            <div><h2 className="font-semibold text-text">{tr("Data ke layanan AI")}</h2><p>{tr("Permintaan yang menggunakan AI dapat mengirimkan teks, metadata konteks, dan lampiran yang diperlukan ke penyedia model yang dikonfigurasi server Licia. Data yang tidak diperlukan oleh permintaan sebaiknya tidak dimasukkan.")}</p></div>
            <div><h2 className="font-semibold text-text">{tr("Kontrol pengguna")}</h2><p>{tr("Kamu dapat mengatur izin konteks AI, mengekspor data, melakukan backup/restore, dan menghapus akun melalui Pengaturan setelah masuk.")}</p></div>
            <div><h2 className="font-semibold text-text">{tr("Penghapusan dan retensi")}</h2><p>{tr("Data akun dapat dihapus sesuai kemampuan pengelolaan data yang tersedia pada instance Licia yang digunakan. Log operasional dan event notifikasi dapat memiliki masa retensi terpisah.")}</p></div>
            <div><h2 className="font-semibold text-text">{tr("Keamanan")}</h2><p>{tr("Akses data pengguna dibatasi berdasarkan user ID dan sesi autentikasi. Secret server seperti service-role key dan VAPID private key tidak ditampilkan ke browser.")}</p></div>
          </div>
        </section>
        <div className="flex flex-wrap gap-2">
          <Link href="/login" className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white">{tr("Masuk ke Licia")}</Link>
          <Link href="/" className="rounded-xl bg-surface px-4 py-2 text-xs font-semibold text-textMuted">{tr("Kembali")}</Link>
        </div>
      </div>
    </main>
  );
}
