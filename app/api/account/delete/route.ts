import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertJsonSize, enforceSameOrigin, rateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

/** Kata konfirmasi yang diterima (Indonesia atau English, tanpa membedakan huruf besar-kecil). */
const CONFIRM_WORDS = new Set(["HAPUS", "DELETE"]);

/**
 * Hapus akun dan seluruh data (E2, UU PDP No. 27/2022). Semua tabel data merujuk auth.users dengan
 * ON DELETE CASCADE, jadi menghapus pengguna Auth menghapus seluruh barisnya.
 * Aman dari salah-klik: wajib kata konfirmasi, same-origin, dan batas laju ketat.
 */
export async function POST(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const sizeError = assertJsonSize(req, 2_000);
  if (sizeError) return sizeError;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const gate = rateLimit(`account-delete:${user.id}`, 3, 10 * 60_000);
  if (gate) return gate;

  const body = await req.json().catch(() => ({}));
  const word = String(body?.confirm ?? "").trim().toUpperCase();
  if (!CONFIRM_WORDS.has(word)) return NextResponse.json({ error: "Kata konfirmasi tidak cocok." }, { status: 400 });

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal menghapus akun." }, { status: 500 });
  }

  // Bersihkan cookie sesi di perangkat ini (pengguna Auth sudah tidak ada).
  await supabase.auth.signOut().catch(() => undefined);
  return NextResponse.json({ ok: true });
}
