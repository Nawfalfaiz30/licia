"use client";
import Link from "next/link";
import { CheckCircle2, CircleDashed, Layers3 } from "lucide-react";
import { V35_FEATURES, V35_FEATURE_COUNT } from "@/lib/v35/featureRegistry";
import { useLanguage } from "@/components/LanguageProvider";

export function FeatureCoverage(){
  const { tr } = useLanguage();
 const ready=V35_FEATURES.filter(x=>x.status==='ready').length; const enhanced=V35_FEATURES.filter(x=>x.status==='enhanced').length;
 return <div className="rounded-2xl border border-border bg-bg p-4"><div className="flex items-center gap-3"><span className="rounded-xl bg-accent/10 p-2.5 text-accent"><Layers3 size={16}/></span><div><p className="text-xs font-semibold text-text">{tr("V35 Experience Center")}</p><p className="text-[9px] text-textMuted">{V35_FEATURE_COUNT} {tr("kemampuan terdaftar ·")} {ready} {tr("siap ·")} {enhanced} {tr("ditingkatkan")}</p></div><Link href="/guide#v35" className="ml-auto text-[9px] font-semibold text-accent">{tr("Panduan")}</Link></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-accent" style={{width:`${Math.round(((ready+enhanced)/V35_FEATURE_COUNT)*100)}%`}}/></div><div className="mt-3 grid gap-2 sm:grid-cols-3"><div className="rounded-xl bg-surface p-2.5"><CheckCircle2 size={13} className="text-success"/><p className="mt-1 text-[10px] font-semibold text-text">{tr("Siap")}</p><p className="text-[9px] text-textMuted">{ready} {tr("fitur")}</p></div><div className="rounded-xl bg-surface p-2.5"><CheckCircle2 size={13} className="text-accent"/><p className="mt-1 text-[10px] font-semibold text-text">{tr("Ditingkatkan")}</p><p className="text-[9px] text-textMuted">{enhanced} {tr("fitur")}</p></div><div className="rounded-xl bg-surface p-2.5"><CircleDashed size={13} className="text-textMuted"/><p className="mt-1 text-[10px] font-semibold text-text">{tr("Fondasi")}</p><p className="text-[9px] text-textMuted">{V35_FEATURE_COUNT-ready-enhanced} {tr("fitur")}</p></div></div></div>;
}
