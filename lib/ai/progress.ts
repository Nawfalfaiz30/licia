import { AsyncLocalStorage } from "node:async_hooks";

/** Event progres yang dikirim ke klien lewat SSE saat chat berjalan (V55). */
export type ChatProgressEvent =
  | { type: "status"; text: string }
  | { type: "tool_start"; name: string; label: string }
  | { type: "tool_done"; name: string; ok: boolean };

type Emitter = (event: ChatProgressEvent) => void;
const storage = new AsyncLocalStorage<Emitter>();

export function runWithProgress<T>(emitter: Emitter, fn: () => Promise<T>): Promise<T> {
  return storage.run(emitter, fn);
}

/** Aman dipanggil di mana saja: tidak berbuat apa-apa bila request tidak streaming. */
export function emitProgress(event: ChatProgressEvent) {
  try { storage.getStore()?.(event); } catch { /* progres tidak boleh menggagalkan chat */ }
}

const LABELS: Array<[RegExp, string]> = [
  [/^(get|list|search|find|read)_?.*task/, "Mencari tugas…"],
  [/task/, "Memproses tugas…"],
  [/schedule|calendar|agenda/, "Menyusun agenda…"],
  [/remind/, "Mengatur pengingat…"],
  [/expense|finance|wallet|income|budget/, "Mencatat keuangan…"],
  [/note/, "Mengolah catatan…"],
  [/habit/, "Memeriksa kebiasaan…"],
  [/memory/, "Mengingat konteks…"],
  [/search|snapshot|resolve/, "Mencari di Life OS…"],
];

export function toolLabel(name: string): string {
  for (const [re, label] of LABELS) if (re.test(name)) return label;
  return "Bekerja di Life OS…";
}

/** Bungkus handler JSON menjadi respons SSE: status → tool_start/tool_done → final | error. */
export function streamChatResponse(run: () => Promise<Response>, signal?: AbortSignal): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      // Klien menutup koneksi (Stop / pindah halaman): berhenti menulis ke stream
      // agar tidak muncul "The destination stream closed early".
      signal?.addEventListener("abort", () => { closed = true; }, { once: true });
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); } catch { closed = true; }
      };
      const close = () => { if (!closed) { closed = true; try { controller.close(); } catch {} } };
      const heartbeat = setInterval(() => { if (!closed) { try { controller.enqueue(encoder.encode(": ping\n\n")); } catch { closed = true; } } }, 15_000);
      try {
        send("status", { type: "status", text: "Licia sedang berpikir…" });
        const response = await runWithProgress((e) => send(e.type, e), run);
        if (response.status === 204) { close(); return; }
        const raw = await response.text();
        let payload: unknown = {};
        try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = { error: raw.slice(0, 300) || "Respons tidak valid." }; }
        if (response.ok) send("final", payload);
        else send("error", { status: response.status, ...(payload as Record<string, unknown>) });
      } catch (error) {
        if (!signal?.aborted) send("error", { status: 500, error: error instanceof Error ? error.message : "Kesalahan server." });
      } finally {
        clearInterval(heartbeat);
        close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
