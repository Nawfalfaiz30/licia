import crypto from "node:crypto";

function keyBytes() {
  const raw = process.env.LICIA_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error("LICIA_TOKEN_ENCRYPTION_KEY belum dikonfigurasi.");
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length !== 32) throw new Error("LICIA_TOKEN_ENCRYPTION_KEY harus base64 32-byte.");
  return decoded;
}

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBytes(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return "v1:" + iv.toString("base64url") + ":" + tag.toString("base64url") + ":" + ciphertext.toString("base64url");
}

export function decryptSecret(payload: string) {
  const [version, ivText, tagText, bodyText] = String(payload || "").split(":");
  if (version !== "v1" || !ivText || !tagText || !bodyText) return null;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", keyBytes(), Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(bodyText, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function hmacSha256Hex(value: string) {
  return crypto.createHmac("sha256", keyBytes()).update(value).digest("hex");
}

export function sha256Hex(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}
