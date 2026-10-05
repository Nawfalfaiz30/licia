/** Menambahkan `kind` stabil pada hasil pencarian dan menerjemahkan label bila bahasa English (v0.57). */

export type SearchLang = "id" | "en";

const KIND_BY_TYPE: Record<string, string> = {
  Tugas: "task",
  Proyek: "project",
  Target: "goal",
  Catatan: "note",
  Inbox: "inbox",
  Bacaan: "reading",
  Langganan: "subscription",
  Keputusan: "decision",
  Pembelajaran: "learning",
  Area: "area",
  Memori: "memory",
  Vault: "vault",
  Otomatisasi: "automation",
  Kalender: "event",
};

const EN_TYPE: Record<string, string> = {
  task: "Task",
  project: "Project",
  goal: "Goal",
  note: "Note",
  inbox: "Inbox",
  reading: "Reading",
  subscription: "Subscription",
  decision: "Decision",
  learning: "Learning",
  area: "Area",
  memory: "Memory",
  vault: "Vault",
  automation: "Automation",
  event: "Calendar",
};

const EN_DETAIL: Record<string, string> = {
  Selesai: "Done",
  "Belum dipilah": "Not triaged",
  Diproses: "Processed",
  "Sudah ditinjau": "Reviewed",
  "Perlu ditinjau": "Needs review",
  Aktif: "Active",
  Nonaktif: "Inactive",
  Mati: "Off",
  "Tanpa tenggat": "No due date",
  "Tanpa judul": "Untitled",
};

export function localizeSearchResults(results: Array<Record<string, unknown>>, lang: SearchLang): Array<Record<string, unknown>> {
  return results.map((row) => {
    const type = String(row.type ?? "");
    const kind = KIND_BY_TYPE[type] ?? "other";
    if (lang === "id") return { ...row, kind };
    const detail = typeof row.detail === "string" ? EN_DETAIL[row.detail] ?? row.detail.replace(/^Level /, "Level ") : row.detail;
    const title = typeof row.title === "string" ? EN_DETAIL[row.title] ?? row.title : row.title;
    return { ...row, kind, type: EN_TYPE[kind] ?? type, detail, title };
  });
}
