// Klien SSE untuk /api/chat (V55). Bila server tidak mengirim event-stream
// (mis. streaming dimatikan), otomatis jatuh kembali ke JSON biasa.
export type ChatStreamEvent =
  | { type: "status"; text: string }
  | { type: "tool_start"; name: string; label: string }
  | { type: "tool_done"; name: string; ok: boolean };

export type ChatStreamResult = { ok: boolean; status: number; data: any };

export async function postChatStream(
  body: unknown,
  opts: { signal?: AbortSignal; onEvent?: (event: ChatStreamEvent) => void } = {},
): Promise<ChatStreamResult> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  const type = res.headers.get("content-type") || "";
  if (!type.includes("text/event-stream") || !res.body) {
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: ChatStreamResult | null = null;

  const handle = (block: string) => {
    let event = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith(":")) continue;
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }
    if (!dataLines.length) return;
    let payload: any = {};
    try { payload = JSON.parse(dataLines.join("\n")); } catch { return; }
    if (event === "final") result = { ok: true, status: 200, data: payload };
    else if (event === "error") result = { ok: false, status: Number(payload?.status) || 500, data: payload };
    else opts.onEvent?.(payload as ChatStreamEvent);
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      handle(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 2);
    }
  }
  if (buffer.trim()) handle(buffer);
  return result ?? { ok: false, status: 502, data: { error: "Koneksi terputus sebelum jawaban selesai." } };
}
