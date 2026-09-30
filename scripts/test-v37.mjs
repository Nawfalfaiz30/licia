import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

// Static regression tests deliberately avoid requiring a dependency install.
// They protect the architecture changes that are easy to regress during future merges.
const temporal = read("lib/v36/temporal.ts");
assert.match(temporal, /tanggal 26 berikutnya|weekdayMatch/);
assert.match(read("lib/ai/modelRouter.ts"), /jadwalkan|hapus|ubah|buatkan/);
assert.match(read("app/api/chat/route.ts"), /aiContextMode === "all"/);
assert.match(read("app/api/chat/route.ts"), /deniedDomains/);
assert.match(read("app/api/chat/route.ts"), /privacyBroadTools/);
assert.match(read("app/api/chat/route.ts"), /MAX_MUTATION_TOOL_ITERATIONS/);
assert.match(read("app/api/chat/route.ts"), /deniedToolNames/);
assert.match(read("app/(app)/plan/page.tsx"), /completed_at/);
assert.match(read("components/plan/PlanWorkspace.tsx"), /mutateEntity/);
assert.match(read("supabase/schema_v37_unified_workspaces.sql"), /alter table public\.schedule_blocks/);

const nav = read("components/layout/nav-items.ts");
for (const expected of ["/dashboard", "/plan", "/chat", "/capture", "/insights"]) assert.ok(nav.includes(`item("${expected}"`), `missing ${expected}`);

const settings = read("app/(app)/settings/page.tsx");
assert.match(settings, /fontPresets/);
assert.match(settings, /aiDomainPermissions/);
assert.match(settings, /Simpan perubahan/);
assert.ok(!settings.includes("Prioritas tugas baru"), "productivity controls must stay removed");
assert.ok(!settings.includes("Durasi fokus bawaan"), "productivity controls must stay removed");
assert.ok(!settings.includes("Reminder bawaan"), "productivity controls must stay removed");
assert.ok(!settings.includes("Next Move di Beranda"), "productivity controls must stay removed");

console.log("V37 regression tests passed.");
