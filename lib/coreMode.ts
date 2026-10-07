export type CoreModule =
  | "today"
  | "chat"
  | "tasks"
  | "calendar"
  | "notes"
  | "finance";

export const CORE_MODULES: readonly CoreModule[] = [
  "today",
  "chat",
  "tasks",
  "calendar",
  "notes",
  "finance",
] as const;

export type NavigationGroup = {
  key: string;
  label: string;
  routes: string[];
};

export const CONSOLIDATED_NAVIGATION: readonly NavigationGroup[] = [
  { key: "capture", label: "Masuk", routes: ["/capture", "/inbox"] },
  { key: "focus", label: "Fokus", routes: ["/focus", "/pomodoro"] },
  { key: "review", label: "Tinjauan", routes: ["/timeline", "/analytics", "/insights", "/pulse", "/brief"] },
  { key: "map", label: "Peta", routes: ["/life-map", "/life-graph"] },
  { key: "knowledge", label: "Pengetahuan", routes: ["/notes", "/vault", "/reading"] },
] as const;

const LEGACY_REDIRECTS: Record<string, string> = {
  "/capture": "/inbox",
  "/pomodoro": "/focus",
  "/timeline": "/brief",
  "/pulse": "/brief",
  "/life-graph": "/life-map",
};

export function isCoreModule(value: string): value is CoreModule {
  return (CORE_MODULES as readonly string[]).includes(value);
}

export function legacyRedirect(pathname: string) {
  return LEGACY_REDIRECTS[pathname] || null;
}

export function isRouteInConsolidatedGroup(pathname: string, group: NavigationGroup) {
  return group.routes.includes(pathname);
}

export function coreModuleFromPath(pathname: string): CoreModule | null {
  if (pathname === "/today" || pathname === "/") return "today";
  if (pathname.startsWith("/chat")) return "chat";
  if (pathname.startsWith("/task")) return "tasks";
  if (pathname.startsWith("/calendar")) return "calendar";
  if (pathname.startsWith("/note")) return "notes";
  if (pathname.startsWith("/finance")) return "finance";
  return null;
}
