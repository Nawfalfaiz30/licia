import type OpenAI from "openai";
import { toolDefs } from "@/lib/ai/toolDefinitions";

type ToolDef = OpenAI.Chat.Completions.ChatCompletionTool;
type JsonSchema = Record<string, any>;

function strictifySchema(schema: JsonSchema): JsonSchema {
  if (!schema || typeof schema !== "object") return schema;
  const out: JsonSchema = { ...schema };
  if (out.type === "object" && out.properties && typeof out.properties === "object") {
    const properties: Record<string, JsonSchema> = {};
    for (const [name, child] of Object.entries(out.properties)) {
      const transformed = strictifySchema(child as JsonSchema);
      const originalRequired = new Set(Array.isArray(out.required) ? out.required : []);
      properties[name] = originalRequired.has(name)
        ? transformed
        : { anyOf: [transformed, { type: "null" }] };
    }
    out.properties = properties;
    out.required = Object.keys(properties);
    out.additionalProperties = false;
  }
  if (out.items) out.items = strictifySchema(out.items);
  if (Array.isArray(out.anyOf)) out.anyOf = out.anyOf.map((item: any) => strictifySchema(item));
  return out;
}

export const AI_TOOL_SCHEMA_VERSION = "2026-10-07.1";

export const toolDefsRegistry = toolDefs;

export function getStrictToolDefs(defs: ToolDef[] = toolDefsRegistry): ToolDef[] {
  return defs.map((def) => ({
    ...def,
    function: {
      ...def.function,
      strict: true,
      parameters: strictifySchema((def.function?.parameters || {}) as JsonSchema),
    },
  })) as ToolDef[];
}

export function getToolCatalog(defs: ToolDef[] = toolDefsRegistry) {
  return defs.map((def) => ({
    name: def.function?.name || "",
    description: def.function?.description || "",
    schemaVersion: AI_TOOL_SCHEMA_VERSION,
  })).filter((item) => item.name);
}

export function assertToolRegistryHealthy(defs: ToolDef[] = toolDefsRegistry) {
  const names = defs.map((def) => def.function?.name).filter(Boolean) as string[];
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  if (duplicates.length) throw new Error("Duplikasi tool AI: " + [...new Set(duplicates)].join(", "));
  for (const def of defs) {
    if (!def.function?.name || !def.function?.parameters) throw new Error("Tool AI tanpa name/parameters.");
  }
  return { ok: true, count: names.length, schemaVersion: AI_TOOL_SCHEMA_VERSION };
}
