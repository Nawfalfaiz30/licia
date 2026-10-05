import { describe, it, expect } from "vitest";
import { GO_TO, SHORTCUT_HELP, isTypingTarget, resolveGoTo } from "@/lib/shortcuts";
import { navGroups } from "@/components/layout/nav-items";

describe("resolveGoTo", () => {
  it("huruf dikenal → tujuan, tidak peka huruf besar", () => {
    expect(resolveGoTo("d")?.href).toBe("/dashboard");
    expect(resolveGoTo("D")?.href).toBe("/dashboard");
    expect(resolveGoTo("/")?.href).toBe("/search");
  });
  it("huruf tak dikenal dan kunci prototipe → null", () => {
    expect(resolveGoTo("z")).toBeNull();
    expect(resolveGoTo("")).toBeNull();
    expect(resolveGoTo("constructor")).toBeNull();
    expect(resolveGoTo("__proto__")).toBeNull();
  });
});

describe("GO_TO konsisten dengan navigasi aplikasi", () => {
  it("setiap tujuan ada di navigasi desktop (tidak ada tautan mati)", () => {
    const known = new Set(navGroups.flatMap((g) => g.items.map((i) => i.href)).concat(["/search"]));
    for (const [key, target] of Object.entries(GO_TO)) {
      expect(known.has(target.href)).toBe(true);
      expect(key.length).toBe(1);
    }
  });
  it("tidak ada dua huruf yang menuju halaman yang sama", () => {
    const hrefs = Object.values(GO_TO).map((t) => t.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("isTypingTarget", () => {
  it("input, textarea, select, contentEditable, dan role textbox = sedang mengetik", () => {
    expect(isTypingTarget({ tagName: "INPUT" } as any)).toBe(true);
    expect(isTypingTarget({ tagName: "textarea" } as any)).toBe(true);
    expect(isTypingTarget({ tagName: "SELECT" } as any)).toBe(true);
    expect(isTypingTarget({ tagName: "DIV", isContentEditable: true } as any)).toBe(true);
    expect(isTypingTarget({ tagName: "DIV", getAttribute: (n: string) => (n === "role" ? "textbox" : null) } as any)).toBe(true);
  });
  it("tombol, tautan, body, dan null = bukan", () => {
    expect(isTypingTarget({ tagName: "BUTTON" } as any)).toBe(false);
    expect(isTypingTarget({ tagName: "A" } as any)).toBe(false);
    expect(isTypingTarget({ tagName: "BODY" } as any)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("SHORTCUT_HELP", () => {
  it("memuat semua pintasan 'g' dan grup Umum", () => {
    const go = SHORTCUT_HELP.find((g) => g.title.startsWith("Pindah"));
    expect(go?.items).toHaveLength(Object.keys(GO_TO).length);
    expect(SHORTCUT_HELP[0].title).toBe("Umum");
  });
});
