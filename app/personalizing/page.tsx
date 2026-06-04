"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadProfile } from "@/lib/profile";

/** Messages shown one-by-one while we "personalize" the experience. Each line
 *  is meant to land as a small AI promise: we're doing work specifically for you. */
const STAGES: { id: string; label: string; secondary: string }[] = [
  {
    id: "profile",
    label: "Qiziqishlaringizni o'rganyapman",
    secondary: "Sevimli fanlaringiz va maqsadingizga qarab darslar tanlanmoqda.",
  },
  {
    id: "emaktab",
    label: "emaktab natijalaringizni o'qiyapman",
    secondary: "Choraklar bo'yicha 843 ta baho va 30 ta uy vazifasi yuklanmoqda.",
  },
  {
    id: "gaps",
    label: "Bilim bo'shliqlaringizni topyapman",
    secondary: "Qaysi mavzu siz uchun eng muhim — buni hisoblayapman.",
  },
  {
    id: "curriculum",
    label: "Darslarni sizga moslayapman",
    secondary: "Har bir darsni sinfingiz, til va o'zlashtirishingizga ko'ra qayta yozyapman.",
  },
  {
    id: "ignite",
    label: "Birinchi yulduzni yoqyapman",
    secondary: "Osmoningiz hozir tug'iladi.",
  },
];

const STAGE_MS = 1400; // each stage visible time
const TOTAL_MS = STAGES.length * STAGE_MS;

export default function PersonalizingPage() {
  const router = useRouter();
  const [stageIdx, setStageIdx] = useState(0);
  const [progress, setProgress] = useState(0); // 0..1
  const profile = typeof window !== "undefined" ? loadProfile() : null;
  const firstName = profile?.name?.split(" ")[0] ?? "siz";

  useEffect(() => {
    const start = performance.now();
    const tick = () => {
      const elapsed = performance.now() - start;
      const p = Math.min(1, elapsed / TOTAL_MS);
      setProgress(p);
      const idx = Math.min(STAGES.length - 1, Math.floor(elapsed / STAGE_MS));
      setStageIdx(idx);
      if (p < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        // Small hold, then redirect to the personalised home.
        setTimeout(() => router.push("/learn"), 350);
      }
    };
    let rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [router]);

  const stage = STAGES[stageIdx];

  // SVG circle params for the progress ring
  const R = 64;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - progress);

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-x-hidden px-6">
      {/* Quiet star atmosphere */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {[
          [8, 22, 2, 0.5],
          [18, 78, 1.5, 0.4],
          [30, 12, 1, 0.35],
          [40, 88, 2, 0.5],
          [55, 36, 1.5, 0.4],
          [68, 70, 1, 0.3],
          [78, 18, 2, 0.45],
          [88, 56, 1.5, 0.4],
          [92, 88, 1, 0.3],
        ].map(([t, l, s, o], i) => (
          <span
            key={i}
            className="absolute rounded-full bg-star-bright"
            style={{
              top: `${t}%`,
              left: `${l}%`,
              width: s,
              height: s,
              opacity: o,
            }}
          />
        ))}
      </div>

      {/* Brand stamp */}
      <div className="absolute left-6 right-6 top-7 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-void-300">
        <span className="font-mono">Scorpius · 2026</span>
        <span className="font-mono">{Math.round(progress * 100)}%</span>
      </div>

      <div className="rise-in relative z-10 flex w-full max-w-[440px] flex-col items-center text-center">
        {/* Ring with the gold heart that pulses */}
        <div className="relative h-[160px] w-[160px]">
          <svg
            width="160"
            height="160"
            viewBox="0 0 160 160"
            className="rotate-[-90deg]"
            aria-hidden
          >
            <circle
              cx="80"
              cy="80"
              r={R}
              fill="none"
              stroke="var(--color-void-500)"
              strokeWidth="3"
            />
            <circle
              cx="80"
              cy="80"
              r={R}
              fill="none"
              stroke="var(--color-antares-500)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 80ms linear" }}
            />
          </svg>

          {/* Antares heart, pulses */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="absolute h-16 w-16 rounded-full bg-antares-500/15 pulse-ring"
              aria-hidden
            />
            <span
              className="relative h-8 w-8 rounded-full bg-antares-500"
              style={{ boxShadow: "0 0 32px 6px rgba(232,162,26,0.5)" }}
            />
          </div>
        </div>

        <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.18em] text-void-300">
          {firstName} uchun shaxsiylashtirilmoqda
        </p>

        {/* The stage label — rises in on change */}
        <h1
          key={stage.id}
          className="rise-in mt-3 font-serif text-[1.85rem] font-medium leading-[1.18] tracking-[-0.018em] text-void-100 sm:text-[2.1rem]"
        >
          {stage.label}
        </h1>

        <p
          key={`${stage.id}-secondary`}
          className="rise-in mt-3 max-w-[22rem] text-[0.95rem] leading-[1.55] text-void-300"
        >
          {stage.secondary}
        </p>

        {/* Stage dots */}
        <div className="mt-10 flex items-center gap-1.5">
          {STAGES.map((s, i) => (
            <span
              key={s.id}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === stageIdx ? 24 : 6,
                backgroundColor:
                  i < stageIdx
                    ? "var(--color-antares-500)"
                    : i === stageIdx
                      ? "var(--color-antares-500)"
                      : "var(--color-void-600)",
                opacity: i <= stageIdx ? 1 : 0.7,
              }}
            />
          ))}
        </div>
      </div>

      {/* Quiet brand definition footnote */}
      <footer className="absolute bottom-7 left-6 right-6 mx-auto max-w-[460px] text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-void-300">
          AI · Gemini & gpt-5-mini · cached locally
        </p>
      </footer>
    </main>
  );
}
