import { applyLanguage, resolveLanguage } from "@/lib/i18n";

type PreferencesSnapshot = Record<string, unknown>;

const STORAGE_MAP: Record<string, string> = {
  language: "licia-language",
  density: "licia-density",
  reducedMotion: "licia-reduced-motion",
  compactSidebar: "licia-compact-sidebar",
  showQuickSearchMobile: "licia-quick-search-mobile",
  motionIntensity: "licia-motion-intensity",
  showDailyBrief: "licia-show-daily-brief",
  browserNotifications: "licia-browser-notifications",
  defaultPriority: "licia-default-priority",
  defaultTaskMinutes: "licia-default-task-minutes",
  chatEnterToSend: "licia-chat-enter-to-send",
  taskView: "licia-task-view",
  taskSort: "licia-task-sort",
  calendarView: "licia-calendar-view",
  chatStyle: "licia-chat-style",
  textScale: "licia-text-scale",
  pageAnimations: "licia-page-animations",
  smartSuggestions: "licia-smart-suggestions",
  defaultAiMode: "licia-default-ai-mode",
  notificationPollMinutes: "licia-notification-poll-minutes",
  notificationLeadDays: "licia-notification-lead-days",
  confirmBulkActions: "licia-confirm-bulk-actions",
  aiResponseStyle: "licia-ai-response-style",
  aiReadAllData: "licia-ai-read-all-data",
  aiAutoLink: "licia-ai-auto-link",
  aiProactive: "licia-ai-proactive",
  aiSuggestActions: "licia-ai-suggest-actions",
  aiConfirmDestructive: "licia-ai-confirm-destructive",
  aiConfirmMassive: "licia-ai-confirm-massive",
  haptics: "licia-haptics",
  soundFeedback: "licia-sound-feedback",
  offlineCapture: "licia-offline-capture",
  showFocusWidget: "licia-show-focus-widget",
  showFinanceWidget: "licia-show-finance-widget",
  showGoalWidget: "licia-show-goal-widget",
  showCalendarWidget: "licia-show-calendar-widget",
  defaultReminderMinutes: "licia-default-reminder-minutes",
  dailyBriefHour: "licia-daily-brief-hour",
  weeklyReviewDay: "licia-weekly-review-day",
  autoCompleteFocus: "licia-auto-complete-focus",
  showNextMove: "licia-show-next-move",
  showModuleRail: "licia-show-module-rail",
  autoSyncPreferences: "licia-auto-sync-preferences",
  smartPlanner: "licia-smart-planner",
  proactiveAssistant: "licia-proactive-assistant",
  quickCaptureGlobal: "licia-quick-capture-global",
  syncEnabled: "licia-sync-enabled",
  syncIntervalSeconds: "licia-sync-interval-seconds",
  syncOnFocus: "licia-sync-on-focus",
  offlineQueueLimit: "licia-offline-queue-limit",
  conflictStrategy: "licia-conflict-strategy",
  pushAutoReconnect: "licia-push-auto-reconnect",
  showSyncStatus: "licia-show-sync-status",
  syncOnNetworkChange: "licia-sync-on-network-change",
  syncOnVisibility: "licia-sync-on-visibility",
  voiceCaptureLanguage: "licia-voice-capture-language",
  lifeGraphLinks: "licia-life-graph-links",
  dailySnapshot: "licia-daily-snapshot",
  aiPlanPreview: "licia-ai-plan-preview",
  aiExplainActions: "licia-ai-explain-actions",
  aiConfidence: "licia-ai-confidence",
  aiSandboxWrites: "licia-ai-sandbox-writes",
  aiWatchers: "licia-ai-watchers",
  adaptiveDashboard: "licia-adaptive-dashboard",
  dailyBrain: "licia-daily-brain",
  eveningReview: "licia-evening-review",
  whatIfPlanning: "licia-what-if-planning",
  contextualActions: "licia-contextual-actions",
  commandPalette: "licia-command-palette",
  bottomSheets: "licia-bottom-sheets",
  gestureActions: "licia-gesture-actions",
  pushActionButtons: "licia-push-action-buttons",
  ambientAi: "licia-ambient-ai",
  offlineQueueCenter: "licia-offline-queue-center",
  autoBackup: "licia-auto-backup",
  calendarConflictDetection: "licia-calendar-conflict-detection",
  taskDependencies: "licia-task-dependencies",
  financeInsights: "licia-finance-insights",
  healthInsights: "licia-health-insights",
  focusRhythm: "licia-focus-rhythm",
  subscriptionWatch: "licia-subscription-watch",
  naturalAutomation: "licia-natural-automation",
  systemHealthScore: "licia-system-health-score",
  privacySensitiveAi: "licia-privacy-sensitive-ai",
  universalSearch: "licia-universal-search",
  dailyReview: "licia-daily-review",
  weeklyReview: "licia-weekly-review",
  visionWorkflows: "licia-vision-workflows",
  voiceActions: "licia-voice-actions",
  aiActionExplain: "licia-ai-action-explain",
  lifeCopilot: "licia-life-copilot",
  evidenceLayer: "licia-evidence-layer",
  calendarGuard: "licia-calendar-guard",
  smartReview: "licia-smart-review",
  adaptiveWidgets: "licia-adaptive-widgets",
  offlineWorkspace: "licia-offline-workspace",
  privacyCenter: "licia-privacy-center",
  voiceVisionCapture: "licia-voice-vision-capture",
};

function setStorage(key: string, value: unknown) {
  try { localStorage.setItem(key, String(value)); } catch {}
}

export function applySyncedPreferences(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return;
  const preferences = input as PreferencesSnapshot;
  for (const [name, storageKey] of Object.entries(STORAGE_MAP)) {
    if (preferences[name] !== undefined) setStorage(storageKey, preferences[name]);
  }

  const language = resolveLanguage(preferences.language);
  applyLanguage(language);
  const root = document.documentElement;
  const bool = (key: string) => preferences[key] === true ? "true" : preferences[key] === false ? "false" : undefined;
  const setData = (datasetKey: string, value: string | undefined) => { if (value !== undefined) root.dataset[datasetKey] = value; };
  setData("reducedMotion", bool("reducedMotion"));
  setData("compactSidebar", bool("compactSidebar"));
  setData("quickSearchMobile", bool("showQuickSearchMobile"));
  if (typeof preferences.density === "string") root.dataset.density = preferences.density;
  if (typeof preferences.motionIntensity === "string") root.dataset.motion = preferences.motionIntensity;
  if (typeof preferences.chatStyle === "string") root.dataset.chatStyle = preferences.chatStyle;
  if (typeof preferences.textScale === "string") root.dataset.textScale = preferences.textScale;
  setData("pageAnimations", bool("pageAnimations"));
  setData("showNextMove", bool("showNextMove"));
  setData("showModuleRail", bool("showModuleRail"));
  window.dispatchEvent(new CustomEvent("licia:preferences-change", { detail: preferences }));
}
