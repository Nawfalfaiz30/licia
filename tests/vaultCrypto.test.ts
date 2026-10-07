import { describe, it, expect } from "vitest";
import {
  createVaultSession,
  encryptText,
  decryptText,
  isEncrypted,
  saltOf,
  ENC_PREFIX,
  LEGACY_ENC_PREFIX,
  PBKDF2_ITERATIONS,
  LEGACY_PBKDF2_ITERATIONS,
  upgradeVaultEnvelope,
  deriveVaultKey,
  vaultEnvelopeVersion,
} from "@/lib/crypto/vaultCrypto";
import { redactVaultContent } from "@/lib/ai/vaultRedact";

function b64(bytes: Uint8Array): string {
  let s = "";
  for (const byte of bytes) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

describe("vaultCrypto", () => {
  it("uses the versioned v2 envelope and decrypts correctly", async () => {
    const session = await createVaultSession("kata sandi rahasia");
    const envelope = await encryptText("PIN ATM 1234 — jangan bocor 🔐", session);
    expect(isEncrypted(envelope)).toBe(true);
    expect(envelope.startsWith(ENC_PREFIX)).toBe(true);
    expect(vaultEnvelopeVersion(envelope)).toBe(2);
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(600_000);
    expect(await decryptText(envelope, "kata sandi rahasia")).toBe("PIN ATM 1234 — jangan bocor 🔐");
  });

  it("keeps legacy v1 envelopes readable and upgradeable", async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveVaultKey("pw", salt, LEGACY_PBKDF2_ITERATIONS);
    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, new TextEncoder().encode("legacy")),
    );
    const envelope = LEGACY_ENC_PREFIX + b64(salt) + ":" + b64(iv) + ":" + b64(ciphertext);
    expect(vaultEnvelopeVersion(envelope)).toBe(1);
    expect(await decryptText(envelope, "pw")).toBe("legacy");
    const upgraded = await upgradeVaultEnvelope(envelope, "pw");
    expect(upgraded?.startsWith(ENC_PREFIX)).toBe(true);
    expect(await decryptText(upgraded!, "pw")).toBe("legacy");
  });

  it("passphrase salah menghasilkan null", async () => {
    const session = await createVaultSession("benar");
    const envelope = await encryptText("data", session);
    expect(await decryptText(envelope, "salah")).toBeNull();
  });

  it("amplop dimodifikasi menghasilkan null (integritas GCM)", async () => {
    const session = await createVaultSession("benar");
    const envelope = await encryptText("data", session);
    const tampered = envelope.slice(0, -2) + (envelope.endsWith("AA") ? "BB" : "AA");
    expect(await decryptText(tampered, "benar")).toBeNull();
  });

  it("IV acak: dua enkripsi teks yang sama berbeda, salt sesi sama", async () => {
    const session = await createVaultSession("pw");
    const a = await encryptText("sama", session);
    const b = await encryptText("sama", session);
    expect(a === b).toBe(false);
    expect(Array.from(saltOf(a)!)).toEqual(Array.from(saltOf(b)!));
  });

  it("cache kunci dipakai ulang tanpa mengubah hasil", async () => {
    const session = await createVaultSession("pw");
    const envelope = await encryptText("x", session);
    const cache = new Map<string, CryptoKey>();
    expect(await decryptText(envelope, "pw", cache)).toBe("x");
    expect(cache.size).toBe(1);
    expect(await decryptText(envelope, "pw", cache)).toBe("x");
  });

  it("teks biasa dikembalikan apa adanya", async () => {
    expect(await decryptText("halo", "pw")).toBe("halo");
    expect(isEncrypted("halo")).toBe(false);
  });
});

describe("redactVaultContent", () => {
  it("menyembunyikan konten terenkripsi dari AI, membiarkan teks biasa", () => {
    expect(redactVaultContent("enc:v1:abc:def:ghi").includes("terenkripsi")).toBe(true);
    expect(redactVaultContent("enc:v2:abc:def:ghi").includes("terenkripsi")).toBe(true);
    expect(redactVaultContent("catatan biasa")).toBe("catatan biasa");
    expect(redactVaultContent(null)).toBe("");
  });
});
