"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, CheckCircle2, ChevronDown, Lightbulb, Plus, Scale, Sparkles, Tag, Target, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { TextPromptDialog } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { Card, EmptyState, PrimaryButton, SectionTitle, TextInput } from "@/components/ui";

type Decision = {
  id: string; title: string; context: string | null; options: string[]; decision: string;
  confidence: number; review_date: string | null; outcome: string | null; created_at: string;
  tags: string[]; result_rating: number | null; goal_id: string | null; area_id: string | null;
};
type Goal = { id: string; title: string };
type Area = { id: string; name: string };
type Filter = "all" | "review" | "closed";
const blank = { title:"", context:"", decision:"", confidence:3, review_date:"", outcome:"", options:"", tags:"", goal_id:"", area_id:"", result_rating:"" };
const resultLabels = ["Tidak jelas", "Buruk", "Kurang sesuai", "Cukup", "Baik", "Sangat baik"];
function daysUntil(v:string|null){ if(!v) return null; return Math.ceil((new Date(`${v}T12:00:00`).getTime() - new Date().setHours(0,0,0,0))/86400000); }
function dateId(v:string){ return new Date(`${v}T12:00:00`).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}); }

export default function DecisionsPage(){
  const [outcomeDraft,setOutcomeDraft]=useState<{id:string;value:string;rating?:string}|null>(null); const [ratingDraft,setRatingDraft]=useState<{id:string;value:string;outcome:string}|null>(null);
  const supabase=createClient();
  const [rows,setRows]=useState<Decision[]>([]); const [goals,setGoals]=useState<Goal[]>([]); const [areas,setAreas]=useState<Area[]>([]);
  const [form,setForm]=useState(blank); const [open,setOpen]=useState(false); const [filter,setFilter]=useState<Filter>("all"); const [expanded,setExpanded]=useState<string|null>(null); const [saving,setSaving]=useState(false);
  async function load(){
    const [{data:d},{data:g},{data:a}] = await Promise.all([
      supabase.from("decisions").select("id,title,context,options,decision,confidence,review_date,outcome,created_at,tags,result_rating,goal_id,area_id").order("review_date",{ascending:true,nullsFirst:false}).order("created_at",{ascending:false}),
      supabase.from("goals").select("id,title").eq("status","active").order("title"),
      supabase.from("areas").select("id,name").order("name")
    ]);
    setRows((d as Decision[])??[]); setGoals((g as Goal[])??[]); setAreas((a as Area[])??[]);
  }
  useEffect(()=>{load()},[]);
  async function uid(){ const {data:{user}}=await supabase.auth.getUser(); if(!user) throw new Error("Belum masuk"); return user.id; }
  async function save(){
    if(saving||!form.title.trim()||!form.decision.trim()) return; setSaving(true);
    await supabase.from("decisions").insert({
      user_id:await uid(), title:form.title.trim(), context:form.context.trim()||null, decision:form.decision.trim(),
      options:form.options.split("\n").map(x=>x.trim()).filter(Boolean), confidence:form.confidence,
      review_date:form.review_date||null, outcome:form.outcome.trim()||null,
      tags:form.tags.split(",").map(x=>x.trim()).filter(Boolean), goal_id:form.goal_id||null, area_id:form.area_id||null,
      result_rating:form.result_rating?Number(form.result_rating):null
    });
    setForm(blank);setOpen(false);await load();setSaving(false);
  }
  async function update(id:string,patch:Record<string,unknown>){ await supabase.from("decisions").update({...patch,updated_at:new Date().toISOString()}).eq("id",id); await load(); }
  async function recordOutcome(row:Decision){
    setOutcomeDraft({id:row.id,value:row.outcome??"",rating:row.result_rating?String(row.result_rating):""});
  }

  async function submitOutcome(){
    if(!outcomeDraft) return;
    setRatingDraft({id:outcomeDraft.id,value:outcomeDraft.rating??"",outcome:outcomeDraft.value});
    setOutcomeDraft(null);
  }

  async function submitRating(){
    if(!ratingDraft) return;
    const parsed=ratingDraft.value.trim()?Math.max(1,Math.min(5,Number(ratingDraft.value))):null;
    await update(ratingDraft.id,{outcome:ratingDraft.outcome.trim()||null,result_rating:Number.isFinite(parsed as number)?parsed:null});
    setRatingDraft(null);
  }
  async function remove(id:string){await supabase.from("decisions").delete().eq("id",id);load()}
  const visible=useMemo(()=>rows.filter(r=>filter==="all"?true:filter==="closed"?Boolean(r.outcome):Boolean(r.review_date&&!r.outcome)),[rows,filter]);
  const dueCount=rows.filter(r=>r.review_date&&!r.outcome&&(daysUntil(r.review_date)??99)<=0).length;
  const reviewed=rows.filter(r=>r.outcome);
  const rated=reviewed.filter(r=>Number.isFinite(r.result_rating));
  const avgResult=rated.length?Math.round(rated.reduce((s,r)=>s+Number(r.result_rating||0),0)/rated.length*10)/10:null;
  const calibrated=rated.filter(r=>Math.abs(Number(r.result_rating)-Number(r.confidence))<=1).length;
  const lessons=reviewed.filter(r=>r.outcome).slice(0,3);

  return <div className="space-y-7">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent"><Scale size={14}/> Decide · Revisit · Learn</p><h1 className="font-display text-3xl text-text">Decision Journal</h1><p className="mt-1 max-w-3xl text-sm text-textMuted">Catat keputusan saat konteksnya masih segar, lalu kembali setelah hasilnya terlihat. Dengan begitu kamu bisa belajar dari proses, bukan sekadar mengingat hasil akhir.</p></div>
      <PrimaryButton onClick={()=>setOpen(v=>!v)}><Plus size={16}/> Keputusan baru</PrimaryButton>
    </header>

    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card className="p-4"><p className="text-xs text-textMuted">Keputusan</p><p className="mt-1 font-display text-2xl text-text">{rows.length}</p></Card>
      <Card className="p-4"><p className="text-xs text-textMuted">Perlu review</p><p className="mt-1 font-display text-2xl text-danger">{dueCount}</p></Card>
      <Card className="p-4"><p className="text-xs text-textMuted">Sudah ada hasil</p><p className="mt-1 font-display text-2xl text-success">{reviewed.length}</p></Card>
      <Card className="p-4"><p className="text-xs text-textMuted">Rata-rata hasil</p><p className="mt-1 font-display text-2xl text-accent">{avgResult??"—"}<span className="text-sm text-textMuted">/5</span></p></Card>
    </div>

    {open&&<Card className="border-accent/20 bg-accent/5"><SectionTitle>Bangun keputusan dengan konteks</SectionTitle><div className="grid gap-3">
      <TextInput value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Apa yang sedang diputuskan?"/>
      <textarea rows={3} value={form.context} onChange={e=>setForm({...form,context:e.target.value})} placeholder="Konteks: apa yang terjadi, siapa yang terdampak, dan batasannya?" className="w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text outline-none focus:ring-2 focus:ring-accent"/>
      <textarea rows={3} value={form.options} onChange={e=>setForm({...form,options:e.target.value})} placeholder="Alternatif yang dipertimbangkan — satu per baris" className="w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text outline-none focus:ring-2 focus:ring-accent"/>
      <div className="grid gap-3 lg:grid-cols-3"><textarea rows={3} value={form.decision} onChange={e=>setForm({...form,decision:e.target.value})} placeholder="Pilihan akhir + alasan utama" className="resize-none rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text outline-none focus:ring-2 focus:ring-accent"/><textarea rows={3} value={form.outcome} onChange={e=>setForm({...form,outcome:e.target.value})} placeholder="Hasil sudah diketahui? Isi sekarang atau nanti saat review." className="resize-none rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text outline-none focus:ring-2 focus:ring-accent"/><div className="grid gap-2"><div className="grid grid-cols-2 gap-2"><input type="date" value={form.review_date} onChange={e=>setForm({...form,review_date:e.target.value})} className="min-h-11 rounded-xl border border-border bg-surface px-3 text-sm text-text"/><select value={form.result_rating} onChange={e=>setForm({...form,result_rating:e.target.value})} className="min-h-11 rounded-xl border border-border bg-surface px-3 text-sm text-text"><option value="">Rating hasil</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n} / 5</option>)}</select></div><div className="flex flex-wrap gap-1.5">{[1,2,3,4,5].map(n=><button type="button" key={n} onClick={()=>setForm({...form,confidence:n})} className={clsx("h-8 w-8 rounded-lg border text-xs font-semibold",form.confidence===n?"border-accent bg-accent/10 text-accent":"border-border text-textMuted")}>{n}</button>)}</div><p className="text-[10px] text-textMuted">Keyakinan awal: {form.confidence}/5</p></div></div>
      <div className="grid gap-2 sm:grid-cols-2"><select value={form.goal_id} onChange={e=>setForm({...form,goal_id:e.target.value})} className="min-h-11 rounded-xl border border-border bg-surface px-3 text-sm text-text"><option value="">Hubungkan ke target (opsional)</option>{goals.map(g=><option key={g.id} value={g.id}>{g.title}</option>)}</select><select value={form.area_id} onChange={e=>setForm({...form,area_id:e.target.value})} className="min-h-11 rounded-xl border border-border bg-surface px-3 text-sm text-text"><option value="">Hubungkan ke area (opsional)</option>{areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
      <TextInput value={form.tags} onChange={e=>setForm({...form,tags:e.target.value})} placeholder="Tag: karier, studi, finansial, project…"/>
      <div className="flex justify-end gap-2"><button type="button" onClick={()=>setForm(blank)} className="rounded-xl border border-border px-3 py-2 text-xs text-textMuted">Reset</button><PrimaryButton onClick={save} disabled={saving}>{saving?"Menyimpan…":"Simpan keputusan"}</PrimaryButton></div>
    </div></Card>}

    <div className="grid gap-3 sm:grid-cols-3"><Card className="p-4"><p className="text-xs text-textMuted">Review tertunda</p><p className="mt-1 font-display text-2xl text-danger">{dueCount}</p><p className="mt-1 text-[10px] text-textMuted">Keputusan tanpa hasil yang masih punya tanggal review.</p></Card><Card className="p-4"><p className="text-xs text-textMuted">Rating terisi</p><p className="mt-1 font-display text-2xl text-accent">{rated.length}</p><p className="mt-1 text-[10px] text-textMuted">Hanya dihitung ketika hasil nyata sudah dicatat.</p></Card><Card className="p-4"><p className="text-xs text-textMuted">Prediksi relatif dekat</p><p className="mt-1 font-display text-2xl text-text">{rated.length?`${Math.round(calibrated/rated.length*100)}%`:"—"}</p><p className="mt-1 text-[10px] text-textMuted">Selisih keyakinan dan rating hasil berada dalam 1 poin.</p></Card></div>
    <Card className="border-border/70 bg-surfaceRaised/50"><div className="grid gap-4 md:grid-cols-[1.3fr_.7fr]"><div><div className="flex items-center gap-2"><Lightbulb size={17} className="text-accent"/><p className="font-semibold text-text">Untuk apa fitur ini?</p></div><p className="mt-2 text-sm leading-relaxed text-textMuted">Gunakan saat ada pilihan yang punya konsekuensi. Nanti saat review, kamu bisa membandingkan keyakinan awal, alasan, hasil nyata, dan pelajaran yang muncul.</p></div><div className="rounded-xl bg-bg p-3"><p className="text-[10px] uppercase tracking-wider text-textMuted">Siklus</p><p className="mt-1 text-sm font-medium text-text">Konteks → Pilih → Review → Belajar</p><p className="mt-1 text-[11px] text-textMuted">Ini membuat jurnal berguna kembali setelah keputusan dibuat.</p></div></div></Card>

    <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1 no-scrollbar">{([['all','Semua'],['review','Menunggu review'],['closed','Sudah ada hasil']] as [Filter,string][]).map(([v,l])=><button key={v} onClick={()=>setFilter(v)} className={clsx("whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold",filter===v?"bg-accent text-white":"text-textMuted hover:text-text")}>{l}</button>)}</div>

    {!visible.length?<EmptyState title="Belum ada keputusan yang disimpan" description="Mulai dari satu keputusan yang ingin kamu pahami kembali setelah beberapa waktu."/>:<div className="grid gap-3 lg:grid-cols-2">{visible.map(row=>{
      const due=daysUntil(row.review_date); const isOpen=expanded===row.id;
      return <Card key={row.id} className={clsx("min-w-0 overflow-hidden p-4 transition",due!==null&&due<=0&&!row.outcome&&"border-danger/35")}>
        <button onClick={()=>setExpanded(isOpen?null:row.id)} className="w-full text-left"><div className="flex items-start gap-3"><div className="rounded-xl bg-accent/10 p-2.5 text-accent"><Scale size={17}/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-1.5"><span className="rounded-full bg-bg px-2 py-1 text-[10px] text-textMuted">{row.outcome?"Selesai direview":"Masih berjalan"}</span>{row.review_date&&<span className={clsx("rounded-full px-2 py-1 text-[10px]",due!==null&&due<=0&&!row.outcome?"bg-danger/10 text-danger":"bg-bg text-textMuted")}>{due!==null&&due<=0&&!row.outcome?"Perlu ditinjau":`Review ${dateId(row.review_date)}`}</span>}</div><p className="mt-2 break-words font-display text-lg text-text">{row.title}</p><p className="mt-1 line-clamp-2 break-words text-xs leading-relaxed text-textMuted">{row.context||"Tanpa konteks tambahan."}</p></div><ChevronDown size={16} className={clsx("mt-1 shrink-0 text-textMuted transition",isOpen&&"rotate-180")}/></div></button>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-textMuted"><span className="rounded-full bg-accent/10 px-2 py-1 text-accent">Keyakinan {row.confidence}/5</span>{row.result_rating&&<span className="rounded-full bg-success/10 px-2 py-1 text-success">Hasil {row.result_rating}/5</span>}{row.goal_id&&<span className="flex items-center gap-1"><Target size={10}/> {goals.find(g=>g.id===row.goal_id)?.title||"Target"}</span>}{row.area_id&&<span>{areas.find(a=>a.id===row.area_id)?.name}</span>}<button onClick={()=>recordOutcome(row)} className="ml-auto rounded-lg border border-border px-2.5 py-1.5 font-semibold text-textMuted hover:text-accent">{row.outcome?"Ubah review":"Catat hasil"}</button><button onClick={()=>remove(row.id)} className="rounded-lg p-1.5 text-textMuted hover:text-danger"><Trash2 size={14}/></button></div>
        {row.tags?.length>0&&<div className="mt-2 flex flex-wrap gap-1.5">{row.tags.slice(0,5).map(t=><span key={t} className="inline-flex items-center gap-1 rounded-full bg-bg px-2 py-1 text-[10px] text-textMuted"><Tag size={9}/>#{t}</span>)}</div>}
        {isOpen&&<div className="mt-4 space-y-3 border-t border-border pt-4"><div className="rounded-xl bg-bg p-3"><p className="text-[10px] uppercase tracking-wider text-accent">Pilihan & alasan</p><p className="mt-1 text-sm leading-relaxed text-text">{row.decision}</p></div>{row.options?.length>0&&<div><p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-textMuted">Alternatif</p><div className="flex flex-wrap gap-1.5">{row.options.map((o,i)=><span key={i} className="rounded-full border border-border px-2.5 py-1 text-xs text-textMuted">{o}</span>)}</div></div>}{row.outcome&&<div className="rounded-xl border border-success/20 bg-success/5 p-3"><p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-success"><CheckCircle2 size={12}/> Hasil</p><p className="mt-1 text-sm leading-relaxed text-text">{row.outcome}</p></div>}<div className="grid gap-2 sm:grid-cols-2"><Link href={row.goal_id?`/goals`:`/today`} className="rounded-xl border border-border px-3 py-2 text-xs text-textMuted hover:border-accent hover:text-accent">Lihat konteks terkait</Link><button onClick={()=>recordOutcome(row)} className="rounded-xl border border-border px-3 py-2 text-xs text-textMuted hover:border-accent hover:text-accent">{row.outcome?"Review ulang hasil":"Isi hasil sekarang"}</button></div></div>}
      </Card>
    })}</div>}

    {lessons.length>0&&<Card><SectionTitle action={<Sparkles size={15} className="text-accent"/>}>Beberapa keputusan terakhir</SectionTitle><div className="grid gap-2 sm:grid-cols-3">{lessons.map(x=><div key={x.id} className="rounded-xl bg-bg p-3"><p className="line-clamp-2 text-xs font-semibold text-text">{x.title}</p><p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-textMuted">{x.outcome}</p></div>)}</div></Card>}
  </div>;
}
