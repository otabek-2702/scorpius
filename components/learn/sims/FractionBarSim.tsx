"use client";

/**
 * FractionBarSim — see-the-fraction lab. (registry key: "kasr")
 *
 * MODEL (the math, written first — code matches this):
 *   A fraction a/b is rendered as a horizontal bar split into b equal cells,
 *   of which a are filled. Its value is exactly a/b ∈ ℝ.
 *
 *   Two fractions live side by side so every MCQ in `oddiy-kasr` becomes
 *   visible at a glance:
 *     • compare 1/3 vs 1/5      → top bar is fuller (smaller maxraj ⇒ bigger piece)
 *     • equal-to-1/2            → a half-line crosses both bars; 2/4, 3/6, 5/10
 *                                 land exactly on it, 3/8 does not
 *     • reduce 6/8              → reduce(a,b) = (a/g, b/g) with g = gcd(a,b);
 *                                 6/8 → 3/4 (same fill, fewer cells)
 *     • proper vs improper      → a < b proper, a = b butun, a > b improper
 *                                 (improper bars overflow into a second row of
 *                                  cells = whole + remainder)
 *
 *   gcd via Euclid: gcd(a,0)=a, gcd(a,b)=gcd(b, a mod b). Value comparison is
 *   done with integer cross-multiplication (a1·b2 vs a2·b1) — no float error.
 *
 * INTERACTION: each bar has − / + steppers for surat (numerator) and maxraj
 *   (denominator); maxraj ≥ 1. Preset chips jump straight to the MCQ scenarios.
 *   The bars are at the TOP so the ~150px compact preview reads correctly.
 *
 * RENDER: pure SVG, no animation loop needed (state is discrete). A short CSS
 *   transition on cell width respects prefers-reduced-motion via the
 *   `motion-reduce:` Tailwind variant.
 */

import { useId, useMemo, useState } from "react";

interface Props {
  onComplete?: () => void;
  config?: Record<string, unknown>;
}

interface Frac {
  a: number; // surat (numerator)
  b: number; // maxraj (denominator), ≥ 1
}

const MAX_DEN = 12;
const MAX_NUM = 24; // allow improper fractions up to 2 wholes

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

/** Integer-exact comparison of a1/b1 vs a2/b2 → -1, 0, 1. */
function cmp(f1: Frac, f2: Frac): number {
  const l = f1.a * f2.b;
  const r = f2.a * f1.b;
  return l < r ? -1 : l > r ? 1 : 0;
}

/** Is a/b exactly one half? (b even and a = b/2.) */
function isHalf(f: Frac): boolean {
  return f.b % 2 === 0 && f.a * 2 === f.b;
}

type FracKind = "proper" | "whole" | "improper";
function kindOf(f: Frac): FracKind {
  if (f.a < f.b) return "proper";
  if (f.a === f.b) return "whole";
  return "improper";
}

const KIND_LABEL: Record<FracKind, string> = {
  proper: "toʻgʻri kasr",
  whole: "butun",
  improper: "notoʻgʻri kasr",
};

const GOLD = "#e8a21a";
const GOLD_SOFT = "#f4b63e";
const TEAL = "#2f8f74";
const TEAL_SOFT = "#57b89c";

interface Preset {
  label: string;
  top: Frac;
  bottom: Frac;
}

const PRESETS: Preset[] = [
  { label: "1/3 va 1/5", top: { a: 1, b: 3 }, bottom: { a: 1, b: 5 } },
  { label: "6/8 → 3/4", top: { a: 6, b: 8 }, bottom: { a: 3, b: 4 } },
  { label: "1/2 ga teng?", top: { a: 3, b: 6 }, bottom: { a: 3, b: 8 } },
  { label: "7/4 (notoʻgʻri)", top: { a: 7, b: 4 }, bottom: { a: 3, b: 8 } },
];

// ---- One fraction bar (the key visual) -------------------------------------

const BAR_W = 300;
const ROW_H = 34;
const ROW_GAP = 6;

function FractionBar({
  f,
  color,
  colorSoft,
  half,
}: {
  f: Frac;
  color: string;
  colorSoft: string;
  half: boolean;
}) {
  // Cells beyond the first `b` spill onto a second row (improper fractions).
  const rows = Math.max(1, Math.ceil(f.a / f.b) || 1);
  const totalRows = Math.max(rows, 1);
  const cellW = BAR_W / f.b;

  const cells: Array<{ row: number; col: number; filled: boolean }> = [];
  for (let row = 0; row < totalRows; row++) {
    for (let col = 0; col < f.b; col++) {
      const idx = row * f.b + col;
      cells.push({ row, col, filled: idx < f.a });
    }
  }

  const svgH = totalRows * ROW_H + (totalRows - 1) * ROW_GAP;

  return (
    <svg
      viewBox={`0 0 ${BAR_W} ${svgH}`}
      width="100%"
      className="block"
      role="img"
      aria-label={`${f.a} bo'lakdan ${f.b} ta`}
      style={{ maxHeight: svgH }}
      preserveAspectRatio="xMidYMid meet"
    >
      {cells.map((cell, i) => {
        const x = cell.col * cellW;
        const y = cell.row * (ROW_H + ROW_GAP);
        return (
          <rect
            key={i}
            x={x + 1}
            y={y + 1}
            width={Math.max(0, cellW - 2)}
            height={ROW_H - 2}
            rx={4}
            fill={cell.filled ? (cell.row > 0 ? colorSoft : color) : "rgba(132,126,107,0.12)"}
            stroke={cell.filled ? "#1a1813" : "rgba(132,126,107,0.45)"}
            strokeWidth={1}
            strokeDasharray={cell.filled ? undefined : "3 3"}
            className="motion-safe:transition-all motion-safe:duration-300"
          />
        );
      })}

      {/* The "half" reference line — only on the first row so equal-to-1/2 is visible. */}
      {half && (
        <line
          x1={BAR_W / 2}
          y1={-1}
          x2={BAR_W / 2}
          y2={ROW_H + 1}
          stroke="#1a1813"
          strokeWidth={2.5}
          strokeDasharray="4 3"
          opacity={0.75}
        />
      )}
    </svg>
  );
}

// ---- Stepper control --------------------------------------------------------

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-[10px] bg-void-900/50 px-2 py-1.5">
      <span className="text-[11px] font-semibold text-void-200">{label}</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label={`${label} kamaytirish`}
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-void-500 bg-void-800 text-[16px] font-bold leading-none text-void-100 transition active:scale-95 disabled:opacity-40"
        >
          −
        </button>
        <span className="w-6 text-center font-mono text-[15px] font-bold tabular-nums text-void-100">
          {value}
        </span>
        <button
          type="button"
          aria-label={`${label} oshirish`}
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-void-500 bg-void-800 text-[16px] font-bold leading-none text-void-100 transition active:scale-95 disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ---- Component --------------------------------------------------------------

export function FractionBarSim({ onComplete, config }: Props) {
  const uid = useId();
  const initTop = (config?.top as Frac | undefined) ?? { a: 1, b: 3 };
  const initBottom = (config?.bottom as Frac | undefined) ?? { a: 1, b: 5 };

  const [top, setTop] = useState<Frac>(initTop);
  const [bottom, setBottom] = useState<Frac>(initBottom);
  const [touched, setTouched] = useState(false);

  function mark() {
    if (!touched) {
      setTouched(true);
      onComplete?.();
    }
  }

  // Surat is capped at 2 wholes (2·maxraj) so the bar never exceeds 2 rows —
  // keeps the compact preview readable while still allowing improper fractions.
  const numMax = (b: number) => Math.min(MAX_NUM, 2 * b);

  const setTopA = (a: number) => { mark(); setTop((f) => ({ ...f, a })); };
  const setTopB = (b: number) => { mark(); setTop((f) => ({ ...f, b, a: Math.min(f.a, numMax(b)) })); };
  const setBotA = (a: number) => { mark(); setBottom((f) => ({ ...f, a })); };
  const setBotB = (b: number) => { mark(); setBottom((f) => ({ ...f, b, a: Math.min(f.a, numMax(b)) })); };

  function applyPreset(p: Preset) {
    if (!touched) {
      setTouched(true);
      onComplete?.();
    }
    setTop(p.top);
    setBottom(p.bottom);
  }

  const relation = cmp(top, bottom); // -1 top<bottom, 0 equal, 1 top>bottom
  const relText =
    relation === 0
      ? `${top.a}/${top.b} = ${bottom.a}/${bottom.b}`
      : relation > 0
        ? `${top.a}/${top.b} > ${bottom.a}/${bottom.b}`
        : `${top.a}/${top.b} < ${bottom.a}/${bottom.b}`;

  const topReduced = useMemo(() => {
    const g = gcd(top.a, top.b);
    return { a: top.a / g, b: top.b / g, g };
  }, [top]);

  const topKind = kindOf(top);

  return (
    <div className="flex w-full flex-col gap-3">
      {/* KEY VISUAL — two bars, at the very top so the compact preview reads. */}
      <div className="rounded-[16px] border border-void-500 bg-void-700/50 p-3">
        <div className="flex flex-col gap-3">
          {/* Top bar */}
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between px-0.5">
              <span className="font-mono text-[13px] font-bold tabular-nums text-void-100">
                {top.a}/{top.b}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-void-300">
                {KIND_LABEL[topKind]}
              </span>
            </div>
            <FractionBar f={top} color={GOLD} colorSoft={GOLD_SOFT} half={isHalf(top)} />
          </div>

          {/* Bottom bar */}
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between px-0.5">
              <span className="font-mono text-[13px] font-bold tabular-nums text-void-100">
                {bottom.a}/{bottom.b}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-void-300">
                {KIND_LABEL[kindOf(bottom)]}
              </span>
            </div>
            <FractionBar f={bottom} color={TEAL} colorSoft={TEAL_SOFT} half={isHalf(bottom)} />
          </div>
        </div>

        {/* Live verdict */}
        <div className="mt-2.5 flex items-center justify-center rounded-[10px] bg-void-900/60 px-3 py-1.5">
          <span className="font-mono text-[14px] font-bold tabular-nums text-void-100">
            {relText}
          </span>
        </div>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => applyPreset(p)}
            className="rounded-full border border-void-500 bg-void-700 px-3 py-1.5 text-[11px] font-semibold text-void-100 transition hover:bg-void-600 active:scale-95"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Controls — two columns */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5 rounded-[12px] border border-void-500 bg-void-700/50 p-2">
          <div className="flex items-center gap-1.5 px-0.5">
            <span className="h-2 w-2 rounded-full" style={{ background: GOLD }} />
            <span className="text-[11px] font-semibold text-void-200">Birinchi kasr</span>
          </div>
          <Stepper label="Surat" value={top.a} min={0} max={numMax(top.b)} onChange={setTopA} />
          <Stepper label="Maxraj" value={top.b} min={1} max={MAX_DEN} onChange={setTopB} />
        </div>
        <div className="flex flex-col gap-1.5 rounded-[12px] border border-void-500 bg-void-700/50 p-2">
          <div className="flex items-center gap-1.5 px-0.5">
            <span className="h-2 w-2 rounded-full" style={{ background: TEAL }} />
            <span className="text-[11px] font-semibold text-void-200">Ikkinchi kasr</span>
          </div>
          <Stepper label="Surat" value={bottom.a} min={0} max={numMax(bottom.b)} onChange={setBotA} />
          <Stepper label="Maxraj" value={bottom.b} min={1} max={MAX_DEN} onChange={setBotB} />
        </div>
      </div>

      {/* Reduce hint for the top bar */}
      <p className="text-[12px] leading-relaxed text-void-300" id={`${uid}-hint`}>
        {topReduced.g > 1 ? (
          <>
            Birinchi kasrni qisqartiramiz: EKUB({top.a}, {top.b}) = {topReduced.g}, demak{" "}
            <span className="font-mono text-void-100">
              {top.a}/{top.b} = {topReduced.a}/{topReduced.b}
            </span>
            . Bir xil rang, kam boʻlak.
          </>
        ) : top.a === 0 ? (
          <>Surat 0 boʻlsa, kasr 0 ga teng — hech bir boʻlak boʻyalmaydi.</>
        ) : (
          <>
            Maxraj kichik boʻlsa, har bir boʻlak kattaroq. Surat maxrajdan katta boʻlsa — kasr
            butundan oshib, ikkinchi qatorga oʻtadi.
          </>
        )}
      </p>
    </div>
  );
}
