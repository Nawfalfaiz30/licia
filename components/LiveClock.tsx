"use client";

import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { formatClock, timezoneLabel } from "@/lib/time";



export function LiveClock({ timezone }: { timezone: string }) {
  // Never render a Date-derived value during SSR. The server and browser can
  // cross a minute boundary between the two renders, which causes a hydration
  // mismatch (e.g. Server 23.58 vs Client 23.59).
  const [now, setNow] = useState<Date | null>(null);
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">("24h");
  const [showSeconds, setShowSeconds] = useState(false);

  useEffect(() => {
    try {
      const storedFormat = localStorage.getItem("licia-time-format");
      const storedSeconds = localStorage.getItem("licia-show-clock-seconds");
      setTimeFormat(storedFormat === "12h" ? "12h" : "24h");
      setShowSeconds(storedSeconds === "true");
    } catch {}
    const onPrefs = () => {
      try {
        setTimeFormat(localStorage.getItem("licia-time-format") === "12h" ? "12h" : "24h");
        setShowSeconds(localStorage.getItem("licia-show-clock-seconds") === "true");
      } catch {}
    };
    window.addEventListener("licia:preferences-change", onPrefs);
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => { window.clearInterval(id); window.removeEventListener("licia:preferences-change", onPrefs); };
  }, []);

  return (
    <div className="inline-flex min-w-[108px] items-center justify-center gap-1.5 rounded-full border border-border bg-bg px-2.5 py-1 text-[11px] text-textMuted tabular-nums">
      <Clock3 size={12} className="text-accent" />
      <span suppressHydrationWarning>{now ? formatClock(now, timezone, timeFormat, showSeconds) : "--:--"}</span>
      <span className="hidden sm:inline">· {timezoneLabel(timezone)}</span>
    </div>
  );
}
