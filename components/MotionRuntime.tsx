"use client";

import { useEffect } from "react";
import { haptic } from "@/lib/interaction";

export function MotionRuntime() {
  useEffect(() => {
    const apply = () => {
      const root = document.documentElement;
      let reduced = false;
      try { reduced = localStorage.getItem("licia-reduced-motion") === "true"; } catch {}
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      root.dataset.reducedMotion = String(reduced || media.matches);
      try {
        const motion = localStorage.getItem("licia-motion-intensity") || "full";
        root.dataset.motion = motion === "full" ? "normal" : motion === "subtle" ? "subtle" : "off";
        root.dataset.ambientAi = localStorage.getItem("licia-ambient-ai") !== "false" ? "true" : "false";
      } catch {}
    };
    const onPref = () => apply();
    const onMotion = (event: PointerEvent) => {
      const target = (event.target as HTMLElement | null)?.closest?.(".licia-v33-ripple") as HTMLElement | null;
      if (!target) return;
      const interactive = (event.target as HTMLElement | null)?.closest?.(".licia-v35-interactive") as HTMLElement | null;
      interactive?.classList.add("licia-v35-active");
      window.setTimeout(() => interactive?.classList.remove("licia-v35-active"), 160);
      target.classList.remove("licia-v33-ripple-live");
      void target.offsetWidth;
      target.classList.add("licia-v33-ripple-live");
      try {
        if (localStorage.getItem("licia-haptics") !== "false") haptic("light");
      } catch {}
    };
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    apply();
    window.addEventListener("licia:preferences-change", onPref);
    media.addEventListener?.("change", apply);
    document.addEventListener("pointerdown", onMotion, true);
    return () => {
      window.removeEventListener("licia:preferences-change", onPref);
      media.removeEventListener?.("change", apply);
      document.removeEventListener("pointerdown", onMotion, true);
    };
  }, []);
  return null;
}
