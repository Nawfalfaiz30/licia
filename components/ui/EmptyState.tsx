"use client";

import { useLanguage } from "@/components/LanguageProvider";
import { QUICK_CAPTURE_EVENT, type QuickCaptureRequest } from "@/lib/shortcuts";

/**
 * Keadaan kosong yang mengajak bertindak (A7). `examples` tampil sebagai chip; mengkliknya membuka Simpan Cepat
 * dengan teks itu sudah terisi (mode lewat `exampleMode`), sehingga halaman kosong tidak menjadi jalan buntu.
 */
export function EmptyState({ title, description, action, examples, exampleMode = "task" }: {
  title: string;
  description: string;
  action?: React.ReactNode;
  examples?: string[];
  exampleMode?: NonNullable<QuickCaptureRequest["mode"]>;
}) {
  const { t } = useLanguage();
  return (
    <div className="rounded-2xl border border-dashed border-border p-8 text-center">
      <p className="mb-1 font-display text-lg text-text">{t(title)}</p>
      <p className="mb-4 text-sm text-textMuted">{t(description)}</p>
      {examples && examples.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-2xs font-bold uppercase tracking-[.14em] text-textMuted">{t("Coba salah satu")}</p>
          <ul className="flex flex-wrap justify-center gap-2">
            {examples.map((example) => (
              <li key={example}>
                <button type="button" onClick={() => window.dispatchEvent(new CustomEvent(QUICK_CAPTURE_EVENT, { detail: { mode: exampleMode, text: t(example) } as QuickCaptureRequest }))} className="min-h-9 rounded-full border border-accent/25 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/15">
                  “{t(example)}”
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {action}
    </div>
  );
}
