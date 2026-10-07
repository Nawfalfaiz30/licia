import { deriveAccentTokens, rgbTriple } from "@/lib/contrast";

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

export const ACCENT_TOKENS_STORAGE_KEY = "licia-accent-tokens";

/**
 * Menerapkan aksen kustom sebagai DUA peran per mode (v0.57): isian (bg-accent + teks putih) dan tinta
 * (text-accent di atas latar). Keduanya diturunkan otomatis agar lolos WCAG AA, apa pun warna yang dipilih.
 */
export function applyAccent(hex: string) {
  if (!hexToRgbTriple(hex)) return false;
  const tokens = deriveAccentTokens(hex);
  const props: Record<string, string> = {
    "--accent-fill-light-rgb": rgbTriple(tokens.lightFill),
    "--accent-ink-light-rgb": rgbTriple(tokens.lightInk),
    "--accent-fill-dark-rgb": rgbTriple(tokens.darkFill),
    "--accent-ink-dark-rgb": rgbTriple(tokens.darkInk),
  };
  const root = document.documentElement;
  for (const [key, value] of Object.entries(props)) root.style.setProperty(key, value);
  try {
    localStorage.setItem(ACCENT_STORAGE_KEY, hex);
    localStorage.setItem(ACCENT_TOKENS_STORAGE_KEY, JSON.stringify(props));
  } catch {}
  return true;
}

export function resetAccent() {
  const root = document.documentElement;
  for (const key of [
    "--accent-fill-light-rgb",
    "--accent-ink-light-rgb",
    "--accent-fill-dark-rgb",
    "--accent-ink-dark-rgb",
    "--accent-rgb",
  ])
    root.style.removeProperty(key);
  try {
    localStorage.removeItem(ACCENT_STORAGE_KEY);
    localStorage.removeItem(ACCENT_TOKENS_STORAGE_KEY);
  } catch {}
}

/** Pengguna lama hanya punya hex tersimpan: turunkan token sekali saat aplikasi dimuat. */
export function ensureAccentTokens() {
  try {
    const hex = localStorage.getItem(ACCENT_STORAGE_KEY);
    if (hex && !localStorage.getItem(ACCENT_TOKENS_STORAGE_KEY)) applyAccent(hex);
  } catch {}
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

export type TextScale = "small" | "normal" | "large" | "xlarge";
export const TEXT_SCALES: TextScale[] = ["small", "normal", "large", "xlarge"];
export const TEXT_SCALE_PERCENT: Record<TextScale, number> = { small: 93.75, normal: 100, large: 112.5, xlarge: 125 };
export const resolveTextScale = (value: unknown): TextScale =>
  (TEXT_SCALES as unknown[]).includes(value) ? (value as TextScale) : "normal";

export function applyTextScale(value: unknown): TextScale {
  const scale = resolveTextScale(value);
  if (typeof document !== "undefined") document.documentElement.dataset.textScale = scale;
  try {
    localStorage.setItem("licia-text-scale", scale);
  } catch {}
  return scale;
}

export type ThemeMode = "light" | "dark" | "system";

export function resolveThemeIsDark(mode: ThemeMode): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyThemePreference(mode: string): ThemeMode {
  const safe: ThemeMode = mode === "dark" || mode === "light" || mode === "system" ? mode : "system";
  if (typeof document === "undefined") return safe;
  document.documentElement.classList.toggle("dark", resolveThemeIsDark(safe));
  document.documentElement.dataset.theme = safe;
  try {
    localStorage.setItem("licia-theme", safe);
  } catch {}
  applyBackgroundForCurrentMode();
  return safe;
}
