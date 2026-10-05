export type ConflictStrategy = "server" | "latest" | "manual" | "smart";

export type ConflictInput = {
  current: Record<string, unknown>;
  incoming: Record<string, unknown>;
  clientVersion?: number | null;
  serverVersion?: number | null;
  clientUpdatedAt?: string | null;
};

export function safeStrategy(value: unknown): ConflictStrategy {
  return value === "latest" || value === "manual" || value === "smart" ? value : "server";
}

export function findConflictingFields(current: Record<string, unknown>, incoming: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(current), ...Object.keys(incoming)]);
  const ignored = new Set(["id", "user_id", "version", "created_at", "updated_at"]);
  return [...keys].filter((key) => {
    if (ignored.has(key) || !(key in incoming)) return false;
    return key in current && JSON.stringify(current[key]) !== JSON.stringify(incoming[key]);
  });
}

export function mergeIfSafe(
  input: ConflictInput,
  serverChangedFields?: string[] | null,
): { safe: boolean; payload: Record<string, unknown>; fields: string[] } {
  const fields = findConflictingFields(input.current, input.incoming);
  if (!fields.length) return { safe: true, payload: { ...input.incoming }, fields: [] };

  // When the server can tell us exactly which fields changed after the
  // client's base version, patches that touch different fields can be safely
  // merged. Without that change-set, remain conservative and ask the user.
  const changed = new Set((serverChangedFields || []).map(String));
  if (changed.size) {
    const overlap = fields.filter((field) => changed.has(field));
    if (!overlap.length) return { safe: true, payload: { ...input.incoming }, fields: [] };
    return { safe: false, payload: { ...input.incoming }, fields: overlap };
  }

  return { safe: false, payload: { ...input.incoming }, fields };
}

export function isClientNewer(clientUpdatedAt?: string | null, serverUpdatedAt?: string | null): boolean {
  if (!clientUpdatedAt) return false;
  const client = Date.parse(clientUpdatedAt);
  const server = Date.parse(serverUpdatedAt || "");
  return Number.isFinite(client) && (!Number.isFinite(server) || client > server);
}
