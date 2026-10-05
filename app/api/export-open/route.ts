import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin, rateLimit } from "@/lib/security";
import { buildExportFiles, type ExportRow } from "@/lib/export/openFormats";
import { buildZip } from "@/lib/export/zip";

export const dynamic = "force-dynamic";

/** Modul yang diekspor ke Markdown/CSV. Kolom `label` memakai nama Indonesia (nama berkas); data apa adanya. */
const TABLES: Array<{ table: string; label: string; sortKey: string }> = [
  { table: "tasks", label: "Tugas", sortKey: "created_at" },
  { table: "subtasks", label: "Subtugas", sortKey: "created_at" },
  { table: "projects", label: "Proyek", sortKey: "updated_at" },
  { table: "goals", label: "Target", sortKey: "updated_at" },
  { table: "goal_milestones", label: "Milestone Target", sortKey: "created_at" },
  { table: "areas", label: "Area Kehidupan", sortKey: "created_at" },
  { table: "schedule_blocks", label: "Agenda Kalender", sortKey: "block_date" },
  { table: "brain_dump_notes", label: "Catatan", sortKey: "updated_at" },
  { table: "smart_inbox_items", label: "Kotak Masuk", sortKey: "created_at" },
  { table: "journal_entries", label: "Jurnal", sortKey: "entry_date" },
  { table: "decisions", label: "Jurnal Keputusan", sortKey: "created_at" },
  { table: "user_memories", label: "Memori Licia", sortKey: "updated_at" },
  { table: "skills", label: "Belajar dan Keahlian", sortKey: "updated_at" },
  { table: "reading_logs", label: "Bacaan", sortKey: "updated_at" },
  { table: "habits", label: "Rutinitas", sortKey: "created_at" },
  { table: "habit_checkins", label: "Riwayat Rutinitas", sortKey: "created_at" },
  { table: "accounts", label: "Dompet", sortKey: "created_at" },
  { table: "expenses", label: "Pengeluaran", sortKey: "occurred_at" },
  { table: "incomes", label: "Pemasukan", sortKey: "occurred_at" },
  { table: "account_transfers", label: "Transfer Dompet", sortKey: "occurred_at" },
  { table: "budgets", label: "Anggaran", sortKey: "created_at" },
  { table: "subscriptions", label: "Langganan", sortKey: "created_at" },
  { table: "pomodoro_sessions", label: "Sesi Fokus", sortKey: "started_at" },
  { table: "sleep_logs", label: "Tidur", sortKey: "sleep_end" },
  { table: "hydration_logs", label: "Hidrasi", sortKey: "logged_at" },
  { table: "meal_logs", label: "Makanan", sortKey: "logged_at" },
  { table: "movement_logs", label: "Gerak", sortKey: "logged_at" },
  { table: "health_metrics", label: "Metrik Fisik", sortKey: "measured_at" },
  { table: "reminders", label: "Pengingat", sortKey: "remind_at" },
  { table: "vault_items", label: "Vault", sortKey: "updated_at" },
];

export async function GET(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const gate = rateLimit(`export-open:${user.id}`, 6, 60_000);
  if (gate) return gate;

  const results = await Promise.all(
    TABLES.map(async (spec) => {
      // Vault tidak pernah dibaca isinya: cukup tahu tabelnya ada (berkas catatan, bukan data).
      if (spec.table === "vault_items") return { table: spec.table, label: spec.label, rows: [] as ExportRow[] };
      const { data, error } = await supabase.from(spec.table).select("*").eq("user_id", user.id).order(spec.sortKey, { ascending: false }).limit(50_000);
      return { table: spec.table, label: spec.label, rows: error ? [] : ((data ?? []) as ExportRow[]) };
    }),
  );

  const exportedAt = new Date().toISOString();
  const files = buildExportFiles(results, exportedAt);
  const zip = buildZip(files.map((f) => ({ name: f.name, content: f.content })));
  const stamp = exportedAt.slice(0, 10);
  return new NextResponse(zip as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="licia-open-${stamp}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
