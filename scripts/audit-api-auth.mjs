import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const apiRoot = path.join(root, "app", "api");
const routeFiles = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (entry.name === "route.ts") routeFiles.push(absolute);
  }
}

walk(apiRoot);

const publicOrTokenAuthenticated = new Map([
  [
    "healthz/route.ts",
    {
      required: ['error: "healthcheck_failed"', 'app: "licia"'],
      forbidden: ["featureErrors", "SUPABASE_SERVICE_ROLE_KEY", "OPENAI_API_KEY", "LICIA_CRON_SECRET"],
    },
  ],
  [
    "inbound/capture/route.ts",
    { required: ["tokenFrom(req)", 'eq("token_hash", tokenHash)', "expires_at", "distributedExternalRateLimit"] },
  ],
  [
    "automations/webhook/[secret]/route.ts",
    {
      required: [
        "const secretHash = sha256Hex(secret)",
        'eq("secret_hash", secretHash)',
        "distributedExternalRateLimit",
      ],
    },
  ],
  [
    "reminders/dispatch/route.ts",
    { required: ["cronAuthorized(req)", "sessionSupabase.auth.getUser()", "timingSafeEqual"] },
  ],
  ["chat/route.ts", { required: ["chatOrchestrator", "chatPost"] }],
]);

const failures = [];
for (const absolute of routeFiles) {
  const relative = path.relative(apiRoot, absolute).replaceAll(path.sep, "/");
  const source = fs.readFileSync(absolute, "utf8");
  const exception = publicOrTokenAuthenticated.get(relative);
  if (exception) {
    for (const token of exception.required) {
      if (!source.includes(token)) failures.push(`${relative}: expected auth guard marker missing: ${token}`);
    }
    for (const token of exception.forbidden || []) {
      if (source.includes(token)) failures.push(`${relative}: public response must not expose ${token}`);
    }
    if (relative === "chat/route.ts") {
      const orchestrator = fs.readFileSync(path.join(root, "lib", "ai", "chatOrchestrator.ts"), "utf8");
      if (!orchestrator.includes("supabase.auth.getUser()"))
        failures.push("chat route delegates without an authenticated orchestrator");
    }
    continue;
  }
  if (!/\.auth\.(?:getUser|getClaims)\s*\(/.test(source))
    failures.push(`${relative}: missing request authentication or reviewed public/token auth exception`);
}

if (failures.length) {
  console.error(`API authentication audit FAILED (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`API authentication audit OK — ${routeFiles.length} route handlers checked.`);
