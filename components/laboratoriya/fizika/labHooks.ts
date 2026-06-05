// components/laboratoriya/fizika/labHooks.ts
/**
 * Shared, SSR-safe lab utility hooks for the Fizika collision lab.
 *
 * These are deliberately small, dependency-free, and guard every `window` /
 * `document` access so they are safe under server rendering + React 19
 * StrictMode double-mount. They power the stage toolbar (fullscreen + sound),
 * the synthesized Web-Audio SFX (no asset files), and the deep-link/localStorage
 * persistence of the chosen scenario + variant.
 *
 * Architecture note: none of these touch the physics. They are pure view-side
 * concerns (audio, DOM fullscreen, URL state) and keep FizikaLab readable.
 */
"use client";

import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

const isBrowser = typeof window !== "undefined";

export function prefersReducedMotion(): boolean {
  if (!isBrowser || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ------------------------------------------------------------------ sound */
/**
 * useSfx — subtle synthesized collision/UI SFX via the Web Audio API.
 *
 * The AudioContext is created LAZILY on the first user gesture (browser
 * autoplay policy). Mute state persists in localStorage under `key`. If the
 * user prefers reduced motion we default to muted. Volumes are intentionally
 * low. Nothing here loads an asset file.
 */
export interface Sfx {
  muted: boolean;
  toggleMuted: () => void;
  /** A collision "tick" — pitch rises with closing speed (0..1). */
  impact: (strength: number, inelastic: boolean) => void;
  /** A soft UI click for transport / picker presses. */
  click: () => void;
  /** A short rising/falling sweep for play / pause. */
  transport: (up: boolean) => void;
}

export function useSfx(key: string): Sfx {
  const reduced = useRef<boolean>(false);
  const [muted, setMuted] = useState<boolean>(true);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);

  // Restore persisted mute (default: muted if reduced-motion or no stored
  // value). Deferred to a rAF so the first client render matches the server's
  // `muted` fallback (avoids hydration mismatch + synchronous setState-in-effect).
  useEffect(() => {
    reduced.current = prefersReducedMotion();
    if (!isBrowser) return;
    const raf = requestAnimationFrame(() => {
      let stored: string | null = null;
      try {
        stored = window.localStorage.getItem(key);
      } catch {
        stored = null;
      }
      if (stored === "on") setMuted(false);
      else if (stored === "off") setMuted(true);
      else setMuted(reduced.current); // first visit: muted only under reduced-motion
    });
    return () => cancelAnimationFrame(raf);
  }, [key]);

  const ensureCtx = useCallback((): AudioContext | null => {
    if (!isBrowser) return null;
    if (!ctxRef.current) {
      type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext };
      const Ctor =
        window.AudioContext ?? (window as WindowWithWebkit).webkitAudioContext;
      if (!Ctor) return null;
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      ctxRef.current = ctx;
      masterRef.current = master;
    }
    if (ctxRef.current.state === "suspended") void ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const toggleMuted = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      if (!next) ensureCtx(); // unmuting is a user gesture → safe to create ctx
      if (isBrowser) {
        try {
          window.localStorage.setItem(key, next ? "off" : "on");
        } catch {
          /* storage may be unavailable — ignore */
        }
      }
      return next;
    });
  }, [ensureCtx, key]);

  // A short pitched blip: oscillator → gain envelope → master.
  const blip = useCallback(
    (freq: number, dur: number, gain: number, type: OscillatorType, slideTo?: number) => {
      if (muted) return;
      const ctx = ensureCtx();
      const master = masterRef.current;
      if (!ctx || !master) return;
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
      }
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.exponentialRampToValueAtTime(gain, t0 + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(env);
      env.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    },
    [muted, ensureCtx],
  );

  const impact = useCallback(
    (strength: number, inelastic: boolean) => {
      const s = Math.max(0, Math.min(1, strength));
      // Elastic: bright "tock" rising with closing speed.
      // Inelastic: lower, duller "thud" that slides down (energy lost).
      if (inelastic) {
        blip(150 + s * 90, 0.16, 0.16 + s * 0.1, "sine", 70);
      } else {
        blip(320 + s * 520, 0.07 + s * 0.04, 0.1 + s * 0.12, "triangle");
      }
    },
    [blip],
  );

  const click = useCallback(() => blip(440, 0.035, 0.05, "square"), [blip]);
  const transport = useCallback(
    (up: boolean) => blip(up ? 360 : 520, 0.12, 0.07, "sine", up ? 620 : 300),
    [blip],
  );

  // Free the context on unmount.
  useEffect(() => {
    return () => {
      const ctx = ctxRef.current;
      ctxRef.current = null;
      masterRef.current = null;
      if (ctx && ctx.state !== "closed") void ctx.close();
    };
  }, []);

  return { muted, toggleMuted, impact, click, transport };
}

/* ------------------------------------------------------------- fullscreen */
type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export interface Fullscreen<T extends HTMLElement> {
  /** Attach to the element that should go fullscreen. */
  fsRef: RefObject<T | null>;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
}

/**
 * useFullscreen — toggle the Fullscreen API on a ref'd element, tracking state
 * across user-initiated exits (Esc). The ref is returned under `fsRef` and the
 * reactive parts separately, so the call site never reads non-ref fields off a
 * ref-bearing object during render.
 */
export function useFullscreen<T extends HTMLElement>(): Fullscreen<T> {
  const fsRef = useRef<T | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!isBrowser) return;
    const onChange = () => {
      const doc = document as FsDocument;
      const el = document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
      setIsFullscreen(!!el && el === fsRef.current);
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!isBrowser) return;
    const el = fsRef.current as FsElement | null;
    const doc = document as FsDocument;
    const current = document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
    const run = async () => {
      try {
        if (current) {
          if (document.exitFullscreen) await document.exitFullscreen();
          else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
        } else if (el) {
          if (el.requestFullscreen) await el.requestFullscreen();
          else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
        }
      } catch {
        /* fullscreen can reject (e.g. permissions) — fail silently */
      }
    };
    void run();
  }, []);

  return { fsRef, isFullscreen, toggleFullscreen };
}

/* ------------------------------------------------------- URL + storage state */
/**
 * Read the initial value for a deep-linkable key, preferring the URL query,
 * then localStorage, then the supplied default. Pure read — SSR-safe (returns
 * the fallback on the server so hydration is stable; the caller reconciles in
 * an effect on mount).
 */
export function readDeepLink(
  param: string,
  storageKey: string,
  allowed: readonly string[],
  fallback: string,
): string {
  if (!isBrowser) return fallback;
  try {
    const q = new URLSearchParams(window.location.search).get(param);
    if (q && allowed.includes(q)) return q;
  } catch {
    /* ignore malformed query */
  }
  try {
    const s = window.localStorage.getItem(storageKey);
    if (s && allowed.includes(s)) return s;
  } catch {
    /* ignore storage errors */
  }
  return fallback;
}

/**
 * Persist a deep-linkable value to BOTH the URL query (via history.replaceState
 * — no navigation, no useSearchParams Suspense requirement) and localStorage.
 */
export function writeDeepLink(param: string, storageKey: string, value: string): void {
  if (!isBrowser) return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set(param, value);
    window.history.replaceState(null, "", url.toString());
  } catch {
    /* history may be unavailable in some embeds — ignore */
  }
  try {
    window.localStorage.setItem(storageKey, value);
  } catch {
    /* ignore storage errors */
  }
}
