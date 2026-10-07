"use client";

import { useEffect } from "react";

type Vital = "LCP" | "INP" | "CLS";

function report(metric: Vital, value: number) {
  if (!Number.isFinite(value) || value < 0) return;
  try { if ((navigator as any).connection?.saveData) return; } catch {}
  void fetch("/api/telemetry", {
    method: "POST",
    credentials: "include",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      metric,
      value: Number(value.toFixed(3)),
      pathname: window.location.pathname,
      device: String(window.innerWidth) + "x" + String(window.innerHeight),
    }),
  }).catch(() => undefined);
}

export function WebVitals() {
  useEffect(() => {
    if (!("PerformanceObserver" in window)) return;

    let cls = 0;
    let lcp = 0;
    let inp = 0;
    let flushed = false;
    const observers: PerformanceObserver[] = [];

    try {
      const observer = new PerformanceObserver((list) => {
        const last = list.getEntries().at(-1) as PerformanceEntry | undefined;
        if (last) lcp = Math.max(lcp, last.startTime);
      });
      observer.observe({ type: "largest-contentful-paint", buffered: true } as PerformanceObserverInit);
      observers.push(observer);
    } catch {}

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (!entry.hadRecentInput) cls += Number(entry.value || 0);
        }
      });
      observer.observe({ type: "layout-shift", buffered: true } as PerformanceObserverInit);
      observers.push(observer);
    } catch {}

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (entry.interactionId) inp = Math.max(inp, Number(entry.duration || 0));
        }
      });
      observer.observe({ type: "event", buffered: true, durationThreshold: 40 } as PerformanceObserverInit);
      observers.push(observer);
    } catch {}

    const flush = () => {
      if (flushed) return;
      flushed = true;
      if (lcp > 0) report("LCP", lcp);
      if (inp > 0) report("INP", inp);
      report("CLS", cls);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      flush();
      observers.forEach((observer) => observer.disconnect());
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
