import { chatDelete, chatGet, chatPost } from "@/lib/ai/chatOrchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export const GET = chatGet;
export const DELETE = chatDelete;
export const POST = chatPost;
