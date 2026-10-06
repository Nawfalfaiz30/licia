"use client";
import { mutateEntity } from "@/lib/sync/client";
import { parseSmartCapture, smartDueAtIso, type ChipLang } from "@/lib/text/smartParse";
import { captureTimezone } from "@/lib/ui/captureTimezone";

export type CreatedTask = { ok: true; id: string | null; title: string; queued: boolean } | { ok: false; error: string };

/** Membuat tugas dari teks bebas dengan smart parsing (tanggal/jam/prioritas) — dipakai palet aksi. */
export async function createTaskFromText(text: string, lang: ChipLang = "id"): Promise<CreatedTask> {
  const tz = captureTimezone();
  const parsed = parseSmartCapture(text, { timezone: tz, stripTags: false, lang });
  const title = parsed.title || text.trim();
  if (!title) return { ok: false, error: "empty" };
  const dueAt = smartDueAtIso(parsed, tz);
  const result = await mutateEntity({
    entityType: "task",
    operation: "create",
    payload: { title, status: "todo", priority: parsed.priority ?? "medium", ...(dueAt ? { due_at: dueAt } : {}) },
    offlineOk: true,
  });
  if (!result.ok) return { ok: false, error: result.error || "Perubahan gagal disimpan." };
  const id = result.response?.entityId ? String(result.response.entityId) : null;
  return { ok: true, id, title, queued: Boolean(result.queued) };
}

export async function deleteTaskById(id: string): Promise<boolean> {
  const result = await mutateEntity({ entityType: "task", operation: "delete", entityId: id, payload: {} });
  return result.ok;
}
