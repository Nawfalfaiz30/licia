"use client";
import { useEffect } from "react";
import { X } from "lucide-react";

export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => { if (!open) return; const onKey=(e:KeyboardEvent)=>e.key==="Escape"&&onClose(); document.body.style.overflow="hidden"; window.addEventListener("keydown", onKey); return ()=>{document.body.style.overflow="";window.removeEventListener("keydown",onKey)}; }, [open,onClose]);
  if (!open) return null;
  return <div className="fixed inset-0 z-[180] flex items-end justify-center bg-black/45 backdrop-blur-sm sm:items-center" onMouseDown={(e)=>e.target===e.currentTarget&&onClose()}><div className="w-full max-w-xl rounded-t-[1.75rem] border border-border bg-surface p-4 shadow-2xl animate-licia-sheet-in sm:rounded-[1.75rem]"><div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border sm:hidden"/><div className="flex items-center justify-between gap-3"><h2 className="font-display text-lg text-text">{title}</h2><button onClick={onClose} className="rounded-xl border border-border p-2 text-textMuted hover:text-text"><X size={15}/></button></div><div className="mt-3">{children}</div></div></div>;
}
