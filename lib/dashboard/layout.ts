/** Tata letak dashboard yang bisa diatur (A8). Logika murni; tersimpan di cookie agar server langsung merender urutan yang benar. */
export const DASHBOARD_COOKIE = "licia-dashboard";

export const WIDGET_IDS = [
  "header",
  "onboarding",
  "overview",
  "next",
  "stats",
  "today",
  "insights",
  "goals",
  "life",
  "review",
  "more",
] as const;
export type WidgetId = (typeof WIDGET_IDS)[number];

/** Judul di panel "Sesuaikan" (diterjemahkan lewat tr saat render). */
export const WIDGET_TITLES: Record<WidgetId, string> = {
  header: "Sapaan",
  onboarding: "Checklist penyiapan",
  overview: "Ringkasan cepat",
  next: "Langkah berikutnya",
  stats: "Angka penting",
  today: "Hari ini & beban kerja",
  insights: "Wawasan Licia",
  goals: "Target & agenda",
  life: "Kesehatan & keuangan",
  review: "Review & aktivitas",
  more: "Pintasan & pengaturan",
};

/** Sapaan tidak bisa disembunyikan/dipindah dari posisi pertama. */
export const LOCKED: ReadonlySet<WidgetId> = new Set<WidgetId>(["header"]);
/** Mode "Hari ini saja": hanya yang relevan untuk hari berjalan. */
export const TODAY_ONLY: ReadonlySet<WidgetId> = new Set<WidgetId>(["header", "onboarding", "next", "stats", "today"]);

export type DashboardPrefs = { order: WidgetId[]; hidden: WidgetId[]; todayOnly: boolean };
export const DEFAULT_PREFS: DashboardPrefs = { order: [...WIDGET_IDS], hidden: [], todayOnly: false };

const isId = (v: unknown): v is WidgetId => typeof v === "string" && (WIDGET_IDS as readonly string[]).includes(v);

/** Membersihkan data cookie yang rusak/lama: id tak dikenal dibuang, id baru ditambahkan di akhir, "header" selalu pertama. */
export function normalizePrefs(input: unknown): DashboardPrefs {
  const raw = (input && typeof input === "object" ? input : {}) as Partial<Record<keyof DashboardPrefs, unknown>>;
  const seen = new Set<WidgetId>();
  const order: WidgetId[] = [];
  for (const id of Array.isArray(raw.order) ? raw.order : [])
    if (isId(id) && !seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  for (const id of WIDGET_IDS) if (!seen.has(id)) order.push(id);
  const withoutLocked = order.filter((id) => !LOCKED.has(id));
  const finalOrder = [...WIDGET_IDS.filter((id) => LOCKED.has(id)), ...withoutLocked];
  const hidden = Array.from(
    new Set((Array.isArray(raw.hidden) ? raw.hidden : []).filter(isId).filter((id) => !LOCKED.has(id))),
  );
  return { order: finalOrder, hidden, todayOnly: raw.todayOnly === true };
}

export function parsePrefs(cookieValue: string | null | undefined): DashboardPrefs {
  if (!cookieValue) return { ...DEFAULT_PREFS, order: [...DEFAULT_PREFS.order] };
  try {
    return normalizePrefs(JSON.parse(decodeURIComponent(cookieValue)));
  } catch {
    return { ...DEFAULT_PREFS, order: [...DEFAULT_PREFS.order] };
  }
}
export const serializePrefs = (prefs: DashboardPrefs) =>
  encodeURIComponent(JSON.stringify({ order: prefs.order, hidden: prefs.hidden, todayOnly: prefs.todayOnly }));

/** Urutan widget yang benar-benar tampil. */
export function visibleWidgets(prefs: DashboardPrefs): WidgetId[] {
  return prefs.order.filter((id) => (prefs.todayOnly ? TODAY_ONLY.has(id) : !prefs.hidden.includes(id)));
}

/** Geser satu widget naik/turun di antara widget yang bisa dipindah (header terkunci di atas). */
export function moveWidget(prefs: DashboardPrefs, id: WidgetId, direction: -1 | 1): DashboardPrefs {
  if (LOCKED.has(id)) return prefs;
  const movable = prefs.order.filter((x) => !LOCKED.has(x));
  const index = movable.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= movable.length) return prefs;
  [movable[index], movable[target]] = [movable[target], movable[index]];
  return normalizePrefs({ ...prefs, order: [...prefs.order.filter((x) => LOCKED.has(x)), ...movable] });
}
export function toggleWidget(prefs: DashboardPrefs, id: WidgetId): DashboardPrefs {
  if (LOCKED.has(id)) return prefs;
  const hidden = prefs.hidden.includes(id) ? prefs.hidden.filter((x) => x !== id) : [...prefs.hidden, id];
  return { ...prefs, hidden };
}
