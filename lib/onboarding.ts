/** Langkah checklist onboarding (v0.57, A7). Murni agar mudah diuji. */

export type OnboardingStatus = {
  displayName: boolean;
  goal: boolean;
  project: boolean;
  task: boolean;
  finance: boolean;
  habit: boolean;
  note?: boolean;
};

export type OnboardingStepId = "name" | "task" | "note" | "direction" | "money";

export type OnboardingStep = {
  id: OnboardingStepId;
  done: boolean;
  title: string;
  /** Contoh yang bisa diklik → membuka Simpan Cepat terisi. */
  example?: { mode: "task" | "note" | "inbox"; text: string };
  href?: string;
};

export const ONBOARDING_DISMISS_KEY = "licia-onboarding-dismissed";

export function buildOnboardingSteps(status: OnboardingStatus): OnboardingStep[] {
  return [
    { id: "name", done: status.displayName, title: "Atur nama panggilan", href: "/settings" },
    {
      id: "task",
      done: status.task,
      title: "Tangkap tugas pertamamu",
      example: { mode: "task", text: "kirim laporan besok jam 9 pagi !1" },
    },
    {
      id: "note",
      done: Boolean(status.note),
      title: "Tulis catatan atau ide",
      example: { mode: "note", text: "Ide: rapikan meja kerja akhir pekan" },
    },
    { id: "direction", done: status.goal || status.project, title: "Buat target atau proyek", href: "/goals-projects" },
    {
      id: "money",
      done: status.finance,
      title: "Catat satu transaksi",
      example: { mode: "task", text: "beli kopi 25k" },
    },
  ];
}

export function onboardingProgress(steps: readonly OnboardingStep[]): {
  done: number;
  total: number;
  percent: number;
  complete: boolean;
} {
  const done = steps.filter((s) => s.done).length;
  const total = steps.length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0, complete: done === total };
}

/** Langkah selanjutnya yang disarankan: yang pertama belum selesai. */
export const nextStep = (steps: readonly OnboardingStep[]): OnboardingStep | null => steps.find((s) => !s.done) ?? null;
