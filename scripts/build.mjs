import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const env = { ...process.env };
const versionPath = path.resolve(process.cwd(), "config/licia-version.json");
const publicVersionPath = path.resolve(process.cwd(), "public/version.json");
if (fs.existsSync(versionPath)) fs.copyFileSync(versionPath, publicVersionPath);
if (!env.NODE_OPTIONS) env.NODE_OPTIONS = "--max-old-space-size=1024";
const nextEntry = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));

// Licia production builds use the webpack backend explicitly.
// Next 16's Turbopack build path can fail on some Windows/Node setups
// with the low-level "The destination stream closed early" error before
// the actual application compilation starts. Webpack avoids that stream
// failure while keeping the application source unchanged.
const result = spawnSync(
  process.execPath,
  [nextEntry, "build", "--webpack"],
  { stdio: "inherit", env }
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
