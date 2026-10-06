import { detectAiDomains, type AiDomain } from "@/lib/ai/toolRouting";

export type ConversationOperation =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "link"
  | "plan"
  | "analyze"
  | "unknown";

export type ConversationState = {
  activeDomain: AiDomain;
  activeOperation: ConversationOperation;
  activeEntityIds: string[];
  activeLabels: string[];
  lastUserText: string;
  lastActionTools: string[];
  updatedAt: number;
};

export type ConversationDecision = {
  state: ConversationState;
  currentDomains: AiDomain[];
  effectiveDomains: AiDomain[];
  topicSwitched: boolean;
  followUp: boolean;
  currentOperation: ConversationOperation;
  mutationExpected: boolean;
  destructiveIntent: boolean;
  contextInstruction: string;
};

const DOMAIN_SET = new Set<AiDomain>([
  "tasks", "calendar", "focus", "finance", "health", "goals", "projects", "notes", "inbox",
  "decisions", "learning", "reading", "habits", "memory", "vault", "automations", "reminders",
  "notifications", "subscriptions", "overview", "all",
]);

const mutationPattern = /\b(buat|buatkan|catat|simpan|tambah|tambahkan|masukkan|input|jadwalkan|ingatkan|log|check[-\s]?in|centang|tandai|ubah|edit|update|ganti|pindah|atur|hapus|delete|buang|hilangkan|arsipkan|hubungkan|jadikan|konversi|convert)\b/i;
const deletePattern = /\b(hapus|delete|buang|hilangkan|hapuskan)\b/i;
const createPattern = /\b(buat|buatkan|catat|simpan|tambah|tambahkan|masukkan|input|jadwalkan|ingatkan|log|check[-\s]?in)\b/i;
const updatePattern = /\b(ubah|edit|update|ganti|pindah|atur|arsipkan|aktifkan|nonaktifkan|matikan|nyalakan|hubungkan|jadikan|konversi|convert|tandai|centang|selesaikan)\b/i;
const planPattern = /\b(rencanakan|susun|rapikan|prioritaskan|atur ulang|jadikan rencana|plan|planner)\b/i;
const followUpPattern = /\b(yang tadi|yg tadi|tadi|itu|ini|yang itu|yang ini|seperti tadi|sama seperti|sebelumnya|lanjut|lanjutkan|ubah lagi|tambahkan lagi|tambahkan juga|hapus yang tadi|pindahkan yang tadi|catatannya|keterangannya|deskripsinya|judulnya|namanya|statusnya|kategorinya|jumlahnya|nominalnya|tanggalnya|waktunya|jamnya)\b/i;
const shortFollowUpPattern = /^(iya|ya|oke|ok|siap|gas|lanjut|lanjutkan|buatkan|jalankan|terapkan|yang tadi|itu|ini|ubah|ganti|tambahkan|hapus|pindahkan|jamnya|tanggalknya|tanggalnya|namanya|jumlahnya|catatannya|keterangannya|deskripsinya|judulnya|statusnya|kategorinya|nominalnya|waktunya)\b/i;
const propertyFollowUpPattern = /\b(?:ubah|ganti|edit|update|atur|setel)\s+(?:catatan|keterangan|deskripsi|judul|nama|status|kategori|jumlah|nominal|tanggal|waktu|jam)(?:nya)?\b/i;
const explicitNotesIntentPattern = /\b(?:buat|bikin|tulis|simpan|tambahkan|catat)\s+(?:sebuah\s+)?(?:catatan|note)\b|\b(?:catatan|note)\s+(?:baru|saya|aku)\b/i;
const explicitConfirmationPattern = /^(?:iya|ya|y|oke|ok|siap|gas|setuju|setujui|konfirmasi|confirm|eksekusi|jalankan|terapkan)(?:[\s.!?,]|$)/i;
const assistantMutationProposalPattern = /\b(?:mau|ingin|boleh|bisa)\s+(?:aku|saya|kita)\b[\s\S]{0,140}\b(?:buat|buatkan|catat|simpan|tambah|tambahkan|ubah|edit|ganti|update|atur|pindah|hapus|hapuskan|delete|jadwalkan|tandai|centang|selesaikan|jalankan|ingatkan|hubungkan)\b|\b(?:mau|ingin)\s+(?:aku|saya|kita)\b[\s\S]{0,140}\b(?:selesai|terapkan)\b/i;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function sanitizeEntityIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter((id) => UUID_PATTERN.test(id)).slice(0, 8);
}

function inferDomainFromRecentAssistant(text: string) {
  const q = String(text || '').toLowerCase();
  if (/\b(jumlah|kategori|catatan|tanggal|waktu)\s*:/i.test(q) && /\brp\.?\s*[0-9]/i.test(q)) return 'finance' as AiDomain;
  if (/\b(agenda|jadwal|kalender|tanggal|waktu)\s*:/i.test(q) && /\b(?:jam|pukul)\b/i.test(q)) return 'calendar' as AiDomain;
  if (/\b(tugas|deadline|tenggat|prioritas)\s*:/i.test(q)) return 'tasks' as AiDomain;
  return null;
}

function inferMutationProposalOperation(text: string): ConversationOperation | null {
  const q = String(text || '').toLowerCase();
  if (!assistantMutationProposalPattern.test(q)) return null;
  if (/\b(?:hapus|hapuskan|delete|buang|hilangkan)\b/i.test(q)) return "delete";
  if (/\b(?:ubah|edit|ganti|update|atur|pindah|tandai|centang|selesaikan|aktifkan|nonaktifkan)\b/i.test(q)) return "update";
  if (/\b(?:buat|buatkan|catat|simpan|tambah|tambahkan|jadwalkan|ingatkan|jalankan|hubungkan)\b/i.test(q)) return "create";
  return null;
}

function domainFromState(state?: Partial<ConversationState> | null) {
  const value = state?.activeDomain;
  return value && DOMAIN_SET.has(value) ? value : null;
}

function hasExplicitDomain(domains: AiDomain[]) {
  return domains.some((domain) => domain !== "overview" && domain !== "all");
}
function prioritizeDomains(message: string, domains: AiDomain[]) {
  const q = message.toLocaleLowerCase("id-ID");
  const financeStrong = /\b(pengeluaran|pemasukan|keuangan|saldo|dompet|rekening|budget|anggaran|rupiah|rp\.?|idr|transaksi|biaya|harga|bayar|dibayar|belanja|beli|jajan|habis|spent|spend)\b/i.test(q)
    || /\b\d+(?:[.,]\d+)?\s*(?:k|rb|ribu|jt|juta)\b/i.test(q);
  const calendarStrong = /\b(jadwal|agenda|kalender|schedule|meeting|rapat|kelas|kuliah|waktu|jam|pukul|besok|lusa|senin|selasa|rabu|kamis|jumat|sabtu|minggu|tanggal)\b/i.test(q);
  const taskStrong = /\b(tugas|task|todo|deadline|tenggat|subtugas|kerjaan|pekerjaan)\b/i.test(q);
  const healthExplicit = /\b(kesehatan|hidrasi|kalori|nutrisi|gizi|obat|tekanan darah|denyut|tidur|olahraga|gerak|air minum|berat badan)\b/i.test(q);
  const out = [...domains];

  // Ambiguous everyday nouns such as "makan" or "kopi" can activate health.
  // An explicit money/current-record request wins unless the user explicitly
  // asks for a health record in the same message.
  if (financeStrong && !healthExplicit) {
    return out.filter((domain) => domain !== "health");
  }

  // Keep the current explicit domain narrow for mutation requests. This avoids
  // exposing unrelated write schemas just because a word happens to match more
  // than one domain. Cross-domain reads remain available when the wording asks
  // for a relation/overview.
  const crossDomain = /\b(hubungkan|gabungkan|dari .* ke |buat (tugas|agenda|pengingat) dari|jadikan .* (tugas|agenda|pengingat)|lintas|sekalian|beserta|dan juga)\b/i.test(q)
    || /\b(tugas|task)\b[\s\S]{0,40}\b(agenda|jadwal|kalender)\b|\b(agenda|jadwal|kalender)\b[\s\S]{0,40}\b(tugas|task)\b/i.test(q);
  if (!crossDomain) {
    if (calendarStrong && out.includes("calendar")) {
      return out.filter((domain) => domain === "calendar" || domain === "overview");
    }
    if (taskStrong && out.includes("tasks")) {
      return out.filter((domain) => domain === "tasks" || domain === "overview");
    }
  }

  return out;
}

function resolveOperation(text: string): ConversationOperation {
  if (deletePattern.test(text)) return "delete";
  if (updatePattern.test(text)) return "update";
  if (createPattern.test(text)) return "create";
  if (planPattern.test(text)) return "plan";
  if (/\b(analisis|analisa|kenapa|bandingkan|evaluasi|pola|insight|ringkas)\b/i.test(text)) return "analyze";
  if (/\b(hubungkan|terkait|dari .* ke |jadikan .* tugas|jadikan .* agenda)\b/i.test(text)) return "link";
  return "read";
}

function extractEntityHints(text: string) {
  const hints: string[] = [];
  const quoted = text.match(/["“”']([^"“”']{2,100})["“”']/g) ?? [];
  for (const item of quoted.slice(0, 4)) hints.push(item.replace(/^["“”']|["“”']$/g, ""));
  return hints;
}

export function buildConversationDecision(input: {
  message: string;
  state?: Partial<ConversationState> | null;
  recentAssistantText?: string | null;
}): ConversationDecision {
  const message = String(input.message || "").trim();
  let previousDomain = domainFromState(input.state);
  const propertyFollowUp = propertyFollowUpPattern.test(message);
  const recentAssistantText = String(input.recentAssistantText || "");
  const recentProposalOperation = inferMutationProposalOperation(recentAssistantText);
  const confirmsRecentMutationProposal = explicitConfirmationPattern.test(message) && Boolean(recentProposalOperation);
  const recentAssistantDomain = inferDomainFromRecentAssistant(recentAssistantText);
  // Recover a stale client context when an older turn clearly displayed a domain-specific
  // record. This is especially important for property edits like "ganti catatannya".
  if (propertyFollowUp && recentAssistantDomain && (!previousDomain || previousDomain === "notes")) previousDomain = recentAssistantDomain;

  let currentDomains = prioritizeDomains(message, detectAiDomains(message).filter((domain) => domain !== "overview"));
  // Words such as "catatan" are also fields inside Finance, Tasks, Calendar, etc.
  // A possessive property edit ("catatannya", "keterangannya", "jumlahnya") must stay
  // in the active domain unless the user explicitly asks to create/manage a Note.
  if (propertyFollowUp && previousDomain && previousDomain !== "notes" && !explicitNotesIntentPattern.test(message)) {
    currentDomains = currentDomains.filter((domain) => domain !== "notes");
    if (!currentDomains.length) currentDomains = [previousDomain];
  }

  const explicit = hasExplicitDomain(currentDomains);
  const resolvedCurrentOperation = resolveOperation(message);
  const currentOperation = resolvedCurrentOperation === "read" && confirmsRecentMutationProposal
    ? (recentProposalOperation || resolvedCurrentOperation)
    : resolvedCurrentOperation;
  const followUp = Boolean(previousDomain && (
    propertyFollowUp ||
    (!explicit || followUpPattern.test(message) || shortFollowUpPattern.test(message)) && (followUpPattern.test(message) || shortFollowUpPattern.test(message) || message.length < 42)
  ));
  const topicSwitched = Boolean(previousDomain && explicit && currentDomains[0] !== previousDomain && !propertyFollowUp);

  const effectiveDomains: AiDomain[] = propertyFollowUp && previousDomain && !explicitNotesIntentPattern.test(message)
    ? [previousDomain]
    : explicit
      ? currentDomains
      : followUp && previousDomain
        ? [previousDomain]
        : currentDomains.length
          ? currentDomains
          : ["overview"];

  const activeDomain = effectiveDomains[0] ?? "overview";
  const activeOperation = currentOperation === "read" && input.state?.activeOperation && followUp
    ? input.state.activeOperation
    : currentOperation;

  const state: ConversationState = {
    activeDomain,
    activeOperation,
    activeEntityIds: sanitizeEntityIds(input.state?.activeEntityIds),
    activeLabels: [...new Set([...(Array.isArray(input.state?.activeLabels) ? input.state!.activeLabels! : []), ...extractEntityHints(message)])].slice(-6),
    lastUserText: message.slice(0, 1200),
    lastActionTools: Array.isArray(input.state?.lastActionTools) ? input.state!.lastActionTools!.slice(0, 8) : [],
    updatedAt: Date.now(),
  };

  const mutationExpected = mutationPattern.test(message) || confirmsRecentMutationProposal;
  const destructiveIntent = deletePattern.test(message) || (confirmsRecentMutationProposal && recentProposalOperation === "delete");
  const contextInstruction = [
    `TOPIK AKTIF: ${activeDomain}.`,
    topicSwitched ? `PERGANTIAN TOPIK: ya. Topik sebelumnya (${previousDomain}) jangan dibawa sebagai intent aktif kecuali pengguna merujuknya secara eksplisit.` : "PERGANTIAN TOPIK: tidak terdeteksi.",
    followUp ? `PESAN LANJUTAN: ya. Gunakan konteks aktif sebelumnya hanya untuk referensi yang jelas.` : "PESAN LANJUTAN: tidak.",
    propertyFollowUp ? "EDIT PROPERTI: pertahankan domain dan entitas aktif; kata seperti catatan/keterangan/jumlah/tanggal adalah properti entity, bukan otomatis modul Notes." : "EDIT PROPERTI: tidak terdeteksi.",
    "PRIORITAS PEMAHAMAN: pesan pengguna saat ini > konteks aktif > percakapan lama. Jangan gunakan nomor urut daftar sebagai database ID.",
    confirmsRecentMutationProposal ? "KONFIRMASI AKSI: pengguna mengonfirmasi aksi mutation yang baru saja ditawarkan pada balasan sebelumnya. Pertahankan domain/entity dan jalankan operasi yang ditawarkan; jangan kembali hanya ke mode baca." : mutationExpected ? "PENGGUNA MEMINTA AKSI DATA: jawaban sukses hanya boleh diberikan setelah tool mutation berhasil dan hasilnya terverifikasi." : "Tidak ada kewajiban mutation dari kata kerja utama pesan ini.",
  ].join("\n");

  return {
    state,
    currentDomains,
    effectiveDomains,
    topicSwitched,
    followUp,
    currentOperation: activeOperation,
    mutationExpected,
    destructiveIntent,
    contextInstruction,
  };
}

export function isLikelyTopicSwitch(message: string, previousDomain?: AiDomain | null) {
  const decision = buildConversationDecision({ message, state: previousDomain ? { activeDomain: previousDomain } : null });
  return decision.topicSwitched;
}
