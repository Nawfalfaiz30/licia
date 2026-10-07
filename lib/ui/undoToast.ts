"use client";
import { notifyToast } from "@/components/ui/toast";
import { UNDO_WINDOW_MS, UndoQueue } from "@/lib/undo";
import { haptic } from "@/lib/interaction";

const queue = new UndoQueue();
let flushHooked = false;

function hookFlush() {
  if (flushHooked || typeof window === "undefined") return;
  flushHooked = true;
  const flush = () => {
    void queue.flushAll();
  };
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

type Common = { title: string; message?: string; undoLabel: string; windowMs?: number };

/**
 * Aksi sudah diterapkan; toast menawarkan membatalkannya lewat `revert` (mis. status tugas dikembalikan).
 */
export function toastWithUndo(opts: Common & { revert: () => void | Promise<void> }) {
  notifyToast({
    title: opts.title,
    message: opts.message,
    tone: "success",
    duration: opts.windowMs ?? UNDO_WINDOW_MS,
    action: {
      label: opts.undoLabel,
      onClick: () => {
        haptic("selection");
        void opts.revert();
      },
    },
  });
}

/**
 * Aksi destruktif ditunda: `hide` dipanggil sekarang (sembunyikan item), `commit` hanya berjalan bila
 * pengguna tidak menekan Urungkan dalam jendela waktu; `restore` mengembalikan item di UI.
 */
export function deferDestructive(
  opts: Common & { id: string; hide: () => void; restore: () => void; commit: () => void | Promise<void> },
) {
  hookFlush();
  const windowMs = opts.windowMs ?? UNDO_WINDOW_MS;
  opts.hide();
  queue.schedule(opts.id, opts.commit, windowMs);
  notifyToast({
    title: opts.title,
    message: opts.message,
    tone: "success",
    duration: windowMs,
    action: {
      label: opts.undoLabel,
      onClick: () => {
        if (queue.cancel(opts.id)) {
          haptic("selection");
          opts.restore();
        }
      },
    },
  });
}
