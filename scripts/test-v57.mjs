#!/usr/bin/env node
// Licia v0.57.0 — pemeriksaan regresi tingkat-sumber untuk upgrade Kategori A (UI/UX + dwibahasa penuh).
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const failures = [];
const check = (name, ok, hint = "") => { if (!ok) failures.push(`${name}${hint ? " — " + hint : ""}`); };

function walk(dir, out = []) {
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) { if (!["node_modules", ".next", "native"].includes(e.name)) walk(rel, out); }
    else if (/\.(tsx?|css)$/.test(e.name)) out.push(rel);
  }
  return out;
}
const sources = [...walk("app"), ...walk("components"), ...walk("lib")];

// A4 — satu Overlay + token z-index
for (const f of ["components/ui/dialog.tsx", "components/v35/BottomSheet.tsx", "components/layout/MoreSheet.tsx", "components/layout/MobileAccountAction.tsx", "components/GlobalQuickCapture.tsx", "components/v35/CommandCenter.tsx", "components/layout/KeyboardShortcuts.tsx", "components/dashboard/DashboardCustomizer.tsx"]) {
  check(`A4: ${f} memakai <Overlay>`, /<Overlay\b/.test(read(f)));
}
const arbitraryZ = sources.filter((f) => !f.endsWith(".css")).filter((f) => /\bz-\[\d+\]/.test(read(f)));
check("A4: tidak ada z-[N] sembarang di komponen/halaman", arbitraryZ.length === 0, arbitraryZ.join(", "));
check("A4: tailwind memuat token z-index", /zIndex:\s*zIndexTheme/.test(read("tailwind.config.ts")));
const rawZCss = (read("app/globals.css").match(/z-index:\s*(?!var\()\d+/g) || []).filter((m) => !/z-index:\s*(0|1|2|3|4|5|6|7|8|9|10|20|30|40|50)\b/.test(m));
check("A4: globals.css tanpa z-index aplikasi bernilai tetap besar", rawZCss.length === 0, rawZCss.join(", "));

// A3 — perangkap fokus & pengembalian fokus
const overlay = read("components/ui/Overlay.tsx");
check("A3: Overlay punya perangkap fokus", /resolveTabTarget/.test(overlay));
check("A3: Overlay mengembalikan fokus ke pemicu", /returnTarget/.test(overlay) && /requestAnimationFrame/.test(overlay));
check("A3: Overlay mengunci scroll dan men-inert latar", /lockScroll\(\)/.test(overlay) && /lockBackground\(\)/.test(overlay));
check("A3: latar aplikasi bertanda id=licia-app", /id="licia-app"/.test(read("app/(app)/layout.tsx")));

// A5 — ukuran teks
const tiny = sources.filter((f) => !f.endsWith(".css")).filter((f) => /text-\[(8|9|10)px\]/.test(read(f)));
check("A5: tidak ada text-[8..10px]", tiny.length === 0, tiny.join(", "));
check("A5: font-size < 11px tidak ada di CSS", !/font-size:\s*(8|9|10)(\.\d+)?px/.test(read("app/globals.css")));
check("A5: skala teks 4 tingkat", /data-text-scale="xlarge"/.test(read("app/globals.css")));

// A6 — Urungkan
check("A6: toast mendukung aksi + Ctrl/Cmd+Z", /action\??:\s*ToastAction/.test(read("components/ui/toast.tsx")) && /key\.toLowerCase\(\) !== "z"/.test(read("components/ui/toast.tsx")));
const tasks = read("app/(app)/tasks/page.tsx");
check("A6: Tugas memakai toastWithUndo dan deferDestructive", /toastWithUndo\(/.test(tasks) && /deferDestructive\(/.test(tasks));

// A9 / A12 — tampilan tugas & pintasan
check("A9: Tugas merender Kanban, Matriks, Pekan", /<TaskKanban/.test(tasks) && /<TaskMatrix/.test(tasks) && /<TaskWeek/.test(tasks));
check("A9: kartu seret punya alternatif non-seret (select)", /Pindahkan ke…/.test(read("components/tasks/TaskViews.tsx")) && /<select/.test(read("components/tasks/TaskViews.tsx")));
check("A12: Tugas memakai taskKeyAction/stepFocus", /taskKeyAction\(/.test(tasks) && /stepFocus\(/.test(tasks));

// A1 — chip cerdas di Inbox/Catatan/Kalender
for (const f of ["app/(app)/inbox/page.tsx", "app/(app)/notes/page.tsx", "app/(app)/calendar/page.tsx"]) check(`A1: ${f} memakai SmartCaptureHint`, /<SmartCaptureHint/.test(read(f)));
check("A1: MoneyAction ada", /Catat sebagai pengeluaran/.test(read("components/ui/MoneyAction.tsx")));

// A2 — palet aksi
const palette = read("components/v35/CommandCenter.tsx");
check("A2: palet mendukung perintah, buat tugas, dan pencarian lintas modul", /composePalette/.test(palette) && /createTaskFromText/.test(palette) && /\/api\/search/.test(palette));
check("A2: QuickSearch lama digantikan palet", !fs.existsSync(path.join(root, "components/layout/QuickSearch.tsx")));

// A7 — onboarding & empty state
check("A7: Beranda memuat OnboardingChecklist", /<OnboardingChecklist/.test(read("app/(app)/dashboard/page.tsx")));
const empties = sources.filter((f) => f.endsWith(".tsx")).filter((f) => /<EmptyState\b[^>]*\bexamples=/.test(read(f)));
check("A7: minimal 4 halaman memakai EmptyState bercontoh", empties.length >= 4, String(empties.length));

// A8 — dashboard bisa diatur
const dash = read("app/(app)/dashboard/page.tsx");
check("A8: sembilan widget dashboard terbungkus", (dash.match(/<DashboardWidget id="/g) || []).length === 9);
check("A8: tombol Atur beranda tersedia", /<DashboardCustomizer/.test(dash));

// A10 — kontras
check("A10: token tinta aksen terpisah dari isian", /--accent-ink-rgb/.test(read("app/globals.css")) && /deriveAccentTokens/.test(read("lib/theme.ts")));

// A11 — dwibahasa penuh
const i18n = spawnSync(process.execPath, ["scripts/i18n.mjs", "check"], { cwd: root, encoding: "utf8" });
check("A11: kamus Inggris lengkap (scripts/i18n.mjs check)", i18n.status === 0, (i18n.stderr || "").split("\n").slice(0, 4).join(" | "));
check("A11: <html lang> mengikuti cookie bahasa", /getServerLanguage/.test(read("app/layout.tsx")));
check("A11: AI mengikuti bahasa", /languageDirective/.test(read("app/api/chat/route.ts")));
const hardLocale = sources.filter((f) => f.endsWith(".tsx")).filter((f) => /["']id-ID["']/.test(read(f)) && !/LanguageProvider|tasks\/page/.test(f));
check("A11: tidak ada locale id-ID tertanam di komponen", hardLocale.length === 0, hardLocale.join(", "));

// versi
check("versi package.json = 0.57.0", JSON.parse(read("package.json")).version === "0.57.0");

if (failures.length) {
  console.error(`✗ Licia v0.57 — ${failures.length} pemeriksaan gagal:`);
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("Licia v0.57.0 UI/UX + bilingual regression checks OK");
