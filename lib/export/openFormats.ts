/** Ekspor format terbuka (v0.57): CSV (Excel) dan Markdown (Obsidian) per modul — murni, tanpa jaringan. */

export type ExportRow = Record<string, unknown>;

/** Kolom internal yang tidak berguna bagi pembaca manusia. */
const HIDDEN_COLUMNS = new Set(["user_id", "version", "deleted_at"]);

/** Kolom yang nilainya tidak boleh keluar dari ekspor teks polos (konten Vault terenkripsi dsb.). */
const SENSITIVE_TABLES = new Set(["vault_items"]);

export function slugify(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "data"
  );
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Mencegah injeksi rumus Excel/Sheets: sel yang diawali = + - @ diberi apostrof. */
export function neutralizeFormula(text: string): string {
  return /^[=+\-@\t\r]/.test(text) && !/^-?\d+([.,]\d+)?$/.test(text) ? `'${text}` : text;
}

function csvEscape(text: string): string {
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function visibleColumns(rows: ExportRow[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) for (const key of Object.keys(row)) if (!HIDDEN_COLUMNS.has(key)) seen.add(key);
  // id di depan, sisanya mengikuti urutan kemunculan.
  const cols = [...seen];
  return cols.includes("id") ? ["id", ...cols.filter((c) => c !== "id")] : cols;
}

/** CSV dengan BOM UTF-8 agar Excel membuka karakter Indonesia dengan benar; baris diakhiri CRLF. */
export function toCsv(rows: ExportRow[]): string {
  const cols = visibleColumns(rows);
  if (!cols.length) return "\uFEFF";
  const lines = [cols.map(csvEscape).join(",")];
  for (const row of rows) lines.push(cols.map((c) => csvEscape(neutralizeFormula(cellText(row[c])))).join(","));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function yamlValue(text: string): string {
  return /^[\w .\-/:+@]*$/.test(text) && text.trim() === text && text !== "" ? text : JSON.stringify(text);
}

/**
 * Markdown satu berkas per modul: front matter YAML (properti Obsidian) lalu satu bagian per baris.
 * Judul memakai kolom title/name/content bila ada.
 */
export function toMarkdown(label: string, table: string, rows: ExportRow[], exportedAt: string): string {
  const titleKeys = ["title", "name", "memory_key", "content", "note"];
  const out: string[] = ["---", `modul: ${yamlValue(label)}`, `tabel: ${table}`, `diekspor: ${exportedAt}`, `jumlah: ${rows.length}`, "tags: [licia]", "---", "", `# ${label}`, ""];
  if (SENSITIVE_TABLES.has(table)) {
    out.push("> Isi modul ini terenkripsi di sisi klien dan sengaja tidak diekspor sebagai teks polos. Gunakan cadangan JSON dari Pusat Sistem.", "");
    return out.join("\n");
  }
  if (!rows.length) return `${out.join("\n")}_Belum ada data._\n`;
  const cols = visibleColumns(rows);
  rows.forEach((row, index) => {
    const titleKey = titleKeys.find((k) => typeof row[k] === "string" && String(row[k]).trim());
    const raw = titleKey ? String(row[titleKey]).replace(/\s+/g, " ").trim() : `${label} ${index + 1}`;
    const heading = raw.length > 80 ? `${raw.slice(0, 77)}…` : raw;
    out.push(`## ${heading.replace(/^#+\s*/, "")}`, "");
    for (const col of cols) {
      const text = cellText(row[col]);
      if (!text || (titleKey === col && text.replace(/\s+/g, " ").trim() === raw)) continue;
      if (text.includes("\n")) out.push(`- **${col}:**`, "", ...text.split("\n").map((l) => `  > ${l}`), "");
      else out.push(`- **${col}:** ${text}`);
    }
    out.push("");
  });
  return `${out.join("\n")}\n`;
}

export type ExportTable = { table: string; label: string; rows: ExportRow[] };

export function buildExportFiles(tables: ExportTable[], exportedAt: string): Array<{ name: string; content: string }> {
  const files: Array<{ name: string; content: string }> = [];
  const used = new Set<string>();
  for (const t of tables) {
    if (!t.rows.length && !SENSITIVE_TABLES.has(t.table)) continue;
    let base = slugify(t.label);
    if (used.has(base)) base = `${base}-${t.table}`;
    used.add(base);
    files.push({ name: `markdown/${base}.md`, content: toMarkdown(t.label, t.table, t.rows, exportedAt) });
    if (!SENSITIVE_TABLES.has(t.table)) files.push({ name: `csv/${base}.csv`, content: toCsv(t.rows) });
  }
  const total = tables.reduce((s, t) => s + t.rows.length, 0);
  files.unshift({
    name: "BACA-SAYA.md",
    content: `# Arsip Licia\n\nDiekspor: ${exportedAt}\nTotal baris: ${total}\n\n- \`markdown/\` — satu berkas per modul, kompatibel Obsidian (front matter YAML).\n- \`csv/\` — satu berkas per modul, UTF-8 dengan BOM, dapat dibuka langsung di Excel/Sheets.\n\nIsi Vault terenkripsi dan tidak disertakan sebagai teks polos.\n`,
  });
  return files;
}
