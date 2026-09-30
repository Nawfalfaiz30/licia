// Parser markdown ringan khusus bubble chat — sengaja tidak pakai library besar
// karena cuma perlu menangani **bold**, *italic*, dan daftar "- item"/"1. item"
// yang biasa muncul dari balasan model, supaya tidak ada "**" mentah kelihatan.

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Urutan penting: bold (**) dicek sebelum italic (*) supaya tidak salah potong.
  const regex = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2] !== undefined) {
      parts.push(<strong key={`${keyPrefix}-b-${i++}`}>{match[2]}</strong>);
    } else if (match[4] !== undefined) {
      parts.push(<em key={`${keyPrefix}-i-${i++}`}>{match[4]}</em>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

export function MarkdownLite({ text }: { text: string | null | undefined }) {
  const lines = (text ?? "").split("\n");

  return (
    <div className="space-y-1">
      {lines.map((line, idx) => {
        const headingMatch = /^#{1,6}\s+(.*)/.exec(line);
        const bulletMatch = /^\s*[-•]\s+(.*)/.exec(line);
        const numberedMatch = /^\s*(\d+)\.\s+(.*)/.exec(line);

        if (headingMatch) {
          // Balasan chat bukan dokumen — heading ditampilkan sebagai teks tebal
          // biasa (tanpa tanda #), bukan heading berukuran besar seperti di editor.
          return (
            <div key={idx} className="font-semibold pt-1">
              {renderInline(headingMatch[1], `l${idx}`)}
            </div>
          );
        }
        if (bulletMatch) {
          return (
            <div key={idx} className="flex gap-1.5 pl-1">
              <span className="opacity-60">•</span>
              <span>{renderInline(bulletMatch[1], `l${idx}`)}</span>
            </div>
          );
        }
        if (numberedMatch) {
          return (
            <div key={idx} className="flex gap-1.5 pl-1">
              <span className="opacity-60 shrink-0">{numberedMatch[1]}.</span>
              <span>{renderInline(numberedMatch[2], `l${idx}`)}</span>
            </div>
          );
        }
        if (line.trim() === "") return <div key={idx} className="h-1" />;
        return <div key={idx}>{renderInline(line, `l${idx}`)}</div>;
      })}
    </div>
  );
}
