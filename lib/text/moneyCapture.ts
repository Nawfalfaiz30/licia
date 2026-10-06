/**
 * Dari teks bebas yang memuat nominal ("beli kopi 47k") menjadi muatan pengeluaran/pemasukan (v0.57).
 * Murni dan konservatif: hanya menyarankan, tidak pernah menyimpan sendiri.
 */
import { findMoneyMentions } from "@/lib/text/smartParse";

export type MoneyKind = "expense" | "income";

const INCOME_HINT = /\b(gaji|salary|bonus|terima|diterima|dapat|dapet|masuk|transferan masuk|cashback|refund|dividen|income|received|earned|payment received)\b/i;
const EXPENSE_HINT = /\b(beli|bayar|belanja|makan|minum|jajan|bensin|parkir|tagihan|ongkir|langganan|top ?up|isi|buy|bought|pay|paid|spent|lunch|dinner|coffee|bill)\b/i;

/** Tebakan arah arus uang; null bila tidak jelas (UI menawarkan keduanya). */
export function guessMoneyKind(text: string): MoneyKind | null {
  const income = INCOME_HINT.test(text);
  const expense = EXPENSE_HINT.test(text);
  if (income && !expense) return "income";
  if (expense && !income) return "expense";
  return null;
}

const NOISE = /\b(hari ini|besok|lusa|kemarin|tomorrow|today|yesterday|(?:jam|pukul)\s*\d{1,2}(?:[.:]\d{2})?(?:\s*(?:pagi|siang|sore|malam))?|\d{1,2}(?:[.:]\d{2})?\s*(?:am|pm))\b/gi;

export type MoneyDraft = { kind: MoneyKind; amount: number; label: string; note: string };

/** Label ringkas (kategori/sumber) = teks tanpa nominal, penanda tanggal/jam, !prioritas, dan #tag. */
export function buildMoneyDraft(text: string, kind: MoneyKind, amount?: number): MoneyDraft | null {
  const mentions = findMoneyMentions(text);
  const value = amount ?? mentions[0]?.amount ?? null;
  if (!value || value <= 0) return null;
  let rest = text;
  for (const m of mentions) rest = rest.replace(m.raw, " ");
  rest = rest.replace(/![123]\b/g, " ").replace(/#[\p{L}\p{N}_-]+/gu, " ").replace(NOISE, " ").replace(/\s{2,}/g, " ").trim();
  rest = rest.replace(/^(?:untuk|buat|di|ke|for|on)\s+/i, "").trim();
  const label = (rest || (kind === "income" ? "Pemasukan" : "Lainnya")).slice(0, 60);
  return { kind, amount: value, label: label.charAt(0).toUpperCase() + label.slice(1), note: text.trim().slice(0, 240) };
}

/** Muatan siap kirim ke mutateEntity (entityType "expense" | "income"). */
export function moneyPayload(draft: MoneyDraft, occurredAt: string = new Date().toISOString()): Record<string, unknown> {
  const base = { amount: draft.amount, note: draft.note, occurred_at: occurredAt };
  return draft.kind === "expense" ? { ...base, category: draft.label } : { ...base, source: draft.label };
}
