#!/usr/bin/env node
/**
 * Audit RLS statis (E1): setiap tabel `public.*` yang dibuat di supabase/*.sql wajib punya
 *   (a) `alter table ... enable row level security`, dan
 *   (b) minimal satu `create policy ... on public.<tabel>`.
 * Gagal (exit 1) bila ada yang kurang, sehingga satu tabel baru tanpa kebijakan tidak lolos CI.
 *
 * Untuk memeriksa database yang sedang berjalan, jalankan supabase/audit_rls.sql di SQL Editor.
 * Pengecualian disengaja: tambahkan nama tabel ke ALLOWLIST di bawah beserta alasannya.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "supabase");

/** Tabel yang sengaja tanpa RLS publik (mis. hanya diakses lewat service role). Tulis alasannya. */
const ALLOWLIST = new Map([
  ["system_health_heartbeats", "Hanya service role (heartbeat worker); RLS aktif tanpa kebijakan = tolak semua klien, disengaja (lihat comment on table di schema_all_v30.sql)."],
]);

export function auditSql(sources) {
  const created = new Set();
  const rls = new Set();
  const policies = new Set();
  const strip = (sql) => sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const raw of sources) {
    const sql = strip(raw);
    for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?/gi)) created.add(m[1].toLowerCase());
    for (const m of sql.matchAll(/alter\s+table\s+(?:only\s+)?(?:if\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?\s+enable\s+row\s+level\s+security/gi)) rls.add(m[1].toLowerCase());
    for (const m of sql.matchAll(/create\s+policy\s+(?:"[^"]+"|[a-z0-9_]+)\s+on\s+(?:public\.)?"?([a-z0-9_]+)"?/gi)) policies.add(m[1].toLowerCase());
  }
  const problems = [];
  for (const table of [...created].sort()) {
    if (ALLOWLIST.has(table)) continue;
    const missing = [];
    if (!rls.has(table)) missing.push("RLS belum diaktifkan");
    if (!policies.has(table)) missing.push("tidak ada kebijakan");
    if (missing.length) problems.push({ table, missing });
  }
  return { tables: created.size, problems };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql") && f !== "audit_rls.sql").sort();
  const { tables, problems } = auditSql(files.map((f) => readFileSync(path.join(dir, f), "utf8")));
  console.log(`Audit RLS: ${tables} tabel dari ${files.length} berkas SQL.`);
  if (problems.length) {
    for (const p of problems) console.error(`  ✗ public.${p.table}: ${p.missing.join(", ")}`);
    console.error(`\n${problems.length} tabel bermasalah. Aktifkan RLS dan tambahkan kebijakan pemilik (auth.uid() = user_id).`);
    process.exit(1);
  }
  console.log("  ✓ Semua tabel punya RLS dan kebijakan.");
}
