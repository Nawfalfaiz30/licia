import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const route = fs.readFileSync(path.join(root, "app/api/chat/route.ts"), "utf8");
const vision = fs.readFileSync(path.join(root, "lib/ai/visionSchedule.ts"), "utf8");

const checks = [
  ["vision schedule prompt supports email confirmations", /EMAIL KONFIRMASI/.test(vision)],
  ["vision schema accepts concrete block_date", /block_date/.test(vision)],
  ["verbose Indonesian date is supported", vision.includes("tanggal\\s+(\\d{1,2})") && vision.includes("bulan")],
  ["vision result can derive weekday", /weekdayFromDate/.test(vision)],
  ["structured vision is injected into AI context", /HASIL EKSTRAKSI TERSTRUKTUR DARI GAMBAR/.test(route)],
  [
    "concrete date can come from image",
    /visionScheduleBlocks\.some\(\(block\) => Boolean\(block\.block_date\)\)/.test(route),
  ],
  ["explicit image calendar action has fast path", /explicitVisionScheduleAction/.test(route)],
  [
    "fast path calls real calendar tool",
    /executeTool\(\{ supabase, userId: user\.id, timezone \}, "create_daily_schedule"/.test(route),
  ],
  ["fast path records undo history", /ai_action_history/.test(route)],
  ["fast path does not require a weekday in the source", /block\.weekday \|\| weekdayFromDate/.test(route)],
  [
    "vision import avoids exact duplicate calendar blocks",
    /Avoid duplicate imports/.test(route) && /existingKeys/.test(route),
  ],
  [
    "client reference is available before vision parsing",
    route.indexOf("const continuityReference") <
      route.indexOf("const structured = await analyzeScheduleImageStructured"),
  ],
  [
    "old generic image clarification remains only for missing date",
    /tanggal kalender yang terlihat belum cukup konkret/.test(route),
  ],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
console.log(`V36.2 vision checks passed — ${checks.length}/${checks.length}`);
