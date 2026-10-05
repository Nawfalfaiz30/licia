import { describe, it, expect, beforeEach } from "vitest";
import { chatCompletionWithFallback, isFallbackEligible, resetAiBreakers, aiBreakerSnapshot } from "@/lib/ai/runtime";

type Call = { model: string };

/** Klien OpenAI palsu: `plan` menentukan hasil per model (Error = lempar, string = balasan sukses). */
function fakeClient(plan: Record<string, Error | string>) {
  const calls: Call[] = [];
  const client = {
    chat: {
      completions: {
        create: async (params: { model: string }) => {
          calls.push({ model: params.model });
          const outcome = plan[params.model];
          if (outcome instanceof Error) throw outcome;
          return { model: params.model, choices: [{ message: { role: "assistant", content: outcome ?? "ok" }, finish_reason: "stop" }] };
        },
      },
    },
  };
  return { client: client as any, calls };
}

const httpError = (status: number, message = "boom") => Object.assign(new Error(message), { status });
const PARAMS = (model: string) => ({ model, messages: [{ role: "user", content: "hai" }] }) as any;

beforeEach(() => resetAiBreakers());

describe("isFallbackEligible", () => {
  it("overload, rate limit, timeout, dan 5xx layak fallback", () => {
    for (const s of [408, 409, 425, 429, 500, 502, 503, 529]) expect(isFallbackEligible(httpError(s))).toBe(true);
  });
  it("jaringan putus (tanpa status) layak fallback", () => {
    expect(isFallbackEligible(new Error("fetch failed"))).toBe(true);
  });
  it("model tidak ditemukan layak fallback", () => {
    expect(isFallbackEligible(httpError(404, "The model `x` does not exist"))).toBe(true);
    expect(isFallbackEligible(Object.assign(new Error("x"), { status: 400, code: "model_not_found" }))).toBe(true);
  });
  it("auth, request salah, dan pembatalan TIDAK layak", () => {
    expect(isFallbackEligible(httpError(401))).toBe(false);
    expect(isFallbackEligible(httpError(403))).toBe(false);
    expect(isFallbackEligible(httpError(400, "invalid schema"))).toBe(false);
    expect(isFallbackEligible(Object.assign(new Error("aborted"), { name: "AbortError" }))).toBe(false);
    expect(isFallbackEligible(new Error("OPENAI_API_KEY belum dikonfigurasi"))).toBe(false);
  });
});

describe("chatCompletionWithFallback", () => {
  it("tanpa model cadangan: perilaku sama dengan chatCompletion (error diteruskan)", async () => {
    const { client, calls } = fakeClient({ main: httpError(503) });
    let threw = false;
    try { await chatCompletionWithFallback(client, PARAMS("main"), undefined, { fallbackModel: null }); } catch { threw = true; }
    expect(threw).toBe(true);
    expect(calls.map((c) => c.model)).toEqual(["main"]);
  });

  it("model utama sehat: model cadangan tidak dipanggil", async () => {
    const { client, calls } = fakeClient({ main: "dari utama" });
    const res = await chatCompletionWithFallback(client, PARAMS("main"), undefined, { fallbackModel: "backup" });
    expect(res.choices[0].message.content).toBe("dari utama");
    expect(calls.map((c) => c.model)).toEqual(["main"]);
  });

  it("model utama 503 → pindah ke cadangan dan sukses", async () => {
    const { client, calls } = fakeClient({ main: httpError(503), backup: "dari cadangan" });
    const res = await chatCompletionWithFallback(client, PARAMS("main"), undefined, { fallbackModel: "backup" });
    expect(res.choices[0].message.content).toBe("dari cadangan");
    expect(calls.map((c) => c.model)).toEqual(["main", "backup"]);
  });

  it("error 400 tidak memicu fallback", async () => {
    const { client, calls } = fakeClient({ main: httpError(400, "invalid schema"), backup: "x" });
    let threw = false;
    try { await chatCompletionWithFallback(client, PARAMS("main"), undefined, { fallbackModel: "backup" }); } catch { threw = true; }
    expect(threw).toBe(true);
    expect(calls.map((c) => c.model)).toEqual(["main"]);
  });

  it("cadangan ikut gagal → error cadangan diteruskan", async () => {
    const { client } = fakeClient({ main: httpError(503), backup: httpError(500, "backup juga down") });
    let message = "";
    try { await chatCompletionWithFallback(client, PARAMS("main"), undefined, { fallbackModel: "backup" }); } catch (e) { message = (e as Error).message; }
    expect(message).toBe("backup juga down");
  });

  it("parameter permintaan (messages) identik saat dialihkan ke cadangan", async () => {
    const seen: any[] = [];
    const client = { chat: { completions: { create: async (p: any) => { seen.push(p); if (p.model === "main") throw httpError(500); return { model: p.model, choices: [] }; } } } } as any;
    await chatCompletionWithFallback(client, { ...PARAMS("main"), max_completion_tokens: 321 }, undefined, { fallbackModel: "backup" });
    expect(seen[1].model).toBe("backup");
    expect(seen[1].max_completion_tokens).toBe(321);
    expect(seen[1].messages).toEqual(seen[0].messages);
  });
});

describe("circuit breaker", () => {
  it("terbuka setelah 3 kegagalan beruntun, lalu model utama dilewati", async () => {
    let t = 1_000_000;
    const now = () => t;
    const { client, calls } = fakeClient({ main: httpError(503), backup: "cadangan" });
    for (let i = 0; i < 3; i += 1) await chatCompletionWithFallback(client, PARAMS("main"), undefined, { fallbackModel: "backup", now });
    expect(calls.filter((c) => c.model === "main")).toHaveLength(3);

    calls.length = 0;
    await chatCompletionWithFallback(client, PARAMS("main"), undefined, { fallbackModel: "backup", now });
    expect(calls.map((c) => c.model)).toEqual(["backup"]); // utama dilewati
    expect(aiBreakerSnapshot(t)[0]).toEqual({ model: "main", failures: 3, open: true });
  });

  it("setelah cooldown 60 detik, model utama dicoba lagi dan breaker ditutup bila sukses", async () => {
    let t = 5_000_000;
    const now = () => t;
    const plan: Record<string, Error | string> = { main: httpError(503), backup: "cadangan" };
    const { client, calls } = fakeClient(plan);
    for (let i = 0; i < 3; i += 1) await chatCompletionWithFallback(client, PARAMS("main"), undefined, { fallbackModel: "backup", now });

    t += 61_000;
    plan.main = "pulih";
    calls.length = 0;
    const res = await chatCompletionWithFallback(client, PARAMS("main"), undefined, { fallbackModel: "backup", now });
    expect(res.choices[0].message.content).toBe("pulih");
    expect(calls.map((c) => c.model)).toEqual(["main"]);
    expect(aiBreakerSnapshot(t)).toEqual([]);
  });

  it("sukses di tengah memutus hitungan kegagalan beruntun", async () => {
    const plan: Record<string, Error | string> = { main: httpError(503), backup: "cadangan" };
    const { client } = fakeClient(plan);
    await chatCompletionWithFallback(client, PARAMS("main"), undefined, { fallbackModel: "backup" });
    await chatCompletionWithFallback(client, PARAMS("main"), undefined, { fallbackModel: "backup" });
    plan.main = "ok";
    await chatCompletionWithFallback(client, PARAMS("main"), undefined, { fallbackModel: "backup" });
    expect(aiBreakerSnapshot()).toEqual([]);
  });
});
