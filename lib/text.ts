export function stripMarkdown(value: string | null | undefined): string {
  if (!value) return "";
  return String(value)
    .replace(/\\([_*#`>\[\]()])/g, "$1")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/gs, "$1")
    .replace(/__(.*?)__/gs, "$1")
    .replace(/~~(.*?)~~/gs, "$1")
    .replace(/`{1,3}([^`]+)`{1,3}/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function previewPlainText(value: string | null | undefined, max = 180): string {
  const clean = stripMarkdown(value);
  return clean.length > max ? `${clean.slice(0, Math.max(0, max - 1)).trimEnd()}…` : clean;
}
