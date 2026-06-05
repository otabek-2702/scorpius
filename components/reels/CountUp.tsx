"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A number that counts up to `value` over `durationMs`, driven by
 * requestAnimationFrame with an ease-out cubic. Animation only runs when
 * `active` is true (the reel is on-screen) and reduced-motion is off — otherwise
 * the final value is shown instantly. Re-running happens when `active` flips
 * from false→true, so scrolling a stat reel back into view replays the count.
 */

type FormatKind = "int" | "comma" | "float1";

function formatNumber(n: number, kind: FormatKind): string {
  if (kind === "float1") return n.toFixed(1);
  const rounded = Math.round(n);
  if (kind === "comma") {
    // Group thousands with a thin space (locale-neutral, reads well in UZ).
    return rounded.toLocaleString("en-US").replace(/,/g, " ");
  }
  return String(rounded);
}

export function CountUp({
  value,
  format = "int",
  prefix = "",
  suffix = "",
  active,
  reduced,
  durationMs = 1100,
  className,
}: {
  value: number;
  format?: FormatKind;
  prefix?: string;
  suffix?: string;
  active: boolean;
  reduced: boolean;
  durationMs?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(() =>
    reduced ? value : 0,
  );
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    // When not animating, snap straight to the final value. Done inside a rAF
    // callback (not synchronously in the effect body) so no cascading render is
    // triggered during the effect itself.
    if (!active || reduced) {
      rafRef.current = requestAnimationFrame(() => {
        setDisplay(value);
        rafRef.current = null;
      });
      return () => {
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      };
    }
    // Animate from 0 → value with an ease-out cubic. All setState happens inside
    // the rAF callback, which the lint permits (it's an external-clock update).
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setDisplay(value);
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [active, reduced, value, durationMs]);

  return (
    <span className={className}>
      {prefix}
      {formatNumber(display, format)}
      {suffix}
    </span>
  );
}
