import fs from "node:fs";
import path from "node:path";
import process from "node:process";

// Next.js automatically loads .env files for the app itself, but this custom
// Node preflight script does not. Load the same common env files here so
// `npm run preflight` and the `prebuild` lifecycle see the same configuration
// that Next.js will see at runtime. Existing shell/PM2 environment variables
// always win over values from files.
function parseEnvValue(raw) {
  let value = raw.trim();
  if (!value) return "";
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return value.replace(/\\n/g, "\n");
}

function loadEnvFiles(forcedNodeEnv) {
  const nodeEnv = forcedNodeEnv || process.env.NODE_ENV || "development";
  const files = [
    ".env",
    `.env.${nodeEnv}`,
    ".env.local",
    `.env.${nodeEnv}.local`,
  ];
  const loaded = [];

  for (const relative of files) {
    const file = path.resolve(process.cwd(), relative);
    if (!fs.existsSync(file)) continue;
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] === undefined) process.env[key] = parseEnvValue(rawValue);
    }
    loaded.push(relative);
  }

  return loaded;
}

const isProd = process.env.NODE_ENV === "production" || process.argv.includes("--production");
const loadedEnvFiles = loadEnvFiles(isProd ? "production" : undefined);
const errors = [];
const warnings = [];

const major = Number(process.versions.node.split(".")[0]);
if (major !== 22) {
  errors.push(`Node.js 22 LTS diperlukan (terdeteksi ${process.versions.node}).`);
}

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "OPENAI_API_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "APP_URL",
];

for (const key of required) {
  if (!process.env[key]?.trim()) errors.push(`${key} belum diisi.`);
}

function parseOrigin(name) {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!/^https?:$/.test(url.protocol)) throw new Error("protocol");
    if (url.pathname !== "/" || url.search || url.hash) throw new Error("path");
    return url;
  } catch {
    errors.push(`${name} harus berupa origin lengkap tanpa path, contoh https://licia.example.com.`);
    return null;
  }
}

const site = parseOrigin("NEXT_PUBLIC_SITE_URL");
const app = parseOrigin("APP_URL");
if (site && app && site.origin !== app.origin) {
  errors.push("NEXT_PUBLIC_SITE_URL dan APP_URL harus menunjuk origin yang sama.");
}
if (isProd) {
  const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  for (const [name, parsed] of [["NEXT_PUBLIC_SITE_URL", site], ["APP_URL", app]]) {
    if (parsed && loopbackHosts.has(parsed.hostname.toLowerCase())) {
      errors.push(`${name} tidak boleh menunjuk ke localhost/loopback pada production.`);
    }
  }

  // Domain + HTTPS is recommended, but Licia also supports IP-only VPS
  // deployments where the public origin is plain HTTP (e.g. http://203.0.113.10).
  // HTTPS is not required here because the deployment target may intentionally
  // have no domain/certificate. The exact origin is still validated and must
  // match between NEXT_PUBLIC_SITE_URL and APP_URL.
  if (site?.protocol === "http:" || app?.protocol === "http:") {
    warnings.push("Production menggunakan HTTP. Ini cocok untuk deployment IP-only, tetapi koneksi, PWA/service worker, dan browser notification tidak mendapat jaminan HTTPS.");
  }
  if (process.env.DEV_TUNNEL_ORIGIN?.trim()) errors.push("DEV_TUNNEL_ORIGIN harus kosong di production.");
}

if (isProd && fs.existsSync("package.json")) {
  try { await import("web-push"); } catch { errors.push("Dependency web-push belum terpasang. Jalankan npm install setelah memperbarui source/package.json."); }
}

for (const file of ["ecosystem.config.cjs", "deploy/nginx-licia.conf", "supabase/schema_all.sql"]) {
  if (!fs.existsSync(file)) errors.push(`File deployment wajib tidak ditemukan: ${file}`);
}

if (!fs.existsSync("package-lock.json")) {
  warnings.push("package-lock.json belum tersedia. Buat/commit lockfile dari mesin yang memiliki akses npm registry lalu gunakan npm ci untuk deployment reproducible.");
}

if (errors.length) {
  console.error("Licia preflight FAILED");
  for (const error of errors) console.error(`- ${error}`);
  if (warnings.length) {
    console.warn("Warnings:");
    for (const warning of warnings) console.warn(`- ${warning}`);
  }
  process.exit(1);
}

console.log(`Licia preflight OK — Node ${process.versions.node}${isProd ? " / production" : " / development"}`);
if (loadedEnvFiles.length) console.log(`Environment loaded from: ${loadedEnvFiles.join(", ")}`);
for (const warning of warnings) console.warn(`Warning: ${warning}`);
