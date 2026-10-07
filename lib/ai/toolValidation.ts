export type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  additionalProperties?: boolean;
};

export type ToolValidationResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; code: "INVALID_TOOL_ARGUMENTS"; error: string; field?: string };

function typeMatches(value: unknown, schema: JsonSchema): boolean {
  if (value === null) return true;
  switch (schema.type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "array":
      return Array.isArray(value);
    case "object":
      return typeof value === "object" && !Array.isArray(value);
    default:
      return true;
  }
}

function validateValue(value: unknown, schema: JsonSchema, path: string, required: boolean): string | null {
  if (value === undefined) return required ? `${path} wajib diisi.` : null;
  if (value === null) return required ? `${path} tidak boleh null.` : null;
  if (!typeMatches(value, schema)) return `${path} harus bertipe ${schema.type || "JSON"}.`;
  if (schema.enum && !schema.enum.some((candidate) => Object.is(candidate, value))) {
    return `${path} memiliki nilai yang tidak diizinkan.`;
  }

  if (schema.type === "object" && schema.properties && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const requiredFields = new Set(schema.required ?? []);
    for (const field of Object.keys(schema.properties)) {
      const error = validateValue(obj[field], schema.properties[field], `${path}.${field}`, requiredFields.has(field));
      if (error) return error;
    }
    if (schema.additionalProperties === false) {
      const unknown = Object.keys(obj).find((field) => !(field in schema.properties!));
      if (unknown) return `${path}.${unknown} tidak dikenali oleh schema tool.`;
    }
  }

  if (schema.type === "array" && schema.items && Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const error = validateValue(value[index], schema.items, `${path}[${index}]`, true);
      if (error) return error;
    }
  }
  return null;
}

export function validateToolArguments(
  defs: Array<{ type?: string; function?: { name?: string; parameters?: JsonSchema } }>,
  toolName: string,
  args: unknown,
): ToolValidationResult {
  const def = defs.find((candidate) => candidate.function?.name === toolName);
  if (!def?.function?.parameters) {
    return { ok: false, code: "INVALID_TOOL_ARGUMENTS", error: `Schema tool "${toolName}" tidak ditemukan.` };
  }
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return { ok: false, code: "INVALID_TOOL_ARGUMENTS", error: "Argumen tool harus berupa object JSON.", field: "$" };
  }

  const schema = def.function.parameters;
  const error = validateValue(args, schema, "$", true);
  return error
    ? { ok: false, code: "INVALID_TOOL_ARGUMENTS", error }
    : { ok: true, value: args as Record<string, unknown> };
}
