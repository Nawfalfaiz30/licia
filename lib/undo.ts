/**
 * Antrean "tunda lalu eksekusi" untuk tombol Urungkan (v0.57).
 *
 * Aksi destruktif (hapus) tidak langsung dikirim: UI menyembunyikan itemnya, toast menawarkan
 * "Urungkan" selama beberapa detik, dan komit baru berjalan setelah jeda. Bila pengguna menutup tab,
 * semua komit tertunda dijalankan lebih dulu (`flushAll`) agar tidak ada penghapusan yang hilang.
 */

export type UndoTimerApi = {
  set: (fn: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
};

type Pending = { commit: () => void | Promise<void>; handle: unknown };

export class UndoQueue {
  private pending = new Map<string, Pending>();
  private timers: UndoTimerApi;
  constructor(timers?: UndoTimerApi) {
    this.timers = timers ?? {
      set: (fn, ms) => setTimeout(fn, ms),
      clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    };
  }

  /** Jadwalkan komit. ID yang sama menimpa jadwal lama (komit lama dijalankan lebih dulu). */
  schedule(id: string, commit: () => void | Promise<void>, delayMs: number) {
    if (this.pending.has(id)) void this.flush(id);
    const handle = this.timers.set(() => {
      void this.flush(id);
    }, delayMs);
    this.pending.set(id, { commit, handle });
  }

  /** Batalkan tanpa menjalankan komit. True bila memang ada yang dibatalkan. */
  cancel(id: string): boolean {
    const item = this.pending.get(id);
    if (!item) return false;
    this.timers.clear(item.handle);
    this.pending.delete(id);
    return true;
  }

  /** Jalankan komit sekarang (mis. saat jeda habis atau tab ditutup). */
  async flush(id: string) {
    const item = this.pending.get(id);
    if (!item) return;
    this.timers.clear(item.handle);
    this.pending.delete(id);
    await item.commit();
  }

  async flushAll() {
    for (const id of [...this.pending.keys()]) await this.flush(id);
  }

  has(id: string) {
    return this.pending.has(id);
  }
  get size() {
    return this.pending.size;
  }
}

export const UNDO_WINDOW_MS = 5000;
