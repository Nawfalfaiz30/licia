export function hexToRgbTriple(hex: string): string | null {
  const clean = hex.trim().replace(/^#/, "");
  const match = /^([0-9a-fA-F]{6})$/.exec(clean);
  if (!match) return null;

  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export const ACCENT_STORAGE_KEY = "licia-accent-hex";
export const BG_LIGHT_STORAGE_KEY = "licia-bg-light-hex";
export const BG_DARK_STORAGE_KEY = "licia-bg-dark-hex";
export const FONT_STORAGE_KEY = "licia-font";
// Legacy keys kept only for one-way migration from older builds.
export const FONT_DISPLAY_STORAGE_KEY = "licia-font-display";
export const FONT_BODY_STORAGE_KEY = "licia-font-body";

export const BG_DEFAULT_LIGHT = "#eef1f7";
export const BG_DEFAULT_DARK = "#0f1220";
export const FONT_DEFAULT = "--font-jakarta";

export const accentPresets = [
  { name: "Biru (default)", hex: "#3d5fd9" },
  { name: "Biru laut", hex: "#2b6cb0" },
  { name: "Indigo", hex: "#5b4fd9" },
  { name: "Teal", hex: "#0f9488" },
  { name: "Emas malam", hex: "#c99a3e" },
];

export const bgPresetsDark = [
  { name: "Plum malam (default)", hex: BG_DEFAULT_DARK },
  { name: "Abu gelap netral", hex: "#111318" },
  { name: "Hijau tua", hex: "#0e1512" },
  { name: "Coklat gelap", hex: "#16120e" },
];
export const bgPresetsLight = [
  { name: "Lavender lembut (default)", hex: BG_DEFAULT_LIGHT },
  { name: "Putih gading", hex: "#f5f3ee" },
  { name: "Hijau pastel", hex: "#eef3ee" },
  { name: "Krem hangat", hex: "#f6f0e8" },
];

export const fontPresets = [
  { name: "Plus Jakarta Sans", cssVar: "--font-jakarta", mood: "Rapi & modern" },
  { name: "Inter", cssVar: "--font-inter", mood: "Minimal & netral" },
  { name: "Nunito", cssVar: "--font-nunito", mood: "Ramah & lembut" },
  { name: "Poppins", cssVar: "--font-poppins", mood: "Geometris & tegas" },
  { name: "Fraunces", cssVar: "--font-fraunces", mood: "Editorial & hangat" },
  { name: "Playfair Display", cssVar: "--font-playfair", mood: "Elegan & klasik" },
];


export function applyAccent(hex: string) {
  const rgb = hexToRgbTriple(hex);
  if (!rgb) return false;
  document.documentElement.style.setProperty("--accent-rgb", rgb);
  localStorage.setItem(ACCENT_STORAGE_KEY, hex);
  return true;
}

export function resetAccent() {
  document.documentElement.style.removeProperty("--accent-rgb");
  localStorage.removeItem(ACCENT_STORAGE_KEY);
}

function isDarkMode() {
  return document.documentElement.classList.contains("dark");
}

export function applyBackground(hex: string) {
  const clean = hex.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(clean)) return false;
  document.documentElement.style.setProperty("--bg", clean);
  localStorage.setItem(isDarkMode() ? BG_DARK_STORAGE_KEY : BG_LIGHT_STORAGE_KEY, clean);
  return true;
}

export function resetBackground() {
  localStorage.removeItem(isDarkMode() ? BG_DARK_STORAGE_KEY : BG_LIGHT_STORAGE_KEY);
  applyBackgroundForCurrentMode();
}

export function applyBackgroundForCurrentMode() {
  const dark = isDarkMode();
  const stored = localStorage.getItem(dark ? BG_DARK_STORAGE_KEY : BG_LIGHT_STORAGE_KEY);
  const value = stored || (dark ? BG_DEFAULT_DARK : BG_DEFAULT_LIGHT);
  document.documentElement.style.setProperty("--bg", value);
}

export function applyFont(cssVar: string) {
  const safe = fontPresets.some((p) => p.cssVar === cssVar) ? cssVar : FONT_DEFAULT;
  document.documentElement.style.setProperty("--font-display", `var(${safe})`);
  document.documentElement.style.setProperty("--font-body", `var(${safe})`);
  localStorage.setItem(FONT_STORAGE_KEY, safe);
  localStorage.removeItem(FONT_DISPLAY_STORAGE_KEY);
  localStorage.removeItem(FONT_BODY_STORAGE_KEY);
}

export function resetFont() {
  applyFont(FONT_DEFAULT);
}

export function getStoredFont(): string {
  const combined = localStorage.getItem(FONT_STORAGE_KEY);
  if (combined && fontPresets.some((p) => p.cssVar === combined)) return combined;
  const legacy = localStorage.getItem(FONT_BODY_STORAGE_KEY) || localStorage.getItem(FONT_DISPLAY_STORAGE_KEY);
  if (legacy && fontPresets.some((p) => p.cssVar === legacy)) return legacy;
  return FONT_DEFAULT;
}

