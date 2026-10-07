import { describe, it, expect } from "vitest";
import { emitProgress, runWithProgress, streamChatResponse, toolLabel } from "@/lib/ai/progress";

async function readAll(res: Response) {
  const text = await res.text();
  return text
    .split("\n\n")
    .filter((b) => b && !b.startsWith(":"))
    .map((b) => {
      const ev = /event: (.*)/.exec(b)?.[1];
      const data = JSON.parse(/data: (.*)/.exec(b)![1]);
      return { ev, data };
    });
}

describe("emitProgress", () => {
  it("tidak error di luar konteks streaming", async () => {
    emitProgress({ type: "status", text: "x" });
    expect(true).toBe(true);
  });
  it("mengirim event ke emitter aktif", async () => {
    const got: string[] = [];
    await runWithProgress(
      (e) => got.push(e.type),
      async () => {
        emitProgress({ type: "tool_start", name: "get_tasks", label: "x" });
      },
    );
    expect(got).toEqual(["tool_start"]);
  });
});

describe("toolLabel", () => {
  it("memberi label ramah", () => {
    expect(toolLabel("get_tasks")).toBe("Mencari tugas…");
    expect(toolLabel("create_reminder")).toBe("Mengatur pengingat…");
    expect(toolLabel("zzz")).toBe("Bekerja di Life OS…");
  });
});

describe("streamChatResponse", () => {
  it("urutan event: status → tool_start → final", async () => {
    const res = streamChatResponse(async () => {
      emitProgress({ type: "tool_start", name: "get_tasks", label: "Mencari tugas…" });
      return new Response(JSON.stringify({ reply: "halo" }), { status: 200 });
    });
    expect(res.headers.get("content-type")).toBe("text/event-stream; charset=utf-8");
    const events = await readAll(res);
    expect(events.map((e) => e.ev)).toEqual(["status", "tool_start", "final"]);
    expect(events[2].data).toEqual({ reply: "halo" });
  });
  it("status HTTP error dikirim sebagai event error", async () => {
    const events = await readAll(
      streamChatResponse(async () => new Response(JSON.stringify({ error: "x" }), { status: 503 })),
    );
    expect(events[1].ev).toBe("error");
    expect(events[1].data).toEqual({ status: 503, error: "x" });
  });
  it("exception dikirim sebagai event error 500", async () => {
    const events = await readAll(
      streamChatResponse(async () => {
        throw new Error("boom");
      }),
    );
    expect(events[1].data).toEqual({ status: 500, error: "boom" });
  });
});
