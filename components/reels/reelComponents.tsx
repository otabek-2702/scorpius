"use client";

import { useState } from "react";
import { Check, Sparkles, X, ArrowRight, FlaskConical } from "lucide-react";
import { SIM_REGISTRY } from "@/components/learn/sims";
import type {
  FactReel,
  SimReel,
  QuizReel,
  RealWorldReel,
} from "./reelsData";
import { ACCENTS, SUBJECT_LABEL, type AccentTheme } from "./accents";
import { CountUp } from "./CountUp";
import { Confetti } from "./Confetti";

/**
 * Looks a sim up in the registry and renders it. The reel only mounts this when
 * it's the active reel, so we never run more than one sim's rAF loop at a time.
 * Sims are already client-only ("use client") and self-contained (each renders
 * its own light-themed surface + controls).
 */
function SimHost({ simKey }: { simKey: string }) {
  const Sim = SIM_REGISTRY[simKey];
  if (!Sim) {
    return (
      <div className="rounded-[16px] border border-void-500 bg-void-700/40 p-4 text-[13px] text-void-300">
        Animatsiya topilmadi.
      </div>
    );
  }
  return <Sim />;
}

/* ---------------------------------------------------------------------- */
/* Shared chrome                                                          */
/* ---------------------------------------------------------------------- */

/** A small subject pill + kicker row, in the reel's accent. */
function Kicker({
  subject,
  kicker,
  theme,
}: {
  subject: string;
  kicker: string;
  theme: AccentTheme;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-flex items-center rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em]"
        style={{
          color: theme.hexSoft,
          background: `${theme.hex}1f`,
          border: `1px solid ${theme.hex}40`,
        }}
      >
        {SUBJECT_LABEL[subject] ?? subject}
      </span>
      <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/45">
        {kicker}
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* FACT reel                                                              */
/* ---------------------------------------------------------------------- */

export function FactReelView({
  reel,
  active,
  reduced,
}: {
  reel: FactReel;
  active: boolean;
  reduced: boolean;
}) {
  const theme = ACCENTS[reel.accent];
  return (
    <div className="flex h-full w-full flex-col justify-center gap-6 px-1">
      <Kicker subject={reel.subject} kicker={reel.kicker} theme={theme} />

      <h2 className="font-serif text-[1.95rem] font-medium leading-[1.12] tracking-[-0.02em] text-white sm:text-[2.3rem]">
        {reel.hook}
      </h2>

      {reel.stat && (
        <div className="flex flex-col gap-1.5">
          <div
            className="font-mono text-[3.1rem] font-semibold leading-none tabular-nums sm:text-[3.8rem]"
            style={{ color: theme.hexSoft }}
          >
            <CountUp
              value={reel.stat.value}
              format={reel.stat.format ?? "int"}
              prefix={reel.stat.prefix}
              suffix={reel.stat.suffix}
              active={active}
              reduced={reduced}
            />
          </div>
          <div className="text-[13px] font-medium text-white/55">
            {reel.stat.caption}
          </div>
        </div>
      )}

      <p className="max-w-[34rem] text-[15.5px] leading-[1.6] text-white/75">
        {reel.body}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* SIM reel                                                               */
/* ---------------------------------------------------------------------- */

export function SimReelView({
  reel,
  active,
}: {
  reel: SimReel;
  active: boolean;
}) {
  const theme = ACCENTS[reel.accent];
  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto px-1 py-2 scrollbar-none">
      <div className="shrink-0">
        <Kicker subject={reel.subject} kicker={reel.kicker} theme={theme} />
        <h2 className="mt-3 font-serif text-[1.5rem] font-medium leading-[1.15] tracking-[-0.018em] text-white sm:text-[1.7rem]">
          {reel.hook}
        </h2>
        <p
          className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold"
          style={{ color: theme.hexSoft }}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {reel.prompt}
        </p>
      </div>

      {/* The sims are authored for the LIGHT app theme (dark ink on warm paper),
          so we host them inside a genuine light card floating on the dark stage.
          This keeps every sim readable without rewriting its tokens, and reads as
          an intentional "lab panel". Only mount when the reel is active. */}
      <div
        className="reels-sim-surface rounded-[22px] p-3 shadow-[0_18px_60px_-20px_rgba(0,0,0,0.7)]"
        style={{ background: "#fbf9f3", border: "1px solid rgba(255,255,255,0.14)" }}
      >
        {active ? (
          <SimHost simKey={reel.simKey} />
        ) : (
          <div className="grid h-[260px] place-items-center rounded-[16px] border border-void-500 bg-void-700/40 text-[12px] text-void-300">
            <span className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4" /> Suring va sinab koʻring
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* QUIZ reel                                                              */
/* ---------------------------------------------------------------------- */

export function QuizReelView({
  reel,
  active,
  reduced,
  onCorrect,
}: {
  reel: QuizReel;
  active: boolean;
  reduced: boolean;
  /** Fires the panel-level confetti + streak bump. */
  onCorrect: () => void;
}) {
  const theme = ACCENTS[reel.accent];
  const [picked, setPicked] = useState<number | null>(null);
  const isCorrect = picked === reel.answerIndex;

  function choose(i: number) {
    if (picked !== null) return;
    setPicked(i);
    if (i === reel.answerIndex) onCorrect();
  }

  return (
    <div className="flex h-full w-full flex-col justify-center gap-6 px-1">
      <Kicker subject={reel.subject} kicker={reel.kicker} theme={theme} />

      <h2 className="font-serif text-[1.75rem] font-medium leading-[1.16] tracking-[-0.018em] text-white sm:text-[2.05rem]">
        {reel.question}
      </h2>

      <div className="flex flex-col gap-3">
        {reel.options.map((opt, i) => {
          const chosen = picked === i;
          const isAnswer = i === reel.answerIndex;
          const showState = picked !== null;
          // After answering: correct option goes green; a wrong pick goes red.
          let style: React.CSSProperties = {
            borderColor: "rgba(255,255,255,0.16)",
            background: "rgba(255,255,255,0.05)",
          };
          if (showState && isAnswer) {
            style = {
              borderColor: "#34d399",
              background: "rgba(52,211,153,0.16)",
            };
          } else if (showState && chosen && !isAnswer) {
            style = {
              borderColor: "#f87171",
              background: "rgba(248,113,113,0.14)",
            };
          } else if (!showState) {
            style = {
              borderColor: `${theme.hex}33`,
              background: "rgba(255,255,255,0.05)",
            };
          }
          return (
            <button
              key={i}
              type="button"
              disabled={picked !== null}
              onClick={() => choose(i)}
              className={
                "group flex items-center justify-between gap-3 rounded-[18px] border px-5 py-4 text-left text-[16px] font-semibold text-white transition-transform active:scale-[0.98] disabled:cursor-default " +
                (picked === null ? "hover:-translate-y-[1px]" : "")
              }
              style={style}
            >
              <span>{opt}</span>
              {showState && isAnswer && (
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#34d399] text-[#06231a]">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              )}
              {showState && chosen && !isAnswer && (
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#f87171] text-[#2a0a0a]">
                  <X className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Explanation reveals after answering. */}
      {picked !== null && (
        <div
          className={
            "rounded-[18px] border p-4 " +
            (reduced ? "" : "rise-in")
          }
          style={{
            borderColor: isCorrect ? "rgba(52,211,153,0.4)" : `${theme.hex}40`,
            background: isCorrect ? "rgba(52,211,153,0.1)" : `${theme.hex}14`,
          }}
        >
          <div
            className="mb-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em]"
            style={{ color: isCorrect ? "#6ee7b7" : theme.hexSoft }}
          >
            {isCorrect ? "Toʻgʻri!" : "Mana sababi"}
          </div>
          <p className="text-[14.5px] leading-[1.55] text-white/85">
            {reel.explain}
          </p>
        </div>
      )}

      {picked === null && (
        <p className="text-[12.5px] text-white/40">
          {active ? "Bittasini tanlang" : ""}
        </p>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* REAL-WORLD reel                                                        */
/* ---------------------------------------------------------------------- */

export function RealWorldReelView({
  reel,
  reduced,
}: {
  reel: RealWorldReel;
  reduced: boolean;
}) {
  const theme = ACCENTS[reel.accent];
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-full w-full flex-col justify-center gap-6 px-1">
      <Kicker subject={reel.subject} kicker={reel.kicker} theme={theme} />

      <h2 className="font-serif text-[1.95rem] font-medium leading-[1.12] tracking-[-0.02em] text-white sm:text-[2.3rem]">
        {reel.hook}
      </h2>

      <p className="max-w-[34rem] text-[15.5px] leading-[1.6] text-white/75">
        {reel.body}
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex w-fit items-center gap-2 rounded-full px-5 py-3 text-[15px] font-semibold text-white transition-transform active:scale-[0.97]"
          style={{
            background: `${theme.hex}26`,
            border: `1px solid ${theme.hex}55`,
          }}
        >
          {reel.reveal.prompt}
          <ArrowRight className="h-4 w-4" />
        </button>
      ) : (
        <div
          className={"rounded-[18px] border p-4 " + (reduced ? "" : "rise-in")}
          style={{
            borderColor: `${theme.hex}45`,
            background: `${theme.hex}14`,
          }}
        >
          <div
            className="mb-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em]"
            style={{ color: theme.hexSoft }}
          >
            {reel.reveal.prompt}
          </div>
          <p className="text-[15px] leading-[1.6] text-white/85">
            {reel.reveal.answer}
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Per-reel confetti host (used by the feed for quiz bursts)              */
/* ---------------------------------------------------------------------- */

export function ReelConfetti({
  fire,
  accent,
  reduced,
}: {
  fire: boolean;
  accent: keyof typeof ACCENTS;
  reduced: boolean;
}) {
  return (
    <Confetti fire={fire} colors={ACCENTS[accent].confetti} reduced={reduced} />
  );
}
