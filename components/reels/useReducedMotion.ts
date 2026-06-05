"use client";

import { useEffect, useState } from "react";

/**
 * SSR-safe `prefers-reduced-motion` hook. Always returns `false` on the first
 * render (server + hydration) so markup matches, then reads the real media
 * query after mount. When `true`, callers should skip auto-motion: no confetti,
 * no count-up animation, instant reveals.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- matchMedia is unavailable during SSR, so the real preference can only be read after mount
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
