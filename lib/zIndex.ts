/**
 * Skala z-index bertoken (v0.57). Sebelumnya nilai tetap tersebar (80, 90, 100, 105, 110, 120, 140–142,
 * 170, 180, 200, 230, 240, 9998, 9999) sehingga urutan tumpukan overlay sulit diprediksi.
 *
 * Aturan: lapisan tingkat-aplikasi WAJIB memakai token (kelas Tailwind `z-nav`, `z-modal`, dst. atau
 * variabel CSS `var(--z-modal)`). Tumpukan lokal di dalam satu komponen boleh memakai z-0…z-40.
 *
 * Urutan naik: konten < nav < header < float < banner < popover < sheet < modal < palette < toast < skip.
 */
export const Z = {
  nav: 20,
  header: 40,
  float: 50,
  banner: 60,
  popover: 70,
  sheet: 100,
  modal: 110,
  palette: 120,
  toast: 130,
  skip: 200,
} as const;

export type ZLayer = keyof typeof Z;

/** Bentuk yang dipakai Tailwind (`theme.extend.zIndex`) — nilai berupa string. */
export const zIndexTheme: Record<ZLayer, string> = Object.fromEntries(
  (Object.keys(Z) as ZLayer[]).map((key) => [key, String(Z[key])]),
) as Record<ZLayer, string>;

/** Urutan harus tetap naik; dipakai tes agar token baru tidak merusak hirarki. */
export function zOrder(): ZLayer[] {
  return (Object.keys(Z) as ZLayer[]).sort((a, b) => Z[a] - Z[b]);
}
