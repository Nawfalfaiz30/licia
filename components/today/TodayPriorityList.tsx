"use client";

import { useState } from "react";
import { Check, Clock3 } from "lucide-react";
import { clsx } from "clsx";
import { mutateEntity } from "@/lib/sync/client";
import { notifyToast } from "@/components/ui";
import { useLanguage } from "@/components/LanguageProvider";
import { formatTimeInTimezone } from "@/lib/date";

type Task = {
  id: string;
  title: string;
  due_at: string | null;
  priority: "low" | "medium" | "high";
  timezone: string;
};

export function TodayPriorityList({ tasks }: { tasks: Task[] }) {
  const { t } = useLanguage();
  const [doneIds, setDoneIds] = useState<string[]>([]);

  async function complete(task: Task) {
    if (doneIds.includes(task.id)) return;
    setDoneIds((ids) => [...ids, task.id]);
    const result = await mutateEntity({
      entityType: "task",
      operation: "update",
      entityId: task.id,
      payload: { status: "done" },
    });
    if (!result.ok) {
      setDoneIds((ids) => ids.filter((id) => id !== task.id));
      notifyToast({
        title: t("Tugas belum selesai"),
        message: result.error || t("Perubahan gagal disimpan."),
        tone: "error",
      });
      return;
    }
    notifyToast({ title: t("Tugas selesai"), message: task.title, tone: "success" });
  }

  const visible = tasks.filter((task) => !doneIds.includes(task.id));
  return (
    <div className="grid gap-2">
      {visible.map((task) => (
        <div
          key={task.id}
          className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2.5"
        >
          <button
            type="button"
            onClick={() => void complete(task)}
            className={clsx(
              "touch-target grid h-11 w-11 shrink-0 place-items-center rounded-xl border",
              task.priority === "high"
                ? "border-danger/25 bg-danger/5 text-danger"
                : "border-border bg-bg text-textMuted hover:border-accent hover:text-accent",
            )}
            aria-label={t("Tandai {title} selesai", { title: task.title })}
          >
            <Check size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-semibold text-text">{task.title}</p>
            <p className="mt-0.5 flex items-center gap-1 text-2xs text-textMuted">
              {task.due_at ? (
                <>
                  <Clock3 size={11} />
                  {t("Tenggat {time}", { time: formatTimeInTimezone(task.due_at, task.timezone) })}
                </>
              ) : (
                t("Tanpa tenggat")
              )}
            </p>
          </div>
        </div>
      ))}
      {!visible.length && (
        <p className="rounded-xl bg-success/5 p-3 text-xs text-success">{t("Semua prioritas selesai.")}</p>
      )}
    </div>
  );
}
