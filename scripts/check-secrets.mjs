import fs from "node:fs";
import process from "node:process";

const trackedCandidates = [
  ".env", ".env.local", ".env.production", ".env.development", ".env.test",
  ".env.production.local", ".env.development.local", ".env.test.local",
];
const secretNames = [
  "OPENAI_API_KEY", "SUPABASE_SERVICE_ROLE_KEY", "VAPID_PRIVATE_KEY", "LICIA_CRON_SECRET",
  "SENTRY_DSN", "GOOGLE_CLIENT_SECRET", "TELEGRAM_BOT_TOKEN", "WHATSAPP_ACCESS_TOKEN",
];
const violations = [];
for (const file of trackedCandidates) {
  if (fs.existsSync(file)) violations.push(file + " exists in the working tree; environment files must not be committed.");
}
const sourceRoots = ["app", "components", "lib", "scripts", "native", "config", "deploy"];
const suspicious = /(sk-[A-Za-z0-9_-]{16,}|xox[baprs]-[A-Za-z0-9-]+|-----BEGIN (?:RSA|EC|OPENSSH|PRIVATE) KEY-----)/;
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git"].includes(entry.name)) continue;
    const full = dir + "/" + entry.name;
    if (entry.isDirectory()) walk(full);
    else if (/\.(?:ts|tsx|js|mjs|cjs|json|yml|yaml|md|sql|properties)$/.test(entry.name)) {
      const body = fs.readFileSync(full, "utf8");
      if (suspicious.test(body) && !/placeholder|example|YOUR_/i.test(body)) violations.push(full + " contains a credential-like token.");
      for (const name of secretNames) {
        const re = new RegExp(name + "\\s*[:=]\\s*[\\\"']([^\\\"']{12,})", "i");
        const match = body.match(re);
        if (match && !/YOUR_|PLACEHOLDER|ci-placeholder/i.test(match[1])) violations.push(full + " appears to contain a value for " + name + ".");
      }
    }
  }
}
for (const root of sourceRoots) walk(root);
if (violations.length) {
  console.error("Secret hygiene FAILED");
  for (const item of violations) console.error("- " + item);
  process.exit(1);
}
console.log("Secret hygiene OK");
