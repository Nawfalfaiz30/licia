import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { interpolate, localeOf, resolveLanguage, t } from "@/lib/i18n";
import { enPhrases } from "@/lib/locales/en";
import { languageDirective, languageFromCookieHeader } from "@/lib/ai/language";
import { formatMoney, localeFor } from "@/lib/format";
import { formatChipDate, parseSmartCapture } from "@/lib/text/smartParse";
import { buildMoneyDraft, guessMoneyKind, moneyPayload } from "@/lib/text/moneyCapture";

describe("t() dua jenis kunci", () => {
  it("kunci pendek lama tetap berfungsi di kedua bahasa", () => {
    expect(t("home", "id")).not.toBe(t("home", "en"));
  });
  it("teks Indonesia sebagai kunci: id mengembalikan kunci, en memakai kamus", () => {
    expect(t("Tugas dibuat", "id")).toBe("Tugas dibuat");
    expect(t("Tugas dibuat", "en")).toBe("Task created");
  });
  it("frasa tak dikenal jatuh ke teks asli (tak pernah kosong)", () => {
    expect(t("Frasa yang belum ada xyz", "en")).toBe("Frasa yang belum ada xyz");
  });
  it("interpolasi {nama}, placeholder asing dibiarkan, null jadi kosong", () => {
    expect(t("{n} mnt lagi", "en", { n: 5 })).toContain("5");
    expect(interpolate("Halo {nama} {x}", { nama: "Sari" })).toBe("Halo Sari {x}");
    expect(interpolate("A {x}", { x: null })).toBe("A ");
  });
  it("resolveLanguage dan locale", () => {
    expect(resolveLanguage("en")).toBe("en");
    expect(resolveLanguage("fr")).toBe("id");
    expect(resolveLanguage(undefined)).toBe("id");
    expect(localeOf("en")).toBe("en-US");
    expect(localeFor("id")).toBe("id-ID");
  });
});

describe("kamus Inggris", () => {
  const keys = Object.keys(enPhrases);
  const slots = (s: string) => (s.match(/\{[A-Za-z_]\w*\}/g) ?? []).sort().join(",");
  it("tidak kosong dan cukup besar", () => {
    expect(keys.length).toBeGreaterThan(2000);
  });
  it("placeholder {…} identik di kedua sisi untuk setiap entri", () => {
    const bad = keys.filter((k) => slots(k) !== slots(enPhrases[k]));
    expect(bad).toEqual([]);
  });
  it("tidak ada padanan kosong", () => {
    expect(keys.filter((k) => !enPhrases[k].trim())).toEqual([]);
  });
  it("tidak menyisakan kata fungsi Indonesia yang jelas pada terjemahan (indikasi lupa terjemah)", () => {
    const leftovers = keys.filter((k) => /\b(yang|dengan|untuk|belum|tidak|sudah|akan)\b/i.test(enPhrases[k]) && k.length > 12 && !/Kotlin|besok|jam \d|Licia/.test(k + enPhrases[k]));
    expect(leftovers).toEqual([]);
  });
});

describe("pemeriksa kelengkapan di CI", () => {
  it("scripts/i18n.mjs ada dan terpasang di package.json", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
    expect(fs.existsSync(path.join(process.cwd(), "scripts/i18n.mjs"))).toBe(true);
    expect(String(pkg.scripts["i18n:check"])).toContain("scripts/i18n.mjs");
  });
});

describe("AI mengikuti bahasa", () => {
  it("membaca cookie bahasa dari header", () => {
    expect(languageFromCookieHeader("a=1; licia-language=en; b=2")).toBe("en");
    expect(languageFromCookieHeader("a=1")).toBe("id");
    expect(languageFromCookieHeader(null)).toBe("id");
  });
  it("arahan sesuai bahasa", () => {
    expect(languageDirective("en")).toContain("English");
    expect(languageDirective("id")).toContain("Indonesia");
  });
});

describe("format & chip dua bahasa", () => {
  it("Rupiah mengikuti locale", () => {
    expect(formatMoney(47000, "id-ID")).toBe("Rp 47.000");
    expect(formatMoney(47000, "en-US")).toBe("Rp 47,000");
  });
  it("label tanggal chip", () => {
    expect(formatChipDate("2026-10-06", "2026-10-05", "id")).toBe("Besok");
    expect(formatChipDate("2026-10-06", "2026-10-05", "en")).toBe("Tomorrow");
    expect(formatChipDate("2026-10-09", "2026-10-05", "en")).toBe("Fri, Oct 9");
    expect(formatChipDate("2026-10-09", "2026-10-05", "id")).toBe("Jum, 9 Okt");
  });
  it("parser memahami masukan Inggris dan memberi label Inggris", () => {
    const r = parseSmartCapture("send report tomorrow 7pm !1", { timezone: "Asia/Jakarta", lang: "en" });
    expect(r.dueTime).toBe("19:00");
    expect(r.priority).toBe("high");
    expect(r.chips.some((c) => c.label === "High priority")).toBe(true);
  });
});

describe("catat nominal (A1)", () => {
  it("menebak arah dari kata kunci", () => {
    expect(guessMoneyKind("beli kopi 47k")).toBe("expense");
    expect(guessMoneyKind("gaji masuk 5jt")).toBe("income");
    expect(guessMoneyKind("kopi 47k")).toBeNull();
  });
  it("membangun draf: label bersih dari nominal/jam/prioritas", () => {
    const d = buildMoneyDraft("beli kopi 47k besok !1 #kerja", "expense");
    expect(d?.amount).toBe(47000);
    expect(d?.label).toBe("Beli kopi");
  });
  it("tanpa nominal → tidak ada draf", () => {
    expect(buildMoneyDraft("beli kopi", "expense")).toBeNull();
  });
  it("muatan: pengeluaran memakai category, pemasukan memakai source", () => {
    const e = moneyPayload(buildMoneyDraft("makan siang 35k", "expense")!, "2026-10-05T00:00:00.000Z");
    expect(e.category).toBe("Makan siang");
    expect(e.amount).toBe(35000);
    const i = moneyPayload(buildMoneyDraft("gaji 5jt", "income")!, "2026-10-05T00:00:00.000Z");
    expect(i.source).toBe("Gaji");
    expect("category" in i).toBe(false);
  });
});
