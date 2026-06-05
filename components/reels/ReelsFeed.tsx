"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronUp, Flame } from "lucide-react";
import { BottomNav } from "@/components/nav/BottomNav";
import { loadProfile, type StudentProfile } from "@/lib/profile";
import {
  REELS,
  normalizeHobby,
  type Reel,
  type FactReel,
  type SimReel,
  type QuizReel,
  type RealWorldReel,
  type HobbyKey,
} from "./reelsData";
import { ACCENTS } from "./accents";
import { useReducedMotion } from "./useReducedMotion";
import {
  FactReelView,
  SimReelView,
  QuizReelView,
  RealWorldReelView,
  ReelConfetti,
} from "./reelComponents";

/* ---------------------------------------------------------------------- */
/* Deterministic shuffle (so the order is stable for one mount but varies  */
/* across mounts via a post-mount seed — never during SSR).                */
/* ---------------------------------------------------------------------- */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* ---------------------------------------------------------------------- */
/* Personalization — pick a hobby variant of a reel when the student's     */
/* interests match. The chosen hobby is selected once per mount via seed.  */
/* ---------------------------------------------------------------------- */

/** Returns a copy of the reel with a matching hobby variant merged in (if any). */
function personalizeReel(reel: Reel, hobby: HobbyKey | null): Reel {
  if (!hobby) return reel;
  switch (reel.kind) {
    case "fact": {
      const v = reel.hobbyVariants?.[hobby];
      if (!v) return reel;
      const out: FactReel = {
        ...reel,
        kicker: v.kicker ?? reel.kicker,
        hook: v.hook,
        body: v.body ?? reel.body,
      };
      return out;
    }
    case "sim": {
      const v = reel.hobbyVariants?.[hobby];
      if (!v) return reel;
      const out: SimReel = {
        ...reel,
        hook: v.hook,
        prompt: v.prompt ?? reel.prompt,
      };
      return out;
    }
    case "quiz": {
      const v = reel.hobbyVariants?.[hobby];
      if (!v) return reel;
      const out: QuizReel = {
        ...reel,
        question: v.question,
        explain: v.explain ?? reel.explain,
      };
      return out;
    }
    case "real": {
      const v = reel.hobbyVariants?.[hobby];
      if (!v) return reel;
      const out: RealWorldReel = {
        ...reel,
        hook: v.hook,
        body: v.body ?? reel.body,
      };
      return out;
    }
  }
}

/** First interest from the profile that maps to a known hobby key. */
function pickHobby(profile: StudentProfile | null, rng: () => number): HobbyKey | null {
  if (!profile?.interests?.length) return null;
  const keys = profile.interests
    .map(normalizeHobby)
    .filter((k): k is HobbyKey => k !== null);
  if (keys.length === 0) return null;
  return keys[Math.floor(rng() * keys.length)];
}

/* ---------------------------------------------------------------------- */
/* Feed                                                                    */
/* ---------------------------------------------------------------------- */

export default function ReelsFeed() {
  const reduced = useReducedMotion();
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // First render = stable default order (SSR-safe, no Math.random / Date.now).
  const [order, setOrder] = useState<Reel[]>(REELS);
  const [activeIdx, setActiveIdx] = useState(0);
  const [hintGone, setHintGone] = useState(false);
  const [streak, setStreak] = useState(0);
  const [confettiFor, setConfettiFor] = useState<string | null>(null);
  const answeredRef = useRef<Set<string>>(new Set());

  // Post-mount: read profile, derive a fresh seed, shuffle + personalize.
  // Everything that depends on randomness / localStorage lives here so the
  // server-rendered markup (default order) hydrates without mismatch.
  useEffect(() => {
    const profile = loadProfile();
    const seed =
      (Date.now() & 0xffffffff) ^
      Math.floor(Math.random() * 0xffffffff);
    const rng = mulberry32(seed);
    const hobby = pickHobby(profile, rng);
    const personalized = REELS.map((r) => personalizeReel(r, hobby));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the shuffle/personalization seed derives from Date.now()/Math.random() + localStorage, none of which exist during SSR; running it post-mount is required to avoid a hydration mismatch
    setOrder(shuffled(personalized, rng));
    setActiveIdx(0);
  }, []);

  // Track which reel is centered via IntersectionObserver — drives count-ups,
  // sim mounting, and the progress indicator.
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const sections = Array.from(
      root.querySelectorAll<HTMLElement>("[data-reel-idx]"),
    );
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.55) {
            const idx = Number(
              (e.target as HTMLElement).dataset.reelIdx ?? "0",
            );
            setActiveIdx(idx);
            if (idx > 0) setHintGone(true);
          }
        }
      },
      { root, threshold: [0.55, 0.75] },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [order]);

  function handleCorrect(reelId: string) {
    if (answeredRef.current.has(reelId)) return;
    answeredRef.current.add(reelId);
    setStreak((s) => s + 1);
    // Re-arm confetti: clear then set on next frame so toggling re-fires. The
    // burst color is taken from the reel's accent at render time.
    setConfettiFor(null);
    requestAnimationFrame(() => setConfettiFor(reelId));
  }

  const total = order.length;

  // A compact progress rail (dots for <= 16 reels).
  const dots = useMemo(
    () => Array.from({ length: total }, (_, i) => i),
    [total],
  );

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#050505]">
      {/* The snap scroller */}
      <div
        ref={scrollerRef}
        className="h-dvh w-full snap-y snap-mandatory overflow-y-scroll scrollbar-none"
        style={{ scrollBehavior: reduced ? "auto" : "smooth" }}
      >
        {order.map((reel, idx) => {
          const theme = ACCENTS[reel.accent];
          const active = idx === activeIdx;
          return (
            <section
              key={reel.id}
              data-reel-idx={idx}
              className="relative flex h-dvh w-full snap-start items-stretch justify-center"
            >
              {/* The bold per-reel stage */}
              <div
                className="absolute inset-0"
                style={{ background: theme.stage }}
                aria-hidden
              />
              {/* Confetti overlay (quiz wins) */}
              {confettiFor === reel.id && (
                <ReelConfetti
                  fire
                  accent={reel.accent}
                  reduced={reduced}
                />
              )}

              {/* Content column — generous padding, room for nav + progress */}
              <div className="relative z-10 mx-auto flex w-full max-w-[560px] flex-col px-6 pb-28 pt-[max(20px,env(safe-area-inset-top))]">
                <div className="flex-1">
                  {reel.kind === "fact" && (
                    <FactReelView
                      reel={reel}
                      active={active}
                      reduced={reduced}
                    />
                  )}
                  {reel.kind === "sim" && (
                    <SimReelView reel={reel} active={active} />
                  )}
                  {reel.kind === "quiz" && (
                    <QuizReelView
                      reel={reel}
                      active={active}
                      reduced={reduced}
                      onCorrect={() => handleCorrect(reel.id)}
                    />
                  )}
                  {reel.kind === "real" && (
                    <RealWorldReelView reel={reel} reduced={reduced} />
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* ---- Fixed overlays ---- */}

      {/* Top rail: progress count + streak */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 pt-[max(14px,env(safe-area-inset-top))]">
        <span className="rounded-full bg-black/35 px-3 py-1 font-mono text-[12px] font-semibold tabular-nums text-white/80 backdrop-blur">
          {Math.min(activeIdx + 1, total)}
          <span className="text-white/45"> / {total}</span>
        </span>
        {streak > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1 text-[12px] font-bold text-amber-300 backdrop-blur">
            <Flame className="h-3.5 w-3.5" fill="currentColor" />
            <span className="tabular-nums">{streak}</span>
          </span>
        )}
      </div>

      {/* Right-edge progress dots */}
      <div className="pointer-events-none absolute right-2.5 top-1/2 z-20 hidden -translate-y-1/2 flex-col items-center gap-1.5 sm:flex">
        {dots.map((i) => (
          <span
            key={i}
            className="rounded-full transition-all duration-300"
            style={{
              width: 6,
              height: i === activeIdx ? 18 : 6,
              background:
                i === activeIdx
                  ? ACCENTS[order[i].accent].hexSoft
                  : "rgba(255,255,255,0.25)",
            }}
          />
        ))}
      </div>

      {/* Swipe-up hint on the first reel */}
      {!hintGone && !reduced && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-20 flex flex-col items-center gap-1 text-white/65">
          <ChevronUp className="h-5 w-5 reels-bob" />
          <span className="text-[12px] font-semibold tracking-wide">
            Yuqoriga suring
          </span>
        </div>
      )}

      <BottomNav />

      {/* Local keyframes — a gentle bob for the swipe hint. rAF would be
          overkill for a single decorative arrow; this is purely cosmetic and
          honors reduced-motion via the media query below. */}
      <style>{`
        @keyframes reels-bob {
          0%, 100% { transform: translateY(0); opacity: 0.65; }
          50% { transform: translateY(-7px); opacity: 1; }
        }
        .reels-bob { animation: reels-bob 1.5s var(--ease-out-quart, ease-in-out) infinite; }
        @media (prefers-reduced-motion: reduce) {
          .reels-bob { animation: none; }
        }
      `}</style>
    </main>
  );
}
