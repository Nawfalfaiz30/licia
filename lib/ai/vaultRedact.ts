import { isEncrypted } from "@/lib/crypto/vaultCrypto";

/** Konten Vault terenkripsi tidak berguna (dan boros token) bagi AI; ganti dengan penanda. */
export function redactVaultContent(content: string | null | undefined): string {
  if (isEncrypted(content)) return "[terenkripsi — hanya bisa dibuka pengguna di halaman Vault]";
  return content || "";
}
