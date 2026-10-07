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
    let maxInp = 0;
    const observers: PerformanceObserver[] = [];
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries.at(-1) as PerformanceEntry | undefined;
        if (last) report("LCP", last.startTime);
      });
      observer.observe({ type: "largest-contentful-paint", buffered: true } as PerformanceObserverInit);
      observers.push(observer);
    } catch {}
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (entry.hadRecentInput) continue;
          cls += Number(entry.value || 0);
        }
        report("CLS", cls);
      });
      observer.observe({ type: "layout-shift", buffered: true } as PerformanceObserverInit);
      observers.push(observer);
    } catch {}
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (entry.interactionId && Number(entry.duration) > maxInp) maxInp = Number(entry.duration);
        }
        if (maxInp > 0) report("INP", maxInp);
      });
      observer.observe({ type: "event", buffered: true, durationThreshold: 40 } as PerformanceObserverInit);
      observers.push(observer);
    } catch {}
    return () => observers.forEach((observer) => observer.disconnect());
  }, []);
  return null;
}
