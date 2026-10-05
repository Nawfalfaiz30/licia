// Pemuat ESM kecil: memetakan "@/..." ke akar proyek dan mencoba ekstensi .ts/.tsx/index.ts.
// Dipakai untuk menjalankan modul TypeScript murni langsung di Node 22 tanpa bundler:
//   node --import ./scripts/alias-register.mjs --experimental-strip-types skrip.mjs
import { pathToFileURL, fileURLToPath } from "node:url";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exts = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const base = path.join(root, specifier.slice(2));
    for (const ext of exts) {
      const candidate = base + ext;
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
  }
  return nextResolve(specifier, context);
}
