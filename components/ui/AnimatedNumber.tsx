"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { documentLocale } from "@/lib/format";

type NumberFormat = "number" | "integer" | "idr";

type Props = {
  value: number;
  /**
   * Serializable display format. Do not pass formatter functions from Server Components.
   * Formatting functions live inside this client component to satisfy the Next.js
   * Server → Client boundary.
   */
  format?: NumberFormat;
  duration?: number;
  className?: string;
};

function formatValue(value: number, format: NumberFormat): string {
  if (format === "idr") {
    return new Intl.NumberFormat(documentLocale(), {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(Math.round(value));
  }

  return new Intl.NumberFormat(documentLocale(), {
    maximumFractionDigits: format === "integer" ? 0 : 2,
  }).format(format === "integer" ? Math.round(value) : value);
}

export function AnimatedNumber({
  value,
  format = "integer",
  duration = 420,
  className = "",
}: Props) {
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);

  useEffect(() => {
    const from = previous.current;
    previous.current = value;

    if (from === value) {
      setDisplay(value);
      return;
    }

    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (value - from) * eased);

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  const text = useMemo(() => formatValue(display, format), [display, format]);

  return (
    <span className={`licia-v32-number-in inline-block tabular-nums ${className}`}>
      {text}
    </span>
  );
}
