import { describe, it, expect } from "vitest";
import { createVaultSession, encryptText, decryptText, isEncrypted, saltOf, ENC_PREFIX } from "@/lib/crypto/vaultCrypto";
import { redactVaultContent } from "@/lib/ai/vaultRedact";

describe("vaultCrypto", () => {
  it("enkripsi lalu dekripsi mengembalikan teks asli (termasuk Unicode)", async () => {
    const s = await createVaultSession("kata sandi rahasia");
    const env = await encryptText("PIN ATM 1234 — jangan bocor 🔐", s);
    expect(isEncrypted(env)).toBe(true);
    expect(await decryptText(env, "kata sandi rahasia")).toBe("PIN ATM 1234 — jangan bocor 🔐");
  });
  it("passphrase salah menghasilkan null", async () => {
    const s = await createVaultSession("benar");
    const env = await encryptText("data", s);
    expect(await decryptText(env, "salah")).toBeNull();
  });
  it("amplop dimodifikasi menghasilkan null (integritas GCM)", async () => {
    const s = await createVaultSession("benar");
    const env = await encryptText("data", s);
    const tampered = env.slice(0, -2) + (env.endsWith("AA") ? "BB" : "AA");
    expect(await decryptText(tampered, "benar")).toBeNull();
  });
  it("IV acak: dua enkripsi teks yang sama berbeda, salt sesi sama", async () => {
    const s = await createVaultSession("pw");
    const a = await encryptText("sama", s);
    const b = await encryptText("sama", s);
    expect(a === b).toBe(false);
    expect(Array.from(saltOf(a)!)).toEqual(Array.from(saltOf(b)!));
  });
  it("cache kunci dipakai ulang tanpa mengubah hasil", async () => {
    const s = await createVaultSession("pw");
    const env = await encryptText("x", s);
    const cache = new Map<string, CryptoKey>();
    expect(await decryptText(env, "pw", cache)).toBe("x");
    expect(cache.size).toBe(1);
    expect(await decryptText(env, "pw", cache)).toBe("x");
  });
  it("teks biasa dikembalikan apa adanya", async () => {
    expect(await decryptText("halo", "pw")).toBe("halo");
    expect(isEncrypted("halo")).toBe(false);
    expect(ENC_PREFIX).toBe("enc:v1:");
  });
});

describe("redactVaultContent", () => {
  it("menyembunyikan konten terenkripsi dari AI, membiarkan teks biasa", () => {
    expect(redactVaultContent("enc:v1:abc:def:ghi").includes("terenkripsi")).toBe(true);
    expect(redactVaultContent("catatan biasa")).toBe("catatan biasa");
    expect(redactVaultContent(null)).toBe("");
  });
});
