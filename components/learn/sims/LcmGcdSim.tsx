"use client";

/**
 * LcmGcdSim — EKUK (LCM) & EKUB (GCD) on a shared number line. (key: "ekub-ekuk")
 *
 * MODEL (the math, written first — code matches this):
 *   For two integers a, b ≥ 1 over the range 1..N:
 *     • Multiples of a  = { k : k mod a = 0 }   (gold ticks on the line)
 *     • Multiples of b  = { k : k mod b = 0 }   (teal ticks on the line)
 *     • Common multiples = multiples of both → first one is EKUK(a, b) = lcm.
 *         lcm(a, b) = a·b / gcd(a, b).
 *     • Divisors of a   = { d : a mod d = 0 }; divisors of b likewise.
 *         Shared divisors are the COMMON divisors; the largest is EKUB = gcd.
 *
 *   gcd via Euclid: gcd(a,0)=a, gcd(a,b)=gcd(b, a mod b).
 *   Identity shown live: EKUB · EKUK = a · b.
 *
 *   Defaults a=8, b=12 ⇒ EKUK = 24, EKUB = 4, and 4·24 = 96 = 8·12. ✓
 *
 * KEY VISUAL (top): a number line 1..N. Numbers divisible by a glow gold,
 *   by b glow teal, by BOTH get a ring — and the FIRST ringed number (EKUK)
 *   pulses. Below, the common divisors are chips with EKUB crowned. A rAF loop
 *   drives only the gentle pulse on the EKUK marker; everything else is static.
 *   prefers-reduced-motion disables the pulse (the marker stays solid).
 *
 * INTERACTION: −/+ steppers for a and b. Tap any number on the line to inspect
 *   whether it is a multiple of a, b, or both.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";

interface Props {
  onComplete?: () => void;
  config?: Record<string, unknown>;
}

const N = 36; // number-line range 1..N
const A_MAX = 12;
const B_MAX = 18;

const GOLD = "#e8a21a";
const TEAL = "#2f8f74";

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

function lcm(a: number, b: number): number {
  return (a * b) / gcd(a, b);
}

function divisors(n: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= n; d++) if (n % d === 0) out.push(d);
  return out;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

export function LcmGcdSim({ onComplete, config }: Props) {
  const uid = useId();
  const [a, setA] = useState<number>(Number(config?.a ?? 8) || 8);
  const [b, setB] = useState<number>(Number(config?.b ?? 12) || 12);
  const [inspect, setInspect] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);

  // --- gentle pulse for the EKUK marker (rAF, not CSS keyframe) ------------
  const [pulse, setPulse] = useState(0);
  const rafRef = useRef(0);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setPulse(0);
      return;
    }
    let mounted = true;
    const start = performance.now();
    const loop = (now: number) => {
      if (!mounted) return;
      // 0..1 triangle-ish sine; ~1.6s period
      setPulse((Math.sin((now - start) / 255) + 1) / 2);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      mounted = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function mark() {
    if (!touched) {
      setTouched(true);
      onComplete?.();
    }
  }

  const ekuk = lcm(a, b);
  const ekub = gcd(a, b);

  const commonDivisors = useMemo(() => {
    const da = new Set(divisors(a));
    return divisors(b).filter((d) => da.has(d));
  }, [a, b]);

  // Geometry for the number line.
  const VBW = 360;
  const PADX = 8;
  const cell = (VBW - 2 * PADX) / N;
  const lineY = 30;
  const r = Math.min(cell / 2 - 1.5, 9);

  const numbers = useMemo(() => Array.from({ length: N }, (_, i) => i + 1), []);

  const inspectInfo =
    inspect != null
      ? {
          n: inspect,
          ofA: inspect % a === 0,
          ofB: inspect % b === 0,
        }
      : null;

  return (
    <div className="flex w-full flex-col gap-3">
      {/* KEY VISUAL — number line at the very top. */}
      <div className="rounded-[16px] border border-void-500 bg-void-700/50 p-3">
        {/* legend */}
        <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 px-0.5">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-void-200">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: GOLD }} />
            {a} ning karralisi
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-void-200">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: TEAL }} />
            {b} ning karralisi
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-void-200">
            <span
              className="h-2.5 w-2.5 rounded-full border-2"
              style={{ borderColor: "#1a1813", background: "#fff" }}
            />
            ikkalasi
          </span>
        </div>

        <svg
          viewBox={`0 0 ${VBW} 58`}
          width="100%"
          className="block"
          role="img"
          aria-label={`1 dan ${N} gacha sonlar; ${a} va ${b} ning karralilari belgilangan`}
        >
          {/* baseline */}
          <line
            x1={PADX}
            y1={lineY}
            x2={VBW - PADX}
            y2={lineY}
            stroke="rgba(132,126,107,0.45)"
            strokeWidth={1}
          />
          {numbers.map((n) => {
            const cx = PADX + (n - 0.5) * cell;
            const ofA = n % a === 0;
            const ofB = n % b === 0;
            const both = ofA && ofB;
            const isEkuk = n === ekuk;
            const isInspected = inspect === n;

            let fill = "rgba(132,126,107,0.18)";
            if (both) fill = "#ffffff";
            else if (ofA) fill = GOLD;
            else if (ofB) fill = TEAL;

            // EKUK marker pulses.
            const pulseR = isEkuk ? r + 2 + pulse * 2.5 : 0;

            return (
              <g key={n} className="cursor-pointer" onClick={() => { setInspect(n); mark(); }}>
                {isEkuk && (
                  <circle
                    cx={cx}
                    cy={lineY}
                    r={pulseR}
                    fill="none"
                    stroke={GOLD}
                    strokeWidth={1.5}
                    opacity={0.35 + 0.4 * (1 - pulse)}
                  />
                )}
                <circle
                  cx={cx}
                  cy={lineY}
                  r={both ? r + 1 : r}
                  fill={fill}
                  stroke={both || isInspected ? "#1a1813" : "rgba(132,126,107,0.4)"}
                  strokeWidth={both ? 2 : isInspected ? 1.5 : 1}
                />
                {/* number label below */}
                <text
                  x={cx}
                  y={lineY + r + 14}
                  fontSize={cell > 8 ? 8 : 0}
                  fontWeight={both ? 700 : 500}
                  fill={both ? "#1a1813" : "rgba(85,81,63,0.85)"}
                  textAnchor="middle"
                >
                  {n}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Live EKUK / EKUB readout */}
        <div className="mt-1 grid grid-cols-2 gap-2">
          <div className="flex flex-col items-center rounded-[10px] bg-void-900/60 px-2 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-void-300">
              EKUK ({a}, {b})
            </span>
            <span className="font-mono text-[18px] font-bold tabular-nums text-void-100">
              {ekuk}
            </span>
          </div>
          <div className="flex flex-col items-center rounded-[10px] bg-void-900/60 px-2 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-void-300">
              EKUB ({a}, {b})
            </span>
            <span className="font-mono text-[18px] font-bold tabular-nums text-void-100">
              {ekub}
            </span>
          </div>
        </div>
      </div>

      {/* Inspect bubble */}
      {inspectInfo && (
        <div className="rounded-[12px] border border-void-500 bg-void-700/50 px-3 py-2 text-[12px] text-void-200">
          <span className="font-mono font-bold text-void-100">{inspectInfo.n}</span>{" "}
          {inspectInfo.ofA && inspectInfo.ofB ? (
            <>
              — <span className="font-semibold" style={{ color: "#1a1813" }}>umumiy karrali</span>:{" "}
              {a} ga ham, {b} ga ham boʻlinadi.
              {inspectInfo.n === ekuk && " Bu — birinchisi, demak EKUK."}
            </>
          ) : inspectInfo.ofA ? (
            <>faqat {a} ga boʻlinadi.</>
          ) : inspectInfo.ofB ? (
            <>faqat {b} ga boʻlinadi.</>
          ) : (
            <>na {a} ga, na {b} ga boʻlinadi.</>
          )}
        </div>
      )}

      {/* Common divisors → EKUB */}
      <div className="rounded-[12px] border border-void-500 bg-void-700/40 p-2.5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-void-300">
          Umumiy boʻluvchilar — eng kattasi = EKUB
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {commonDivisors.map((d) => (
            <span
              key={d}
              className={`flex h-7 items-center rounded-full px-3 font-mono text-[12px] font-semibold tabular-nums ${
                d === ekub
                  ? "bg-antares-500/25 text-void-100 ring-2 ring-antares-500"
                  : "bg-void-900/50 text-void-200"
              }`}
            >
              {d === ekub ? `★ ${d}` : d}
            </span>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center justify-between gap-2 rounded-[12px] border border-void-500 bg-void-700/50 px-2.5 py-2">
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-void-200">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: GOLD }} /> a
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="a kamaytirish"
              onClick={() => { setA((v) => Math.max(2, v - 1)); mark(); }}
              disabled={a <= 2}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-void-500 bg-void-800 text-[16px] font-bold leading-none text-void-100 transition active:scale-95 disabled:opacity-40"
            >
              −
            </button>
            <span className="w-6 text-center font-mono text-[15px] font-bold tabular-nums text-void-100">
              {a}
            </span>
            <button
              type="button"
              aria-label="a oshirish"
              onClick={() => { setA((v) => Math.min(A_MAX, v + 1)); mark(); }}
              disabled={a >= A_MAX}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-void-500 bg-void-800 text-[16px] font-bold leading-none text-void-100 transition active:scale-95 disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-[12px] border border-void-500 bg-void-700/50 px-2.5 py-2">
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-void-200">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: TEAL }} /> b
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="b kamaytirish"
              onClick={() => { setB((v) => Math.max(2, v - 1)); mark(); }}
              disabled={b <= 2}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-void-500 bg-void-800 text-[16px] font-bold leading-none text-void-100 transition active:scale-95 disabled:opacity-40"
            >
              −
            </button>
            <span className="w-6 text-center font-mono text-[15px] font-bold tabular-nums text-void-100">
              {b}
            </span>
            <button
              type="button"
              aria-label="b oshirish"
              onClick={() => { setB((v) => Math.min(B_MAX, v + 1)); mark(); }}
              disabled={b >= B_MAX}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-void-500 bg-void-800 text-[16px] font-bold leading-none text-void-100 transition active:scale-95 disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <p className="text-[12px] leading-relaxed text-void-300" id={`${uid}-id`}>
        Birinchi <span className="text-void-100">umumiy karrali</span> — EKUK ({ekuk}). Eng katta{" "}
        <span className="text-void-100">umumiy boʻluvchi</span> — EKUB ({ekub}). Tekshiring:{" "}
        <span className="font-mono text-void-100">
          {ekub} × {ekuk} = {ekub * ekuk} = {a} × {b}
        </span>
        .
      </p>
    </div>
  );
}
