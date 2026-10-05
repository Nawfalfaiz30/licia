import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { selectAiModel, selectAiFallbackModel } from "@/lib/ai/modelRouter";

const KEYS = ["LICIA_AI_MODEL", "LICIA_AI_HEAVY_MODEL", "LICIA_AI_FALLBACK_MODEL"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k];
  process.env.LICIA_AI_MODEL = "light";
  process.env.LICIA_AI_HEAVY_MODEL = "heavy";
  delete process.env.LICIA_AI_FALLBACK_MODEL;
});
afterEach(() => {
  for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
});

describe("selectAiModel", () => {
  it("pesan sederhana memakai model ringan", () => {
    expect(selectAiModel({ text: "halo" })).toBe("light");
    expect(selectAiModel({ text: "hi there" })).toBe("light");
  });
  it("kata kerja kompleks Indonesia -> heavy", () => {
    expect(selectAiModel({ text: "tolong analisis pengeluaran saya" })).toBe("heavy");
  });
  it("kata kerja kompleks Inggris -> heavy (sebelumnya selalu light)", () => {
    expect(selectAiModel({ text: "please analyze my spending" })).toBe("heavy");
    expect(selectAiModel({ text: "reschedule my meeting" })).toBe("heavy");
  });
  it("gambar, teks panjang, banyak domain, dan mode planner -> heavy", () => {
    expect(selectAiModel({ text: "ini", hasImage: true })).toBe("heavy");
    expect(selectAiModel({ text: "x".repeat(901) })).toBe("heavy");
    expect(selectAiModel({ text: "ok", domains: ["a", "b", "c"] })).toBe("heavy");
    expect(selectAiModel({ text: "ok", mode: "planner" })).toBe("heavy");
  });
  it("kombinasi hari + jadwal -> heavy, baik ID maupun EN", () => {
    expect(selectAiModel({ text: "besok masukkan ke kalender" })).toBe("heavy");
    expect(selectAiModel({ text: "tomorrow put it on the calendar" })).toBe("heavy");
  });
  it("tanpa model heavy, semuanya memakai model utama", () => {
    delete process.env.LICIA_AI_HEAVY_MODEL;
    expect(selectAiModel({ text: "analisis" })).toBe("light");
  });
});

describe("selectAiFallbackModel", () => {
  it("null bila tidak dikonfigurasi atau sama dengan model utama", () => {
    expect(selectAiFallbackModel("light")).toBeNull();
    process.env.LICIA_AI_FALLBACK_MODEL = "light";
    expect(selectAiFallbackModel("light")).toBeNull();
  });
  it("mengembalikan model cadangan bila berbeda", () => {
    process.env.LICIA_AI_FALLBACK_MODEL = "backup";
    expect(selectAiFallbackModel("light")).toBe("backup");
  });
});
