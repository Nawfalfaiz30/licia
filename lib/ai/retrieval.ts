import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RetrievalHit = {
  source_type: string;
  source_id: string;
  title: string;
  content: string;
  score: number;
};

function getClient() {
  const key = process.env.OPENAI_API_KEY?.trim();
  return key ? new OpenAI({ apiKey: key }) : null;
}

async function embedQuery(query: string): Promise<number[] | null> {
  const client = getClient();
  if (!client || !query.trim()) return null;
  try {
    const model = process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small";
    const result = await client.embeddings.create({ model, input: query.slice(0, 8000) });
    return result.data[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

export async function hybridSearch(
  supabase: SupabaseClient,
  query: string,
  limit = 20,
): Promise<{ hits: RetrievalHit[]; mode: "hybrid" | "fts" | "none"; error?: string }> {
  const normalized = query.trim().slice(0, 1000);
  if (!normalized) return { hits: [], mode: "none" };

  const embedding = await embedQuery(normalized);
  const { data, error } = await supabase.rpc("licia_hybrid_search", {
    p_query: normalized,
    p_embedding: embedding,
    p_limit: Math.max(1, Math.min(limit, 100)),
  });
  if (!error && Array.isArray(data)) {
    return {
      hits: data.map((row: any) => ({
        source_type: String(row.source_type || ""),
        source_id: String(row.source_id || ""),
        title: String(row.title || ""),
        content: String(row.content || "").slice(0, 4000),
        score: Number(row.score || 0),
      })),
      mode: embedding ? "hybrid" : "fts",
    };
  }
  return { hits: [], mode: embedding ? "hybrid" : "fts", error: error?.message };
}

export async function upsertKnowledgeDocument(
  supabase: SupabaseClient,
  input: { userId: string; sourceType: string; sourceId: string; title?: string; content?: string; sourceHash?: string; embed?: boolean },
) {
  const title = String(input.title || "").slice(0, 500);
  const content = String(input.content || "").slice(0, 20000);
  const body: Record<string, unknown> = {
    user_id: input.userId,
    source_type: input.sourceType,
    source_id: input.sourceId,
    title,
    content,
    source_hash: input.sourceHash ?? null,
    updated_at: new Date().toISOString(),
  };
  if (input.embed !== false) {
    const embedding = await embedQuery((title + "\n" + content).slice(0, 8000));
    if (embedding) body.embedding = embedding;
  }
  return supabase.from("ai_knowledge_index").upsert(body, { onConflict: "user_id,source_type,source_id" });
}

export async function removeKnowledgeDocument(
  supabase: SupabaseClient,
  input: { userId: string; sourceType: string; sourceId: string },
) {
  return supabase.from("ai_knowledge_index")
    .delete()
    .eq("user_id", input.userId)
    .eq("source_type", input.sourceType)
    .eq("source_id", input.sourceId);
}
