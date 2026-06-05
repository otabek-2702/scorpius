// components/laboratoriya/kimyo/AtomViewer.tsx
/**
 * AtomViewer — the "Atomlar" Bohr-model stage.
 *
 * Paints ONE element's atom on the cinematic dark stage: a nucleus drawn as
 * individually packed PROTONS (red, +) and NEUTRONS (grey, 0), with electrons
 * orbiting in concentric shells. The orbit motion is a pure function of the
 * monotonic `clock` (ms) passed from the parent rAF loop — no CSS keyframes, so
 * it stays in lockstep with the rest of the lab and honors reduced-motion (when
 * the parent stops ticking the clock the electrons simply hold position).
 *
 * The nucleus packing + electron placement are deterministic (seeded by index),
 * so the same element always draws the same picture. Labels show Z, mass number
 * A = Z + N, the neutron count, and the electron configuration (shell list).
 * This view paints only — the atomic structure comes from data.ts.
 */
"use client";

import { useMemo } from "react";
import {
  ATOMS,
  atomStructure,
  massNumber,
  shellConfig,
  type AtomStructure,
} from "@/lib/sims/chemistry/data";
import { PT_BY_SYM } from "@/lib/sims/chemistry/periodic";

const VBW = 520;
const VBH = 360;
const CX = VBW / 2;
const CY = VBH / 2;

interface Props {
  /** Element symbol to render (e.g. "Na"). */
  sym: string;
  /** Monotonic ms clock from the parent rAF loop (drives orbit motion). */
  clock: number;
  /** Reduced-motion: freeze electrons at their phase-0 positions. */
  reduced?: boolean;
}

export default function AtomViewer({ sym, clock, reduced }: Props) {
  const struct = useMemo(() => atomStructure(sym), [sym]);
  const pt = PT_BY_SYM[sym];

  // packed nucleon positions — deterministic spiral packing (sunflower)
  const nucleons = useMemo(() => (struct ? packNucleus(struct) : []), [struct]);

  if (!struct) {
    return (
      <div
        className="relative mx-auto flex w-full items-center justify-center"
        style={{ aspectRatio: `${VBW} / ${VBH}` }}
      >
        <p className="text-[13px] text-[#5b6b7d]">Maʼlumot topilmadi</p>
      </div>
    );
  }

  const A = massNumber(struct);
  const info = ATOMS[sym];
  const accent = info?.color ?? pt?.color ?? "#9fb4c8";
  const t = (reduced ? 0 : clock) / 1000;

  // shell radii: pack the shells between the nucleus edge and the frame
  const nucleusR = nucleusRadius(struct.protons + struct.neutrons);
  const shellCount = struct.shells.length;
  const maxOrbit = Math.min(VBW, VBH) / 2 - 24;
  const innerOrbit = nucleusR + 28;
  const orbitGap =
    shellCount > 1 ? (maxOrbit - innerOrbit) / (shellCount - 1) : 0;

  return (
    <div
      className="relative mx-auto w-full self-center"
      style={{ aspectRatio: `${VBW} / ${VBH}` }}
    >
      <svg
        viewBox={`0 0 ${VBW} ${VBH}`}
        className="absolute inset-0 block h-full w-full"
        role="img"
        aria-label={`${info?.nameUz ?? sym} atomi — Bor modeli: ${struct.protons} proton, ${struct.neutrons} neytron, elektron qavatlari ${shellConfig(struct)}`}
      >
        <defs>
          <radialGradient id="av-stage" cx="50%" cy="44%" r="75%">
            <stop offset="0%" stopColor="#11161d" />
            <stop offset="100%" stopColor="#0b0f14" />
          </radialGradient>
          <radialGradient id="av-proton" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#ffd0c4" />
            <stop offset="45%" stopColor="#ff5a45" />
            <stop offset="100%" stopColor="#a8160a" />
          </radialGradient>
          <radialGradient id="av-neutron" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#e6ebf1" />
            <stop offset="45%" stopColor="#9aa6b3" />
            <stop offset="100%" stopColor="#566270" />
          </radialGradient>
          <radialGradient id="av-electron" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#eaf7ff" />
            <stop offset="55%" stopColor="#5cc8ff" />
            <stop offset="100%" stopColor="#1f73b8" />
          </radialGradient>
          <filter id="av-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.4" />
          </filter>
        </defs>

        <rect x={0} y={0} width={VBW} height={VBH} fill="url(#av-stage)" />

        {/* ---------- electron shells (orbit rings) ---------- */}
        {struct.shells.map((_, s) => {
          const r = innerOrbit + orbitGap * s;
          return (
            <circle
              key={`orbit-${s}`}
              cx={CX}
              cy={CY}
              r={r}
              fill="none"
              stroke="#26323f"
              strokeWidth={1.2}
              strokeDasharray="2 5"
            />
          );
        })}

        {/* ---------- electrons on each shell ---------- */}
        {struct.shells.map((count, s) => {
          const r = innerOrbit + orbitGap * s;
          // each shell rotates at its own rate (inner faster) — purely cosmetic
          const speed = 0.55 - s * 0.07;
          const phase = t * speed + s * 0.7;
          return Array.from({ length: count }).map((_, k) => {
            const ang = (k / count) * Math.PI * 2 + phase;
            const ex = CX + Math.cos(ang) * r;
            const ey = CY + Math.sin(ang) * r;
            return (
              <g key={`e-${s}-${k}`}>
                <circle cx={ex} cy={ey} r={6.5} fill="#5cc8ff" opacity={0.25} filter="url(#av-glow)" />
                <circle cx={ex} cy={ey} r={4.2} fill="url(#av-electron)" />
                <text
                  x={ex}
                  y={ey + 2.4}
                  textAnchor="middle"
                  fontSize={6}
                  fontWeight={800}
                  fill="#06243a"
                  pointerEvents="none"
                >
                  −
                </text>
              </g>
            );
          });
        })}

        {/* ---------- nucleus (packed protons + neutrons) ---------- */}
        <g>
          {/* soft nucleus aura */}
          <circle cx={CX} cy={CY} r={nucleusR + 6} fill={accent} opacity={0.1} filter="url(#av-glow)" />
          {nucleons.map((n) => (
            <g key={n.id}>
              <circle
                cx={CX + n.x}
                cy={CY + n.y}
                r={n.r}
                fill={n.kind === "p" ? "url(#av-proton)" : "url(#av-neutron)"}
                stroke={n.kind === "p" ? "#7a0d05" : "#3c4651"}
                strokeWidth={0.6}
              />
              {n.r > 5.5 && (
                <text
                  x={CX + n.x}
                  y={CY + n.y + n.r * 0.36}
                  textAnchor="middle"
                  fontSize={n.r * 0.95}
                  fontWeight={800}
                  fill={n.kind === "p" ? "#ffe6e0" : "#1d242c"}
                  pointerEvents="none"
                >
                  {n.kind === "p" ? "+" : "0"}
                </text>
              )}
            </g>
          ))}
        </g>

        {/* ---------- corner labels ---------- */}
        {/* element badge (top-left) */}
        <g transform="translate(16,16)">
          <rect width={64} height={64} rx={12} fill="#0f1620" stroke={accent} strokeWidth={1.6} />
          <text x={8} y={18} fontSize={11} fontWeight={700} fill="#8fa1b3" fontFamily="monospace">
            {struct.protons}
          </text>
          <text
            x={32}
            y={44}
            textAnchor="middle"
            fontSize={26}
            fontWeight={800}
            fill={sym === "H" ? "#e9eef4" : accent}
            fontFamily="serif"
          >
            {sym}
          </text>
          <text x={56} y={60} textAnchor="end" fontSize={9.5} fontWeight={700} fill="#8fa1b3" fontFamily="monospace">
            {A}
          </text>
        </g>

        {/* legend (bottom-left): proton / neutron / electron */}
        <g transform={`translate(16,${VBH - 22})`} fontFamily="sans-serif">
          <circle cx={6} cy={0} r={5} fill="url(#av-proton)" />
          <text x={15} y={3.5} fontSize={10} fill="#aab8c6">proton +</text>
          <circle cx={78} cy={0} r={5} fill="url(#av-neutron)" />
          <text x={87} y={3.5} fontSize={10} fill="#aab8c6">neytron 0</text>
          <circle cx={162} cy={0} r={4.5} fill="url(#av-electron)" />
          <text x={171} y={3.5} fontSize={10} fill="#aab8c6">elektron −</text>
        </g>

        {/* approximate flag for non-curated elements */}
        {!struct.exact && (
          <text x={VBW - 14} y={VBH - 14} textAnchor="end" fontSize={10} fill="#6c7c8d">
            Bor modeli · taxminiy neytron
          </text>
        )}
      </svg>
    </div>
  );
}

/* ---------------------------------------------------------- nucleus packing */

interface Nucleon {
  id: string;
  kind: "p" | "n";
  x: number;
  y: number;
  r: number;
}

/** Render radius of one nucleon, shrinking gently as the nucleus grows. */
function nucleonRadius(total: number): number {
  if (total <= 4) return 11;
  if (total <= 16) return 9;
  if (total <= 40) return 7;
  if (total <= 80) return 5.4;
  return 4.4;
}

/** Overall nucleus radius from the nucleon count (for orbit spacing + aura). */
function nucleusRadius(total: number): number {
  const nr = nucleonRadius(total);
  // sunflower packing radius ≈ nr * sqrt(total) * spacing
  return Math.max(nr * 1.3, nr * Math.sqrt(Math.max(1, total)) * 0.95);
}

/**
 * Pack protons + neutrons into a tight cluster via a sunflower (Vogel) spiral —
 * deterministic, even, and dense. Protons + neutrons are interleaved so the
 * nucleus reads as a mixed cluster (not two separated halves).
 */
function packNucleus(s: AtomStructure): Nucleon[] {
  const p = s.protons;
  const n = s.neutrons;
  const total = p + n;
  const r = nucleonRadius(total);
  const golden = Math.PI * (3 - Math.sqrt(5)); // ≈ 2.39996 rad
  // interleave: walk a merged sequence, alternating by ratio so colors mix
  const seq: ("p" | "n")[] = [];
  let pi = 0;
  let ni = 0;
  for (let i = 0; i < total; i++) {
    // pick whichever is "behind" its target fraction
    const wantP = (pi + 0.5) / Math.max(1, p);
    const wantN = (ni + 0.5) / Math.max(1, n);
    if (ni >= n || (pi < p && wantP <= wantN)) {
      seq.push("p");
      pi++;
    } else {
      seq.push("n");
      ni++;
    }
  }
  const spacing = r * 1.55;
  return seq.map((kind, i) => {
    const radius = spacing * Math.sqrt(i + 0.5);
    const ang = i * golden;
    return {
      id: `${kind}-${i}`,
      kind,
      x: Math.cos(ang) * radius,
      y: Math.sin(ang) * radius,
      r,
    };
  });
}
