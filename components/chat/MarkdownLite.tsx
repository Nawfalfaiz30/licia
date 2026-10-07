"use client";
// Parser markdown ringan untuk bubble chat (V55).
// Mendukung: **bold**, *italic*, `code`, [tautan](https://…), heading (ditampilkan tebal),
// daftar bullet/bernomor, checklist "- [ ]" / "- [x]", dan tabel pipe.
// Tidak ada raw HTML: semua teks dirender lewat React sehingga otomatis ter-escape.
import React from "react";
import { useLanguage } from "@/components/LanguageProvider";

const INLINE = /(\*\*([^*]+)\*\*)|(\*([^*\s][^*]*)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)\s]+)\))/g;

function safeHref(raw: string): string | null {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = new RegExp(INLINE.source, "g");
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const k = `${keyPrefix}-${i++}`;
    if (match[2] !== undefined) parts.push(<strong key={k}>{match[2]}</strong>);
    else if (match[4] !== undefined) parts.push(<em key={k}>{match[4]}</em>);
    else if (match[6] !== undefined)
      parts.push(
        <code key={k} className="rounded bg-black/10 px-1 py-0.5 text-[0.9em] dark:bg-white/10">
          {match[6]}
        </code>,
      );
    else if (match[8] !== undefined) {
      const href = safeHref(match[9]);
      parts.push(
        href ? (
          <a
            key={k}
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="underline underline-offset-2"
          >
            {match[8]}
          </a>
        ) : (
          match[8]
        ),
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const isTableSep = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l) && l.includes("-");
const splitRow = (l: string) =>
  l
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

export function MarkdownLite({ text }: { text: string | null | undefined }) {
  const { t: tr } = useLanguage();
  const lines = (text ?? "").split("\n");
  const nodes: React.ReactNode[] = [];
  let idx = 0;

  while (idx < lines.length) {
    const line = lines[idx];

    // Tabel: baris header + baris pemisah + baris data
    if (isTableRow(line) && idx + 1 < lines.length && isTableSep(lines[idx + 1])) {
      const header = splitRow(line);
      const rows: string[][] = [];
      let j = idx + 2;
      while (j < lines.length && isTableRow(lines[j])) {
        rows.push(splitRow(lines[j]));
        j += 1;
      }
      const key = `t${idx}`;
      nodes.push(
        <div key={key} className="my-1 max-w-full overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full border-collapse text-left text-[0.92em]">
            <thead className="bg-black/5 dark:bg-white/5">
              <tr>
                {header.map((h, c) => (
                  <th key={c} className="px-2 py-1 font-semibold">
                    {renderInline(h, `${key}h${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-t border-border/50">
                  {header.map((_, c) => (
                    <td key={c} className="px-2 py-1 align-top">
                      {renderInline(r[c] ?? "", `${key}r${ri}c${c}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      idx = j;
      continue;
    }

    const headingMatch = /^#{1,6}\s+(.*)/.exec(line);
    const checkMatch = /^\s*[-*•]\s+\[( |x|X)\]\s+(.*)/.exec(line);
    const bulletMatch = /^\s*[-•*]\s+(.*)/.exec(line);
    const numberedMatch = /^\s*(\d+)[.)]\s+(.*)/.exec(line);

    if (headingMatch) {
      nodes.push(
        <div key={idx} className="font-semibold pt-1">
          {renderInline(headingMatch[1], `l${idx}`)}
        </div>,
      );
    } else if (checkMatch) {
      const done = checkMatch[1].toLowerCase() === "x";
      nodes.push(
        <div key={idx} className="flex gap-1.5 pl-1">
          <span aria-hidden className="shrink-0 opacity-70">
            {done ? "☑" : "☐"}
          </span>
          <span className="sr-only">{done ? tr("Selesai: ") : tr("Belum: ")}</span>
          <span className={done ? "line-through opacity-60" : undefined}>{renderInline(checkMatch[2], `l${idx}`)}</span>
        </div>,
      );
    } else if (bulletMatch) {
      nodes.push(
        <div key={idx} className="flex gap-1.5 pl-1">
          <span className="opacity-60">•</span>
          <span>{renderInline(bulletMatch[1], `l${idx}`)}</span>
        </div>,
      );
    } else if (numberedMatch) {
      nodes.push(
        <div key={idx} className="flex gap-1.5 pl-1">
          <span className="opacity-60 shrink-0">{numberedMatch[1]}.</span>
          <span>{renderInline(numberedMatch[2], `l${idx}`)}</span>
        </div>,
      );
    } else if (line.trim() === "") {
      nodes.push(<div key={idx} className="h-1" />);
    } else {
      nodes.push(<div key={idx}>{renderInline(line, `l${idx}`)}</div>);
    }
    idx += 1;
  }

  return <div className="space-y-1">{nodes}</div>;
}
