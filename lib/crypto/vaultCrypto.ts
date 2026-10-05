// Enkripsi sisi klien untuk Vault (V55): AES-GCM 256 dengan kunci dari passphrase (PBKDF2-SHA256).
// Server hanya menyimpan amplop "enc:v1:<salt>:<iv>:<ciphertext>" — passphrase tidak pernah meninggalkan perangkat.
// Catatan: lupa passphrase = data tidak dapat dipulihkan (zero-knowledge).

export const ENC_PREFIX = "enc:v1:";
export const PBKDF2_ITERATIONS = 310_000;

const te = new TextEncoder();
const td = new TextDecoder();

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(ENC_PREFIX);
}

function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64(text: string): Uint8Array {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function deriveVaultKey(passphrase: string, salt: Uint8Array, iterations = PBKDF2_ITERATIONS): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", te.encode(passphrase.normalize("NFKC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Sesi terbuka: kunci diturunkan sekali per salt lalu dipakai ulang (hanya di memori). */
export type VaultSession = { salt: Uint8Array; key: CryptoKey };

export async function createVaultSession(passphrase: string, salt?: Uint8Array): Promise<VaultSession> {
  const s = salt ?? crypto.getRandomValues(new Uint8Array(16));
  return { salt: s, key: await deriveVaultKey(passphrase, s) };
}

export async function encryptText(plain: string, session: VaultSession): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, session.key, te.encode(plain)));
  return `${ENC_PREFIX}${b64(session.salt)}:${b64(iv)}:${b64(ct)}`;
}

export function saltOf(envelope: string): Uint8Array | null {
  if (!isEncrypted(envelope)) return null;
  const parts = envelope.slice(ENC_PREFIX.length).split(":");
  return parts.length === 3 ? unb64(parts[0]) : null;
}

/** Mengembalikan null bila passphrase salah atau data rusak (GCM menolak). */
export async function decryptText(envelope: string, passphrase: string, cache?: Map<string, CryptoKey>): Promise<string | null> {
  if (!isEncrypted(envelope)) return envelope;
  const parts = envelope.slice(ENC_PREFIX.length).split(":");
  if (parts.length !== 3) return null;
  try {
    const salt = unb64(parts[0]);
    const cacheKey = parts[0];
    let key = cache?.get(cacheKey);
    if (!key) { key = await deriveVaultKey(passphrase, salt); cache?.set(cacheKey, key); }
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(parts[1]) as BufferSource }, key, unb64(parts[2]) as BufferSource);
    return td.decode(pt);
  } catch {
    return null;
  }
}
