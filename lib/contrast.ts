/**
 * Utilitas kontras WCAG 2.x (v0.57) untuk audit dan penurunan warna aksen yang aman dibaca.
 * Murni (tanpa DOM) agar bisa dipakai di tes, skrip audit, dan runtime.
 */

export type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const h = m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex([r, g, b]: Rgb): string {
  const part = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(rgb: Rgb): number {
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

export function contrastRatio(a: string, b: string): number {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return 1;
  const la = luminance(ra);
  const lb = luminance(rb);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Campur `fg` di atas `bg` dengan opasitas `alpha` (0–1), seperti `bg-accent/10` di atas permukaan. */
export function blend(fg: string, bg: string, alpha: number): string {
  const f = hexToRgb(fg);
  const b = hexToRgb(bg);
  if (!f || !b) return bg;
  return rgbToHex([0, 1, 2].map((i) => f[i] * alpha + b[i] * (1 - alpha)) as Rgb);
}

export const AA_NORMAL = 4.5;
export const AA_LARGE = 3;
export const meetsAA = (ratio: number, large = false) => ratio >= (large ? AA_LARGE : AA_NORMAL);

/**
 * Menggeser warna ke arah gelap/terang sedikit demi sedikit sampai kontrasnya terhadap SEMUA latar
 * mencapai `min`. Mempertahankan rona; hanya kecerahannya yang berubah.
 */
export function adjustToContrast(hex: string, against: readonly string[], min: number, direction: "darken" | "lighten"): string {
  const start = hexToRgb(hex);
  if (!start) return hex;
  const target: Rgb = direction === "darken" ? [0, 0, 0] : [255, 255, 255];
  for (let step = 0; step <= 100; step += 1) {
    const t = step / 100;
    const candidate = rgbToHex([0, 1, 2].map((i) => start[i] * (1 - t) + target[i] * t) as Rgb);
    if (against.every((bg) => contrastRatio(candidate, bg) >= min)) return candidate;
  }
  return rgbToHex(target);
}

export const LIGHT_SURFACES = ["#ffffff", "#eef1f7", "#f5f3ee", "#eef3ee", "#f6f0e8"] as const;
export const DARK_SURFACES = ["#0f1220", "#111318", "#0e1512", "#16120e", "#171b2e", "#1d2238"] as const;

export type RoleTokens = {
  /** Warna isian (tombol/lencana) — teks putih di atasnya harus terbaca. */
  fill: string;
  /** Warna untuk teks/ikon di atas latar mode ini. */
  ink: string;
};

/**
 * Menurunkan token aman-kontras dari satu warna dasar:
 *  - fill: kontras ≥ 4,5 terhadap putih (untuk `bg-accent text-white`).
 *  - ink: kontras ≥ 4,5 terhadap SEMUA latar mode terkait, juga pada latar yang diberi semburat 12 % warna itu
 *    (`bg-accent/10`), supaya teks aksen di atas lencana transparan tetap terbaca.
 */
export function deriveRoleTokens(hex: string, mode: "light" | "dark"): RoleTokens {
  const fill = adjustToContrast(hex, ["#ffffff"], AA_NORMAL, "darken");
  const surfaces = mode === "light" ? LIGHT_SURFACES : DARK_SURFACES;
  const direction = mode === "light" ? "darken" : "lighten";
  // Iterasi: warna ink memengaruhi semburatnya sendiri, jadi hitung ulang sampai stabil.
  let ink = hex;
  for (let i = 0; i < 4; i += 1) {
    const tinted = surfaces.flatMap((s) => [s, blend(ink, s, 0.12)]);
    const next = adjustToContrast(hex, tinted, AA_NORMAL, direction);
    if (next === ink) break;
    ink = next;
  }
  return { fill: mode === "dark" ? deriveDarkFill(hex, fill) : fill, ink };
}

/** Di mode gelap, isian tidak perlu lebih gelap dari yang dibutuhkan agar putih terbaca. */
function deriveDarkFill(_hex: string, fill: string): string {
  return fill;
}

export const rgbTriple = (hex: string): string => {
  const rgb = hexToRgb(hex);
  return rgb ? `${rgb[0]} ${rgb[1]} ${rgb[2]}` : "0 0 0";
};

export type AccentTokens = {
  lightFill: string; lightInk: string; darkFill: string; darkInk: string;
};

export function deriveAccentTokens(hex: string): AccentTokens {
  const light = deriveRoleTokens(hex, "light");
  const dark = deriveRoleTokens(hex, "dark");
  return { lightFill: light.fill, lightInk: light.ink, darkFill: dark.fill, darkInk: dark.ink };
}
