// Client-side Vault encryption: AES-GCM 256 + versioned PBKDF2-SHA256.
// v2 raises the KDF work factor while keeping v1 envelopes readable.
// Passphrases never leave the device; forgetting the passphrase remains unrecoverable
// unless an application-level recovery/key-wrapping layer is configured later.

export const ENC_PREFIX = "enc:v2:";
export const LEGACY_ENC_PREFIX = "enc:v1:";
export const KDF_VERSION = 2;
export const PBKDF2_ITERATIONS = 600_000;
export const LEGACY_PBKDF2_ITERATIONS = 310_000;

const te = new TextEncoder();
const td = new TextDecoder();

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && (value.startsWith(ENC_PREFIX) || value.startsWith(LEGACY_ENC_PREFIX));
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

function envelopeParts(envelope: string) {
  const prefix = envelope.startsWith(ENC_PREFIX)
    ? ENC_PREFIX
    : envelope.startsWith(LEGACY_ENC_PREFIX)
      ? LEGACY_ENC_PREFIX
      : null;
  if (!prefix) return null;
  const parts = envelope.slice(prefix.length).split(":");
  return parts.length === 3 ? { prefix, parts } : null;
}

export async function deriveVaultKey(
  passphrase: string,
  salt: Uint8Array,
  iterations = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", te.encode(passphrase.normalize("NFKC")), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export type VaultSession = { salt: Uint8Array; key: CryptoKey; kdfVersion?: number; iterations?: number };

export async function createVaultSession(passphrase: string, salt?: Uint8Array): Promise<VaultSession> {
  const s = salt ?? crypto.getRandomValues(new Uint8Array(16));
  return {
    salt: s,
    key: await deriveVaultKey(passphrase, s, PBKDF2_ITERATIONS),
    kdfVersion: KDF_VERSION,
    iterations: PBKDF2_ITERATIONS,
  };
}

export async function encryptText(plain: string, session: VaultSession): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, session.key, te.encode(plain)),
  );
  return ENC_PREFIX + b64(session.salt) + ":" + b64(iv) + ":" + b64(ct);
}

export function saltOf(envelope: string): Uint8Array | null {
  const parsed = envelopeParts(envelope);
  if (!parsed) return null;
  try {
    return unb64(parsed.parts[0]);
  } catch {
    return null;
  }
}

export function vaultEnvelopeVersion(envelope: string): 1 | 2 | null {
  if (envelope.startsWith(ENC_PREFIX)) return 2;
  if (envelope.startsWith(LEGACY_ENC_PREFIX)) return 1;
  return null;
}

export async function decryptText(
  envelope: string,
  passphrase: string,
  cache?: Map<string, CryptoKey>,
): Promise<string | null> {
  if (!isEncrypted(envelope)) return envelope;
  const parsed = envelopeParts(envelope);
  if (!parsed) return null;
  try {
    const salt = unb64(parsed.parts[0]);
    const iterations = parsed.prefix === LEGACY_ENC_PREFIX ? LEGACY_PBKDF2_ITERATIONS : PBKDF2_ITERATIONS;
    const cacheKey = parsed.prefix + parsed.parts[0] + ":" + iterations;
    let key = cache?.get(cacheKey);
    if (!key) {
      key = await deriveVaultKey(passphrase, salt, iterations);
      cache?.set(cacheKey, key);
    }
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: unb64(parsed.parts[1]) as BufferSource },
      key,
      unb64(parsed.parts[2]) as BufferSource,
    );
    return td.decode(pt);
  } catch {
    return null;
  }
}

// A deterministic migration path for UI flows: decrypt the old envelope and re-encrypt
// with v2 in one user-controlled operation.
export async function upgradeVaultEnvelope(
  envelope: string,
  passphrase: string,
  cache?: Map<string, CryptoKey>,
): Promise<string | null> {
  if (vaultEnvelopeVersion(envelope) !== 1) return envelope;
  const plain = await decryptText(envelope, passphrase, cache);
  if (plain == null) return null;
  const session = await createVaultSession(passphrase);
  return encryptText(plain, session);
}
