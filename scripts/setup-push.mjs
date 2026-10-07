import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const root = process.cwd();
const envPath = path.join(root, ".env.local");
const examplePath = path.join(root, ".env.local.example");

function parse(text) {
  const map = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    map.set(m[1], m[2]);
  }
  return map;
}

async function main() {
  let source = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, "utf8")
    : fs.existsSync(examplePath)
      ? fs.readFileSync(examplePath, "utf8")
      : "";
  const values = parse(source);
  let webpush;
  try {
    webpush = (await import("web-push")).default ?? (await import("web-push"));
  } catch {
    console.error("web-push belum terpasang. Jalankan: npm install");
    process.exit(1);
  }

  if (!values.get("VAPID_PUBLIC_KEY") || !values.get("VAPID_PRIVATE_KEY")) {
    const keys = webpush.generateVAPIDKeys();
    source = `${source.trimEnd()}\nVAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\n`;
  }
  if (!values.get("VAPID_SUBJECT")) source = `${source.trimEnd()}\nVAPID_SUBJECT=mailto:admin@example.com\n`;
  if (!values.get("LICIA_CRON_SECRET"))
    source = `${source.trimEnd()}\nLICIA_CRON_SECRET=${crypto.randomBytes(32).toString("base64url")}\n`;
  fs.writeFileSync(envPath, source.replace(/\n{3,}/g, "\n\n"));
  console.log("Licia push setup selesai. VAPID + LICIA_CRON_SECRET sudah dibuat/ditambahkan ke .env.local.");
  console.log("Pastikan SUPABASE_SERVICE_ROLE_KEY juga sudah diisi dari Supabase Dashboard > API / service_role.");
}

await main();
