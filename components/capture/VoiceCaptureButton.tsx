"use client";

import { Mic, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { haptic } from "@/lib/interaction";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

type Props = { onText: (text: string) => void; language?: string };

export function VoiceCaptureButton({ onText, language = "id-ID" }: Props) {
  const [active, setActive] = useState(false);
  const [supported, setSupported] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognitionLike | null>(null);
  const [activeLanguage, setActiveLanguage] = useState(language);

  useEffect(() => {
    const applyLanguage = () => {
      try { setActiveLanguage(localStorage.getItem("licia-voice-capture-language") || language); } catch { setActiveLanguage(language); }
    };
    applyLanguage();
    const onPreferenceChange = () => applyLanguage();
    window.addEventListener("licia:preferences-change", onPreferenceChange);
    return () => window.removeEventListener("licia:preferences-change", onPreferenceChange);
  }, [language]);

  useEffect(() => {
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) return setSupported(false);
    const instance = new Ctor() as SpeechRecognitionLike;
    instance.lang = activeLanguage;
    instance.continuous = false;
    instance.interimResults = true;
    instance.onresult = (event: any) => {
      const parts: string[] = [];
      for (let i = event.resultIndex || 0; i < event.results.length; i += 1) {
        parts.push(String(event.results[i][0]?.transcript || ""));
      }
      const text = parts.join(" ").trim();
      if (text) onText(text);
    };
    instance.onerror = () => { setActive(false); haptic("warning"); };
    instance.onend = () => setActive(false);
    setRecognition(instance);
    setSupported(true);
    return () => { try { instance.stop(); } catch {} };
  }, [activeLanguage, onText]);

  if (!supported || !recognition) return null;
  return <button
    type="button"
    onClick={() => {
      try {
        if (active) { recognition.stop(); setActive(false); }
        else { recognition.start(); setActive(true); haptic("light"); }
      } catch { setActive(false); }
    }}
    className={`licia-v33-ripple inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-semibold transition ${active ? "border-danger/20 bg-danger/10 text-danger" : "border-border bg-bg text-textMuted hover:text-accent"}`}
    aria-label={active ? "Hentikan rekaman suara" : "Gunakan suara"}
  >
    {active ? <Square size={12} /> : <Mic size={13} />}
    {active ? "Berhenti" : "Suara"}
  </button>;
}
