import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin, rateLimit } from "@/lib/security";
import { selectAiModel } from "@/lib/ai/modelRouter";
import { chatCompletion, generationOptions, logCompletionFinish, withOpenAIRetry } from "@/lib/ai/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
let client: OpenAI | null = null;
function aiClient() {
  if (client) return client;
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("AI belum dikonfigurasi di server.");
  client = new OpenAI({ apiKey: key });
  return client;
}

function fallback(title: string) {
  return {
    summary: `“${title}” bisa dipecah menjadi langkah kecil yang jelas.`,
    priority: "medium",
    estimated_minutes: 25,
    steps: [
      "Tentukan hasil akhir yang ingin dianggap selesai.",
      "Kerjakan bagian utama terlebih dahulu.",
      "Periksa hasil lalu tandai tugas selesai.",
    ],
  };
}

export async function POST(req: Request) {
  const sameOrigin = enforceSameOrigin(req);
  if (sameOrigin) return sameOrigin;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const gate = rateLimit(`task-assist:${user.id}`, 40, 60_000);
  if (gate) return gate;
  let body: any = {};
  try {
    body = await req.json();
  } catch {}
  const taskId = String(body?.taskId || "");
  if (!taskId) return NextResponse.json({ error: "taskId diperlukan." }, { status: 400 });
  const { data: task } = await supabase
    .from("tasks")
    .select("id,title,description,status,priority,due_at,estimated_minutes,project_id")
    .eq("user_id", user.id)
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return NextResponse.json({ error: "Tugas tidak ditemukan." }, { status: 404 });
  const { data: project } = task.project_id
    ? await supabase
        .from("projects")
        .select("name,status,target_date,goal_id")
        .eq("user_id", user.id)
        .eq("id", task.project_id)
        .maybeSingle()
    : { data: null };
  let result = fallback(String(task.title));
  if (process.env.OPENAI_API_KEY) {
    try {
      const model = selectAiModel({
        text: "Pecah tugas menjadi langkah praktis",
        domains: ["tasks", "projects"],
        mode: "planner",
      });
      const completion = await withOpenAIRetry(
        () =>
          chatCompletion(aiClient(), {
            model,
            ...generationOptions(model, 0.15),
            max_completion_tokens: 420,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  "Kamu membantu pengguna menyusun satu tugas menjadi langkah-langkah praktis. Jangan membuat data yang tidak diberikan. Maksimal 4 langkah. Jika deadline/priority tersedia, berikan saran priority dan estimasi menit yang masuk akal. JSON: {summary:string,priority:'low'|'medium'|'high',estimated_minutes:number,steps:string[]}",
              },
              { role: "user", content: JSON.stringify({ task, project }) },
            ],
          }),
        1,
      );
      logCompletionFinish(completion, "tasks-assist");
      const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
      if (typeof parsed.summary === "string" && parsed.summary.trim()) result.summary = parsed.summary.trim();
      if (["low", "medium", "high"].includes(parsed.priority)) result.priority = parsed.priority;
      if (Number.isFinite(Number(parsed.estimated_minutes)))
        result.estimated_minutes = Math.max(10, Math.min(240, Math.round(Number(parsed.estimated_minutes))));
      if (Array.isArray(parsed.steps) && parsed.steps.length)
        result.steps = parsed.steps
          .map((x: any) => String(x).trim())
          .filter(Boolean)
          .slice(0, 4);
    } catch {}
  }
  return NextResponse.json(
    { ok: true, taskId, taskTitle: task.title, plan: result },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
