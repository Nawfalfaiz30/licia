import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin, assertJsonSize } from "@/lib/security";

export async function GET(req: Request) {
  const origin = enforceSameOrigin(req);
  if (origin) return origin;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const { data, error } = await supabase.from("ai_saved_searches").select("id,name,query,filters,pinned,created_at,updated_at")
    .eq("user_id", user.id).order("pinned", { ascending:false }).order("updated_at", { ascending:false });
  if (error) return NextResponse.json({ error: "Daftar pintar gagal dibaca." }, { status: 500 });
  return NextResponse.json({ searches: data || [] });
}

export async function POST(req: Request) {
  const origin = enforceSameOrigin(req);
  if (origin) return origin;
  const size = assertJsonSize(req, 32 * 1024);
  if (size) return size;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const name = String(body?.name || "").trim().slice(0,100);
  const query = String(body?.query || "").trim().slice(0,1000);
  if (!name || !query) return NextResponse.json({ error: "Nama dan query diperlukan." }, { status:400 });
  const { data, error } = await supabase.from("ai_saved_searches").insert({
    user_id:user.id, name, query, filters: body?.filters && typeof body.filters === "object" ? body.filters : {}, pinned:body?.pinned === true
  }).select("id,name,query,filters,pinned,created_at,updated_at").single();
  if (error) return NextResponse.json({ error: "Daftar pintar gagal dibuat." }, { status:500 });
  return NextResponse.json({ ok:true, search:data }, { status:201 });
}

export async function PATCH(req: Request) {
  const origin = enforceSameOrigin(req);
  if (origin) return origin;
  const size = assertJsonSize(req, 32 * 1024);
  if (size) return size;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const id = String(body?.id || "");
  if (!id) return NextResponse.json({ error: "ID tidak valid." }, { status:400 });
  const patch:any = { updated_at:new Date().toISOString() };
  if (body.name !== undefined) patch.name = String(body.name).trim().slice(0,100);
  if (body.query !== undefined) patch.query = String(body.query).trim().slice(0,1000);
  if (body.filters !== undefined) patch.filters = body.filters && typeof body.filters === "object" ? body.filters : {};
  if (body.pinned !== undefined) patch.pinned = body.pinned === true;
  const { data, error } = await supabase.from("ai_saved_searches").update(patch).eq("id",id).eq("user_id",user.id)
    .select("id,name,query,filters,pinned,created_at,updated_at").single();
  if (error) return NextResponse.json({ error:"Daftar pintar gagal diperbarui." },{status:500});
  return NextResponse.json({ok:true,search:data});
}

export async function DELETE(req: Request) {
  const origin = enforceSameOrigin(req);
  if (origin) return origin;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const id = String(new URL(req.url).searchParams.get("id") || "");
  if (!id) return NextResponse.json({ error:"ID tidak valid." },{status:400});
  const { error } = await supabase.from("ai_saved_searches").delete().eq("id",id).eq("user_id",user.id);
  if (error) return NextResponse.json({error:"Daftar pintar gagal dihapus."},{status:500});
  return NextResponse.json({ok:true});
}
