"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookMarked,
  ExternalLink,
  FileText,
  Filter,
  Link2,
  Pin,
  PinOff,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  Lock,
  Unlock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, EmptyState, PrimaryButton, SectionTitle, TextInput } from "@/components/ui";
import { mutateEntity } from "@/lib/sync/client";
import { previewPlainText } from "@/lib/text";
import {
  createVaultSession,
  decryptText,
  encryptText,
  isEncrypted,
  saltOf,
  type VaultSession,
} from "@/lib/crypto/vaultCrypto";

import { useLanguage } from "@/components/LanguageProvider";
type Vault = {
  id: string;
  title: string;
  item_type: "note" | "link" | "snippet" | "document";
  content: string | null;
  source_url: string | null;
  tags: string[];
  pinned: boolean;
  updated_at: string;
  version?: number;
};
const kinds = [
  { v: "all", l: "Semua" },
  { v: "note", l: "Catatan" },
  { v: "link", l: "Link" },
  { v: "snippet", l: "Snippet" },
  { v: "document", l: "Dokumen" },
];
export default function VaultPage() {
  const { t: tr, locale } = useLanguage();
  const supabase = createClient();
  const [rows, setRows] = useState<Vault[]>([]);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", type: "note" as Vault["item_type"], content: "", url: "", tags: "" });
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<VaultSession | null>(null);
  const [plain, setPlain] = useState<Record<string, string>>({});
  const [pass, setPass] = useState("");
  const [unlockErr, setUnlockErr] = useState("");
  const [encNew, setEncNew] = useState(false);
  const passRef = useRef("");
  async function load() {
    const { data } = await supabase
      .from("vault_items")
      .select("id,title,item_type,content,source_url,tags,pinned,updated_at,version")
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false });
    setRows((data as Vault[]) ?? []);
  }
  useEffect(() => {
    load();
  }, []);
  // V55: enkripsi sisi klien. Passphrase hanya di memori; terkunci otomatis saat tab disembunyikan.
  async function unlock() {
    setUnlockErr("");
    if (pass.length < 8) {
      setUnlockErr("Minimal 8 karakter.");
      return;
    }
    const enc = rows.filter((r) => isEncrypted(r.content));
    let sess: VaultSession;
    if (enc.length) {
      const salt = saltOf(enc[0].content as string);
      if (!salt) {
        setUnlockErr(tr("Data terenkripsi tidak valid."));
        return;
      }
      if ((await decryptText(enc[0].content as string, pass)) === null) {
        setUnlockErr("Passphrase salah.");
        return;
      }
      sess = await createVaultSession(pass, salt);
    } else sess = await createVaultSession(pass);
    passRef.current = pass;
    setPass("");
    setSession(sess);
  }
  function lock() {
    passRef.current = "";
    setSession(null);
    setPlain({});
    setEncNew(false);
  }
  useEffect(() => {
    if (!session) return;
    let dead = false;
    (async () => {
      const cache = new Map<string, CryptoKey>();
      const out: Record<string, string> = {};
      for (const r of rows) {
        if (isEncrypted(r.content)) {
          const t = await decryptText(r.content as string, passRef.current, cache);
          if (t !== null) out[r.id] = t;
        }
      }
      if (!dead) setPlain(out);
    })();
    return () => {
      dead = true;
    };
  }, [rows, session]);
  useEffect(() => {
    const h = () => {
      if (document.hidden) lock();
    };
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
  }, []);
  const shown = (r: Vault) => (isEncrypted(r.content) ? (plain[r.id] ?? "") : r.content || "");
  async function uid() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error(tr("Belum masuk"));
    return user.id;
  }
  async function add() {
    if (!form.title.trim()) return;
    setBusy(true);
    let contentValue: string | null = form.content.trim() || null;
    if (encNew && contentValue) {
      if (!session) {
        setUnlockErr(tr("Buka kunci Vault dulu."));
        setBusy(false);
        return;
      }
      contentValue = await encryptText(contentValue, session);
    }
    await mutateEntity({
      entityType: "vault",
      operation: "create",
      payload: {
        title: form.title.trim(),
        item_type: form.type,
        content: contentValue,
        source_url: form.url.trim() || null,
        tags: form.tags
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
      },
    });
    setForm({ title: "", type: "note", content: "", url: "", tags: "" });
    setOpen(false);
    setBusy(false);
    load();
  }
  async function remove(id: string) {
    await mutateEntity({ entityType: "vault", operation: "delete", entityId: id });
    load();
  }
  async function pin(r: Vault) {
    await mutateEntity({
      entityType: "vault",
      operation: "update",
      entityId: r.id,
      baseVersion: r.version ?? null,
      clientUpdatedAt: r.updated_at,
      payload: { pinned: !r.pinned },
    });
    load();
  }
  async function importFile(file: File) {
    setBusy(true);
    try {
      const text = await file.text();
      setForm((v) => ({
        ...v,
        title: file.name.replace(/\.[^.]+$/, ""),
        type: "document",
        content: text.slice(0, 50000),
      }));
      setOpen(true);
    } finally {
      setBusy(false);
    }
  }
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (kind === "all" || r.item_type === kind) &&
        (!pinnedOnly || r.pinned) &&
        (!s || `${r.title} ${shown(r)} ${(r.tags || []).join(" ")} ${r.source_url || ""}`.toLowerCase().includes(s)),
    );
  }, [rows, q, kind, pinnedOnly, plain]);
  const notes = rows.filter((r) => r.item_type === "note").length;
  const links = rows.filter((r) => r.item_type === "link").length;
  const pinned = rows.filter((r) => r.pinned).length;
  return (
    <div className="licia-v33-page-in space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            <BookMarked size={14} /> {tr("PENGETAHUAN PRIBADI")}
          </p>
          <h1 className="font-display text-3xl text-text">{tr("Licia Vault")}</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-textMuted">
            {tr(
              "Vault bukan gudang dump. Ia adalah perpustakaan pribadi untuk hal yang ingin ditemukan lagi, diringkas, dan menjadi konteks bagi keputusan atau percakapan berikutnya.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-xs font-semibold text-textMuted hover:border-accent hover:text-accent">
            <UploadCloud size={15} />
            {busy ? tr("Membaca…") : tr("Impor teks")}
            <input
              type="file"
              accept=".txt,.md,.csv,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importFile(f);
                e.currentTarget.value = "";
              }}
            />
          </label>
          <PrimaryButton onClick={() => setOpen((v) => !v)}>
            <Plus size={16} /> {tr("Simpan")}
          </PrimaryButton>
        </div>
      </header>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-textMuted">{tr("Total")}</p>
          <p className="mt-1 font-display text-2xl text-text">{rows.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-textMuted">{tr("Catatan")}</p>
          <p className="mt-1 font-display text-2xl text-accent">{notes}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-textMuted">{tr("Link")}</p>
          <p className="mt-1 font-display text-2xl text-text">{links}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-textMuted">{tr("Pinned")}</p>
          <p className="mt-1 font-display text-2xl text-accent">{pinned}</p>
        </Card>
      </div>
      <Card>
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" />
            <TextInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={tr("Cari judul, isi, tag, atau URL…")}
              className="pl-9"
            />
          </div>
          <div className="flex min-w-0 gap-2 overflow-x-auto no-scrollbar">
            <Filter size={14} className="mt-3 shrink-0 text-textMuted" />
            {kinds.map((k) => (
              <button
                key={k.v}
                onClick={() => setKind(k.v)}
                className={
                  kind === k.v
                    ? "shrink-0 rounded-lg bg-accent px-3 py-2 text-2xs font-semibold text-white"
                    : "shrink-0 rounded-lg border border-border bg-bg px-3 py-2 text-2xs font-semibold text-textMuted hover:text-text"
                }
              >
                {k.l}
              </button>
            ))}
            <button
              onClick={() => setPinnedOnly((v) => !v)}
              className={
                pinnedOnly
                  ? "shrink-0 rounded-lg bg-accent/10 px-3 py-2 text-2xs font-semibold text-accent"
                  : "shrink-0 rounded-lg border border-border bg-bg px-3 py-2 text-2xs font-semibold text-textMuted"
              }
            >
              <Pin size={12} className="mr-1 inline" />
              {tr("Pinned")}
            </button>
          </div>
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-text">
            {session ? <Unlock size={16} className="text-accent" /> : <Lock size={16} className="text-textMuted" />}
            <span className="font-semibold">{session ? tr("Vault terbuka") : tr("Enkripsi Vault")}</span>
            <span className="text-xs text-textMuted">
              {session
                ? tr("Item terenkripsi dapat dibaca. Terkunci otomatis saat tab ditutup/disembunyikan.")
                : tr("Item terenkripsi dikunci di perangkat dan tidak dibaca AI.")}
            </span>
          </div>
          {session ? (
            <button
              onClick={lock}
              className="min-h-11 rounded-xl border border-border px-3 text-xs font-semibold text-textMuted hover:text-accent"
            >
              {tr("Kunci sekarang")}
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void unlock();
                }}
                autoComplete="off"
                placeholder={tr("Passphrase (min. 8 karakter)")}
                aria-label={tr("Passphrase Vault")}
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-bg px-3 text-sm text-text outline-none focus:ring-2 focus:ring-accent/40"
              />
              <PrimaryButton onClick={() => void unlock()}>{tr("Buka kunci")}</PrimaryButton>
            </div>
          )}
        </div>
        {unlockErr && (
          <p role="alert" className="mt-2 text-xs text-danger">
            {unlockErr}
          </p>
        )}
        {!session && (
          <p className="mt-2 text-2xs text-textMuted">
            {tr("Peringatan: jika passphrase hilang, item terenkripsi tidak dapat dipulihkan.")}
          </p>
        )}
      </Card>
      {open && (
        <Card>
          <SectionTitle>{tr("Simpan pengetahuan")}</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2">
            <TextInput
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={tr("Judul")}
            />
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as Vault["item_type"] })}
              className="min-h-11 rounded-xl border border-border bg-bg px-3 text-sm text-text"
            >
              {kinds.slice(1).map((k) => (
                <option key={k.v} value={k.v}>
                  {k.l}
                </option>
              ))}
            </select>
            <TextInput
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder={tr("URL (opsional)")}
            />
            <TextInput
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder={tr("Tag, pisahkan koma")}
            />
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={7}
              placeholder={tr("Isi, ringkasan, atau snippet…")}
              className="sm:col-span-2 w-full resize-none rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <div className="mt-3 flex items-center justify-end gap-3">
            <label className="flex items-center gap-1.5 text-xs text-textMuted">
              <input
                type="checkbox"
                checked={encNew}
                disabled={!session}
                onChange={(e) => setEncNew(e.target.checked)}
              />{" "}
              {tr("Enkripsi isi")}
              {!session ? tr(" (buka kunci dulu)") : ""}
            </label>
            <PrimaryButton disabled={busy} onClick={add}>
              {busy ? tr("Menyimpan…") : tr("Simpan ke Vault")}
            </PrimaryButton>
          </div>
        </Card>
      )}
      <SectionTitle
        action={
          <span className="text-xs text-textMuted">
            {tr("{visible_length} item", { visible_length: visible.length })}
          </span>
        }
      >
        {tr("Pustaka pribadi")}
      </SectionTitle>
      {!visible.length ? (
        <EmptyState
          title={tr("Vault masih kosong atau filter terlalu sempit")}
          description={tr("Simpan catatan, link, snippet, atau dokumen kecil yang sering ingin kamu temukan kembali.")}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map((r) => (
            <Card key={r.id} className="min-w-0 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-accent/10 p-2 text-accent">
                  {r.item_type === "link" ? <Link2 size={17} /> : <FileText size={17} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-bg px-2 py-1 text-2xs text-textMuted">{r.item_type}</span>
                    {r.pinned && (
                      <span className="rounded-full bg-accent/10 px-2 py-1 text-2xs text-accent">{tr("Pinned")}</span>
                    )}
                  </div>
                  <p className="mt-2 break-words text-sm font-semibold text-text">{r.title}</p>
                  {isEncrypted(r.content) ? (
                    plain[r.id] !== undefined ? (
                      <p className="mt-1 line-clamp-4 break-words text-xs leading-relaxed text-textMuted">
                        <Unlock size={11} className="mr-1 inline" />
                        {previewPlainText(plain[r.id], 420)}
                      </p>
                    ) : (
                      <p className="mt-1 flex items-center gap-1 text-xs text-textMuted">
                        <Lock size={12} /> {tr("Terenkripsi — buka kunci untuk membaca")}
                      </p>
                    )
                  ) : (
                    r.content && (
                      <p className="mt-1 line-clamp-4 break-words text-xs leading-relaxed text-textMuted">
                        {previewPlainText(r.content, 420)}
                      </p>
                    )
                  )}
                  {(r.tags || []).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {r.tags.map((tag) => (
                        <span key={tag} className="rounded-full border border-border px-2 py-1 text-2xs text-textMuted">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {r.source_url && (
                    <a
                      href={r.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex max-w-full items-center gap-1 text-2xs font-semibold text-accent"
                    >
                      <span className="truncate">{tr("Buka sumber")}</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                  <p className="mt-3 text-2xs text-textMuted">
                    {tr("Diperbarui")}{" "}
                    {new Date(r.updated_at).toLocaleDateString(locale, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => pin(r)}
                    className="rounded-lg p-2 text-textMuted hover:text-accent"
                    title={r.pinned ? tr("Lepas pin") : tr("Pin")}
                  >
                    {r.pinned ? <PinOff size={15} /> : <Pin size={15} />}
                  </button>
                  <button
                    onClick={() => remove(r.id)}
                    className="rounded-lg p-2 text-textMuted hover:text-danger"
                    title={tr("Hapus")}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Card className="border-accent/20 bg-accent/5">
        <div className="flex gap-3">
          <Sparkles size={18} className="mt-0.5 shrink-0 text-accent" />
          <div>
            <p className="text-sm font-semibold text-text">{tr("Vault + AI")}</p>
            <p className="mt-1 text-xs leading-relaxed text-textMuted">
              {tr(
                "Chat Licia dapat diarahkan untuk mencari konteks dari Vault ketika pertanyaanmu berkaitan dengan pengetahuan pribadi. Itu membuat AI lebih berguna tanpa perlu mengirim seluruh isi Vault di setiap pesan.",
              )}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
