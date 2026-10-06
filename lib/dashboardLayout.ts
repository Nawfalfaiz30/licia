/**
 * Tata letak dashboard yang bisa diatur (v0.57, A8): urutan, tampil/sembunyi, dan mode "Hari ini saja".
 * Murni (tanpa DOM) agar mudah diuji; penyimpanan di localStorage + tersinkron lewat Preferensi.
 */

export type DashboardWidgetId =
  | "overview" | "nextmove" | "stats" | "now" | "insights" | "direction" | "body" | "review" | "control";

export type WidgetDef = { id: DashboardWidgetId; label: string; description: string; todayMode: boolean };

/** Urutan bawaan = urutan di halaman sebelum v0.57. `todayMode` = tetap tampil di mode "Hari ini saja". */
export const DASHBOARD_WIDGETS: readonly WidgetDef[] = [
  { id: "overview", label: "Ringkasan cepat", description: "Jadwal, keuangan, target, dan kondisi hari ini", todayMode: true },
  { id: "nextmove", label: "Langkah berikutnya", description: "Saran satu langkah paling berguna sekarang", todayMode: true },
  { id: "stats", label: "Angka penting", description: "Tugas terbuka, agenda, fokus, target", todayMode: true },
  { id: "now", label: "Yang perlu dilakukan & perencanaan", description: "Tugas prioritas dan rencana hari ini", todayMode: true },
  { id: "insights", label: "Wawasan hidup", description: "Pola dan insight dari datamu", todayMode: false },
  { id: "direction", label: "Target & agenda", description: "Arah yang dikejar dan agenda mendatang", todayMode: false },
  { id: "body", label: "Tubuh & keuangan bulan ini", description: "Kesehatan harian dan ringkasan bulanan", todayMode: false },
  { id: "review", label: "Tinjauan mingguan & aktivitas", description: "Review pekan dan umpan aktivitas terbaru", todayMode: false },
  { id: "control", label: "Pusat kendali", description: "Pintasan modul dan akses cepat", todayMode: false },
] as const;

export const DASHBOARD_LAYOUT_KEY = "licia-dashboard-layout";

export type DashboardLayout = { order: DashboardWidgetId[]; hidden: DashboardWidgetId[]; todayOnly: boolean };

const ALL_IDS = DASHBOARD_WIDGETS.map((w) => w.id);
const isId = (value: unknown): value is DashboardWidgetId => typeof value === "string" && (ALL_IDS as string[]).includes(value);

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = { order: [...ALL_IDS], hidden: [], todayOnly: false };

/**
 * Menormalkan data tersimpan: buang ID tak dikenal/duplikat, tambahkan widget baru (rilis mendatang) di
 * posisi bawaannya relatif terhadap tetangganya, dan paksa tipe yang benar. Tidak pernah melempar.
 */
export function normalizeLayout(input: unknown): DashboardLayout {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const seen = new Set<DashboardWidgetId>();
  const order: DashboardWidgetId[] = [];
  for (const id of Array.isArray(raw.order) ? raw.order : []) {
    if (isId(id) && !seen.has(id)) { seen.add(id); order.push(id); }
  }
  // Widget yang belum ada di urutan tersimpan disisipkan setelah widget bawaan sebelumnya.
  ALL_IDS.forEach((id, index) => {
    if (seen.has(id)) return;
    let insertAt = 0;
    for (let i = index - 1; i >= 0; i -= 1) {
      const at = order.indexOf(ALL_IDS[i]);
      if (at >= 0) { insertAt = at + 1; break; }
    }
    order.splice(insertAt, 0, id);
    seen.add(id);
  });
  const hidden = [...new Set((Array.isArray(raw.hidden) ? raw.hidden : []).filter(isId))];
  return { order, hidden, todayOnly: raw.todayOnly === true };
}

export function parseLayout(json: string | null | undefined): DashboardLayout {
  if (!json) return { ...DEFAULT_DASHBOARD_LAYOUT, order: [...DEFAULT_DASHBOARD_LAYOUT.order], hidden: [] };
  try { return normalizeLayout(JSON.parse(json)); } catch { return normalizeLayout(null); }
}

export const serializeLayout = (layout: DashboardLayout): string => JSON.stringify(normalizeLayout(layout));

/** Apakah widget ini terlihat? Mode "Hari ini saja" menyembunyikan widget non-harian tanpa mengubah pilihan pengguna. */
export function isWidgetVisible(layout: DashboardLayout, id: DashboardWidgetId): boolean {
  if (layout.hidden.includes(id)) return false;
  if (layout.todayOnly) return DASHBOARD_WIDGETS.find((w) => w.id === id)?.todayMode === true;
  return true;
}

/** Nilai CSS `order` untuk widget (0 = paling atas). */
export const widgetOrder = (layout: DashboardLayout, id: DashboardWidgetId): number => Math.max(0, layout.order.indexOf(id));

export function moveWidget(layout: DashboardLayout, id: DashboardWidgetId, direction: -1 | 1): DashboardLayout {
  const order = [...layout.order];
  const from = order.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= order.length) return layout;
  [order[from], order[to]] = [order[to], order[from]];
  return { ...layout, order };
}

export function toggleWidget(layout: DashboardLayout, id: DashboardWidgetId): DashboardLayout {
  const hidden = layout.hidden.includes(id) ? layout.hidden.filter((x) => x !== id) : [...layout.hidden, id];
  return { ...layout, hidden };
}

export const setTodayOnly = (layout: DashboardLayout, value: boolean): DashboardLayout => ({ ...layout, todayOnly: value });

export const resetLayout = (): DashboardLayout => normalizeLayout(null);

export function isCustomized(layout: DashboardLayout): boolean {
  return layout.todayOnly || layout.hidden.length > 0 || layout.order.some((id, i) => id !== ALL_IDS[i]);
}
