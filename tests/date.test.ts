import { describe, it, expect } from "vitest";
import {
  ensureTimezoneOffset,
  ensureWibOffset,
  localDateTimeToIso,
  offsetForTimezone,
  dateStrInTimezone,
  wibDateStr,
} from "@/lib/date";

describe("ensureTimezoneOffset", () => {
  it("mengganti Z (UTC) dengan offset WIB, bukan menggeser jam", () => {
    expect(ensureWibOffset("2026-09-20T19:00:00Z")).toBe("2026-09-20T19:00:00+07:00");
  });
  it("menambahkan offset bila tidak ada", () => {
    expect(ensureWibOffset("2026-09-20T19:00:00")).toBe("2026-09-20T19:00:00+07:00");
  });
  it("membiarkan offset numerik eksplisit", () => {
    expect(ensureWibOffset("2026-09-20T19:00:00+09:00")).toBe("2026-09-20T19:00:00+09:00");
  });
  it("tanggal saja dianggap tengah malam lokal", () => {
    expect(ensureWibOffset("2026-09-20")).toBe("2026-09-20T00:00:00+07:00");
  });
  it("null/kosong menghasilkan null", () => {
    expect(ensureWibOffset(null)).toBeNull();
    expect(ensureWibOffset("")).toBeNull();
  });
  it("memakai offset WITA / WIT sesuai zona", () => {
    expect(ensureTimezoneOffset("2026-09-20T08:00:00", "Asia/Makassar")).toBe("2026-09-20T08:00:00+08:00");
    expect(ensureTimezoneOffset("2026-09-20T08:00:00", "Asia/Jayapura")).toBe("2026-09-20T08:00:00+09:00");
  });
});

describe("offsetForTimezone", () => {
  it("default ke WIB untuk zona tak dikenal", () => {
    expect(offsetForTimezone("Europe/Paris")).toBe("+07:00");
    expect(offsetForTimezone(null)).toBe("+07:00");
  });
});

describe("localDateTimeToIso", () => {
  it("19:00 WIB = 12:00 UTC", () => {
    expect(localDateTimeToIso("2026-09-20", "19:00")).toBe("2026-09-20T12:00:00.000Z");
  });
  it("00:30 WIB jatuh di hari sebelumnya pada UTC", () => {
    expect(localDateTimeToIso("2026-09-20", "00:30")).toBe("2026-09-19T17:30:00.000Z");
  });
  it("input tidak valid menghasilkan null", () => {
    expect(localDateTimeToIso("", "10:00")).toBeNull();
    expect(localDateTimeToIso("abc", "10:00")).toBeNull();
  });
});

describe("tanggal per zona", () => {
  it("23:30 UTC masih hari yang sama di UTC tetapi sudah besok di WIB", () => {
    const d = new Date("2026-09-20T23:30:00Z");
    expect(dateStrInTimezone(d, "Asia/Jakarta")).toBe("2026-09-21");
    expect(wibDateStr(d)).toBe("2026-09-21");
  });
});
