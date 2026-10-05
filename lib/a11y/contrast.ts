/** Fungsi kontras WCAG 2.x murni (tanpa DOM) — dipakai tema runtime dan skrip audit `npm run a11y:contrast`. */
export type RGB = readonly [number, number, number];

export function parseHex(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const toHex = (rgb: RGB) => "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

function channel(v: number) { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
export function luminance(rgb: RGB) { return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]); }
export function contrastRatio(a: RGB, b: RGB) {
  const la = luminance(a), lb = luminance(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export const WHITE: RGB = [255, 255, 255];
export const INK: RGB = [11, 14, 26];
/** Target aksen sebagai teks. 4.5 = AA; margin ekstra karena sering dipakai di atas tint `bg-accent/10`. */
export const ACCENT_TEXT_TARGET = 5;

/**
 * Menyesuaikan aksen pilihan pengguna supaya terbaca: digelapkan (mode terang) / dicerahkan (mode gelap)
 * sampai kontras terhadap latar ≥ target, lalu memilih warna teks di atas aksen (putih atau tinta) yang lolos AA.
 */
export function accessibleAccent(hex: string, backgrounds: readonly RGB[], dark: boolean) {
  const base = parseHex(hex);
  if (!base) return null;
  const pole: RGB = dark ? WHITE : [0, 0, 0];
  let accent: RGB = base;
  const worst = (c: RGB) => Math.min(...backgrounds.map((bg) => contrastRatio(c, bg)));
  for (let step = 0; step <= 25 && worst(accent) < ACCENT_TEXT_TARGET; step++) accent = mix(base, pole, (step + 1) * 0.04);
  const onAccent = contrastRatio(WHITE, accent) >= contrastRatio(INK, accent) ? WHITE : INK;
  return { accent, onAccent, textContrast: worst(accent), buttonContrast: contrastRatio(onAccent, accent) };
}
