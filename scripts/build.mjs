import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const env = { ...process.env };
if (!env.NODE_OPTIONS) env.NODE_OPTIONS = "--max-old-space-size=1024";
const nextEntry = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const result = spawnSync(process.execPath, [nextEntry, "build"], { stdio: "inherit", env });
if (result.error) { console.error(result.error); process.exit(1); }
process.exit(result.status ?? 1);
