import { describe, it, expect } from "vitest";
import { translations, t, interpolate, localeFor, resolveLanguage } from "@/lib/i18n";
import { idMessages } from "@/lib/messages/id";
import { enMessages } from "@/lib/messages/en";

describe("kamus dwibahasa", () => {
  it("kunci Indonesia dan English identik", () => {
    const id = Object.keys(translations.id).sort();
    const en = Object.keys(translations.en).sort();
    expect(en).toEqual(id);
    expect(Object.keys(idMessages).sort()).toEqual(Object.keys(enMessages).sort());
  });

  it("tidak ada terjemahan kosong", () => {
    for (const lang of ["id", "en"] as const) {
      for (const [key, value] of Object.entries(translations[lang])) {
        expect(value.trim().length, `${lang}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("penanda {param} sama di kedua bahasa", () => {
    const params = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
    for (const key of Object.keys(translations.id)) {
      expect(params(translations.en[key]), key).toBe(params(translations.id[key]));
    }
  });

  it("kunci navigasi guide dan search tersedia (sebelumnya tampil sebagai kunci mentah)", () => {
    expect(t("guide", "id")).toBe("Panduan");
    expect(t("guide", "en")).toBe("Guide");
    expect(t("search", "en")).toBe("Search");
  });
});

describe("t() dan interpolate()", () => {
  it("mengganti parameter", () => {
    expect(t("onb_progress", "en", { done: 2, total: 5 })).toBe("2 of 5 done");
    expect(t("onb_progress", "id", { done: 2, total: 5 })).toBe("2 dari 5 selesai");
  });
  it("penanda tanpa nilai dibiarkan", () => {
    expect(interpolate("a {x} b {y}", { x: 1 })).toBe("a 1 b {y}");
  });
  it("kunci tak dikenal mengembalikan kuncinya", () => {
    expect(t("tidak_ada_kunci_ini", "en")).toBe("tidak_ada_kunci_ini");
  });
  it("resolveLanguage dan localeFor", () => {
    expect(resolveLanguage("en")).toBe("en");
    expect(resolveLanguage("fr")).toBe("id");
    expect(localeFor("en")).toBe("en-US");
    expect(localeFor("id")).toBe("id-ID");
  });
});
