import { describe, it, expect } from "vitest";
import {
  parseSmartCapture,
  parseMoneyId,
  findMoneyMentions,
  addDaysYmd,
  formatChipDate,
  smartDueAtIso,
} from "@/lib/text/smartParse";

// Minggu, 4 Oktober 2026 pukul 10:00 WIB (03:00 UTC). Semua tanggal relatif dihitung dari sini.
const NOW = new Date("2026-10-04T03:00:00Z");
const parse = (text: string, extra: Record<string, unknown> = {}) =>
  parseSmartCapture(text, { now: NOW, timezone: "Asia/Jakarta", ...extra });

describe("parseMoneyId", () => {
  it("akhiran k/rb/ribu/jt/juta", () => {
    expect(parseMoneyId("47k")).toBe(47000);
    expect(parseMoneyId("25rb")).toBe(25000);
    expect(parseMoneyId("25 ribu")).toBe(25000);
    expect(parseMoneyId("2jt")).toBe(2000000);
    expect(parseMoneyId("1,5jt")).toBe(1500000);
    expect(parseMoneyId("1.5jt")).toBe(1500000);
  });
  it("awalan Rp dengan titik ribuan", () => {
    expect(parseMoneyId("Rp 12.500")).toBe(12500);
    expect(parseMoneyId("Rp1.250.000")).toBe(1250000);
  });
  it("angka polos dan input tidak valid", () => {
    expect(parseMoneyId("12500")).toBe(12500);
    expect(parseMoneyId("abc")).toBeNull();
    expect(parseMoneyId("")).toBeNull();
    expect(parseMoneyId(null)).toBeNull();
  });
});

describe("findMoneyMentions", () => {
  it("menemukan beberapa nominal dalam satu kalimat", () => {
    const found = findMoneyMentions("habis 47k dan burger 10k");
    expect(found.map((f) => f.amount)).toEqual([47000, 10000]);
  });
  it("angka polos (jam, jumlah) bukan uang", () => {
    expect(findMoneyMentions("rapat jam 7 dengan 3 orang")).toHaveLength(0);
  });
  it("Rp tanpa akhiran terbaca", () => {
    expect(findMoneyMentions("bayar Rp 150.000 ke warung")[0].amount).toBe(150000);
  });
});

describe("tanggal relatif", () => {
  it("besok / lusa / hari ini", () => {
    expect(parse("kirim laporan besok").dueDate).toBe("2026-10-05");
    expect(parse("servis motor lusa").dueDate).toBe("2026-10-06");
    expect(parse("bayar tagihan hari ini").dueDate).toBe("2026-10-04");
    expect(parse("call mom tomorrow").dueDate).toBe("2026-10-05");
  });
  it("N hari/minggu lagi dan in N days", () => {
    expect(parse("servis 3 hari lagi").dueDate).toBe("2026-10-07");
    expect(parse("cek 2 minggu lagi").dueDate).toBe("2026-10-18");
    expect(parse("follow up in 5 days").dueDate).toBe("2026-10-09");
  });
  it("nama hari = kemunculan terdekat SETELAH hari ini", () => {
    expect(parse("meeting jumat").dueDate).toBe("2026-10-09");
    expect(parse("meeting Senin depan").dueDate).toBe("2026-10-05");
    expect(parse("baca buku hari minggu").dueDate).toBe("2026-10-11"); // hari ini Minggu → minggu depan
  });
  it("tanggal eksplisit ISO dan dd/mm", () => {
    expect(parse("deadline 2026-12-01").dueDate).toBe("2026-12-01");
    expect(parse("kumpul 12/10").dueDate).toBe("2026-10-12");
    expect(parse("kumpul 12/10/2027").dueDate).toBe("2027-10-12");
    expect(parse("ulang tahun 1/3").dueDate).toBe("2027-03-01"); // sudah lewat tahun ini → tahun depan
  });
  it("'tanggal N' memilih tanggal terdekat yang belum lewat", () => {
    expect(parse("bayar listrik tanggal 20").dueDate).toBe("2026-10-20");
    expect(parse("bayar cicilan tanggal 2").dueDate).toBe("2026-11-02");
  });
  it("tanggal tidak valid diabaikan", () => {
    expect(parse("rapat 31/02").dueDate).toBeNull();
  });
});

describe("kombinasi nama hari + tanggal", () => {
  it("cocok → dipakai", () => {
    expect(parse("Sabtu tanggal 24 ada acara").dueDate).toBe("2026-10-24");
    expect(parse("senin tgl 26 rapat").dueDate).toBe("2026-10-26");
  });
  it("tidak cocok dalam 62 hari → tidak menebak, teks utuh", () => {
    const r = parse("Sabtu tanggal 26 ada acara keluarga");
    expect(r.dueDate).toBeNull();
    expect(r.title).toBe("Sabtu tanggal 26 ada acara keluarga");
  });
});

describe("jam", () => {
  it("jam dengan keterangan pagi/siang/sore/malam", () => {
    expect(parse("sarapan jam 7 pagi").dueTime).toBe("07:00");
    expect(parse("makan jam 1 siang").dueTime).toBe("13:00");
    expect(parse("makan jam 12 siang").dueTime).toBe("12:00");
    expect(parse("pulang jam 5 sore").dueTime).toBe("17:00");
    expect(parse("tidur jam 10 malam").dueTime).toBe("22:00");
    expect(parse("bangun jam 12 malam").dueTime).toBe("00:00");
  });
  it("format 19.30, 19:30, 7pm, 7:30pm, at 7am", () => {
    expect(parse("rapat jam 19.30").dueTime).toBe("19:30");
    expect(parse("rapat 19:30").dueTime).toBe("19:30");
    expect(parse("call at 7pm").dueTime).toBe("19:00");
    expect(parse("call 7:30pm").dueTime).toBe("19:30");
    expect(parse("run at 7am").dueTime).toBe("07:00");
  });
  it("jam tidak valid ditolak", () => {
    expect(parse("jam 25 sesuatu").dueTime).toBeNull();
    expect(parse("jam 7.75").dueTime).toBeNull();
  });
  it("'malam ini' memberi tanggal hari ini dan jam default 19:00", () => {
    const r = parse("belajar malam ini");
    expect(r.dueDate).toBe("2026-10-04");
    expect(r.dueTime).toBe("19:00");
  });
});

describe("prioritas dan tag", () => {
  it("penanda eksplisit dibuang dari judul", () => {
    expect(parse("kirim laporan !1").priority).toBe("high");
    expect(parse("kirim laporan !1").title).toBe("kirim laporan");
    expect(parse("cuci baju p3").priority).toBe("low");
    expect(parse("review prioritas rendah").priority).toBe("low");
    expect(parse("review priority high").priority).toBe("high");
  });
  it("kata urgent memengaruhi prioritas tetapi tetap ada di judul", () => {
    const r = parse("urgent perbaiki server");
    expect(r.priority).toBe("high");
    expect(r.title).toBe("urgent perbaiki server");
  });
  it("tidak ada penanda → null", () => {
    expect(parse("beli sayur").priority).toBeNull();
  });
  it("#tag diekstrak, unik, huruf kecil, dan bisa dipertahankan", () => {
    const r = parse("rapat #Kerja #kerja #proyek-x");
    expect(r.tags).toEqual(["kerja", "proyek-x"]);
    expect(r.title).toBe("rapat");
    expect(parse("rapat #kerja", { stripTags: false }).title).toBe("rapat #kerja");
  });
  it("tanda pagar di tengah kata bukan tag", () => {
    expect(parse("c#sharp belajar").tags).toEqual([]);
  });
});

describe("judul bersih dan chips", () => {
  it("contoh lengkap", () => {
    const r = parse("kirim laporan besok jam 7 malam !1 #kerja");
    expect(r.title).toBe("kirim laporan");
    expect(r.dueDate).toBe("2026-10-05");
    expect(r.dueTime).toBe("19:00");
    expect(r.priority).toBe("high");
    expect(r.chips.map((c) => c.kind)).toEqual(["date", "time", "tag", "priority"]);
    expect(r.chips[0].label).toBe("Besok");
  });
  it("teks tanpa penanda tidak berubah dan tanpa chip", () => {
    const r = parse("halo apa kabar");
    expect(r.title).toBe("halo apa kabar");
    expect(r.chips).toHaveLength(0);
  });
  it("jika semua teks terpakai sebagai penanda, judul kembali ke teks asli", () => {
    expect(parse("besok jam 7").title).toBe("besok jam 7");
  });
  it("kata 'minggu' polos tidak dianggap hari Minggu", () => {
    expect(parse("review minggu ini").dueDate).toBeNull();
  });
  it("uang tidak dibuang dari judul tetapi tersedia sebagai amount + chip", () => {
    const r = parse("beli kopi 25rb pakai gopay");
    expect(r.title).toBe("beli kopi 25rb pakai gopay");
    expect(r.amount).toBe(25000);
    expect(r.chips.some((c) => c.kind === "money" && c.label === "Rp 25.000")).toBe(true);
  });
  it("deterministik untuk input yang sama", () => {
    expect(parse("meeting jumat jam 14.30")).toEqual(parse("meeting jumat jam 14.30"));
  });
});

describe("utilitas tanggal & ISO", () => {
  it("addDaysYmd melewati batas bulan dan tahun", () => {
    expect(addDaysYmd("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysYmd("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysYmd("2028-02-28", 1)).toBe("2028-02-29");
  });
  it("formatChipDate", () => {
    expect(formatChipDate("2026-10-04", "2026-10-04")).toBe("Hari ini");
    expect(formatChipDate("2026-10-05", "2026-10-04")).toBe("Besok");
    expect(formatChipDate("2026-10-09", "2026-10-04")).toBe("Jum, 9 Okt");
    expect(formatChipDate("2027-01-05", "2026-10-04")).toBe("Sel, 5 Jan 2027");
  });
  it("smartDueAtIso: jam default 09:00 WIB = 02:00 UTC", () => {
    expect(smartDueAtIso({ dueDate: "2026-10-05", dueTime: null })).toBe("2026-10-05T02:00:00.000Z");
    expect(smartDueAtIso({ dueDate: "2026-10-05", dueTime: "19:00" })).toBe("2026-10-05T12:00:00.000Z");
    expect(smartDueAtIso({ dueDate: "2026-10-05", dueTime: "19:00" }, "Asia/Makassar")).toBe(
      "2026-10-05T11:00:00.000Z",
    );
    expect(smartDueAtIso({ dueDate: null, dueTime: "19:00" })).toBeNull();
  });
  it("zona waktu memengaruhi 'hari ini' (23:30 UTC sudah besok di WIB)", () => {
    const late = new Date("2026-10-04T23:30:00Z");
    expect(parseSmartCapture("tes hari ini", { now: late, timezone: "Asia/Jakarta" }).dueDate).toBe("2026-10-05");
  });
});
