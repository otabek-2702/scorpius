// components/laboratoriya/LaboratoriyaHub.tsx
/**
 * LaboratoriyaHub — the premium MULTI-SUBJECT landing for Scorpius' virtual lab.
 *
 * A warm-light app section (matching app/page.tsx + SkyView.tsx) framing the
 * full catalog of labs across Fizika · Kimyo · Biologiya · Matematika · Astronomiya. A
 * segmented subject-tab pill (mirroring SkyView's SubjectToggle) filters what
 * shows: "Hammasi" reveals everything, each subject shows only its own cards.
 *
 * Card kinds (data-driven from labsCatalog.ts):
 *   • "lab"        — a big card whose thumbnail is a genuinely-LIVE dark-stage
 *                    mini-sim:
 *                      – Fizika    real 1-D elastic collision (teal)
 *                      – Kimyo     H+H+O assembling into H₂O (violet)
 *                      – Biologiya a B-DNA double helix, rigid uniform rotation
 *                        about its axis, complementary base-pair rungs (emerald)
 *   • "experiment" — a compact quick-tajriba tile → /laboratoriya/tajriba/<key>
 *   • "soon"       — a tasteful dashed "Tez orada" placeholder
 *
 * Architecture law (AGENTS.md): every preview's motion is driven by ONE
 * requestAnimationFrame loop (useStageClock) integrating/evaluating a tiny model
 * on the clock — never CSS keyframes faking physics. prefers-reduced-motion →
 * the clock freezes and previews snap to a settled frame. The full sims (with
 * their own SimModel + model.md) live in the fizika/ + kimyo/ folders + the
 * biologiya/ route owned by other agents; these are lightweight, self-contained
 * previews. Preview geometry/equations are documented in labsHub.model.md.
 *
 * Renders NO back link (the hub IS the root) but DOES own <BottomNav /> and the
 * shrink-0 + pb-36 page shell — do not regress the bottom-nav spacing.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { BottomNav } from "@/components/nav/BottomNav";
import { loadProfile } from "@/lib/profile";
import {
  CATALOG,
  SUBJECTS,
  type CatalogEntry,
  type TabId,
} from "./labsCatalog";

/* ============================================================
   Shared stage clock — ONE rAF loop drives every live preview.
   Returns a monotonically-increasing time in seconds. Pauses on
   reduced-motion (callers snap to a settled frame instead).
   ============================================================ */
function useStageClock(reduced: boolean): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setT((now - start) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);
  return t;
}

/* ============================================================
   PHYSICS preview — a real 1-D elastic collision on a dark stage.

   Two balls of mass m1, m2 on a frictionless line. Before impact the
   left ball moves right at u1, the right ball is at rest. At contact the
   1-D elastic-collision solution swaps momentum:
     v1 = ((m1-m2)/(m1+m2))·u1
     v2 = (2·m1/(m1+m2))·u1
   Total momentum p = m1·u1 (constant) is drawn as a teal arrow.

   We loop the encounter analytically (closed-form positions per phase) so
   the preview is deterministic + perf-cheap, yet physically exact — not a
   tween. Period ~3.4 s; reduced-motion snaps to the post-collision frame.
   ============================================================ */
const PHYS_VB_W = 260;
const PHYS_VB_H = 150;

function PhysicsPreview({ t, reduced }: { t: number; reduced: boolean }) {
  // Masses (equal → full momentum transfer, the classic "Newton's cradle" beat).
  const m1 = 1;
  const m2 = 1;
  const u1 = 60; // px/s incoming speed of the left ball

  const v1 = ((m1 - m2) / (m1 + m2)) * u1;
  const v2 = ((2 * m1) / (m1 + m2)) * u1;

  const r1 = 16;
  const r2 = 16;
  const floorY = 96;
  const startX = 46; // left ball start centre
  const contactGap = 96; // distance left ball travels until surfaces touch
  const tHit = contactGap / u1; // s until collision
  const period = 3.4; // s — full encounter loop
  const cycle = reduced ? tHit + 0.9 : t % period;

  let x1: number;
  let x2: number;
  const restX2 = startX + contactGap + r1 + r2;

  if (cycle < tHit) {
    // approach: left moves, right at rest
    x1 = startX + u1 * cycle;
    x2 = restX2;
  } else {
    // after impact: equal masses → left stops, right departs
    const dt = cycle - tHit;
    x1 = startX + contactGap + v1 * dt;
    x2 = restX2 + v2 * dt;
  }

  // Live momentum arrow: the moving ball carries p = m·v.
  const movingRight = cycle >= tHit;
  const arrowFromX = movingRight ? x2 : x1;
  const arrowSpeed = movingRight ? v2 : u1;
  const arrowLen = Math.min(58, arrowSpeed * 0.78);

  return (
    <svg
      viewBox={`0 0 ${PHYS_VB_W} ${PHYS_VB_H}`}
      className="block h-full w-full"
      role="img"
      aria-label="Ikki shar elastik toʻqnashuvi — impuls saqlanadi"
    >
      <defs>
        <linearGradient id="lab-stage-phys" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0b0f14" />
          <stop offset="100%" stopColor="#11161d" />
        </linearGradient>
        <radialGradient id="lab-ball-teal" cx="0.36" cy="0.32" r="0.85">
          <stop offset="0%" stopColor="#aefbef" />
          <stop offset="42%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#0c7a6e" />
        </radialGradient>
        <radialGradient id="lab-ball-ghost" cx="0.36" cy="0.32" r="0.85">
          <stop offset="0%" stopColor="#cdd8e2" />
          <stop offset="45%" stopColor="#7c8a99" />
          <stop offset="100%" stopColor="#3a444f" />
        </radialGradient>
        <filter id="lab-glow-teal" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect x={0} y={0} width={PHYS_VB_W} height={PHYS_VB_H} fill="url(#lab-stage-phys)" />

      {/* faint stage grid for depth */}
      {[0.25, 0.5, 0.75].map((g) => (
        <line
          key={g}
          x1={0}
          y1={PHYS_VB_H * g}
          x2={PHYS_VB_W}
          y2={PHYS_VB_H * g}
          stroke="#2dd4bf"
          strokeOpacity={0.05}
          strokeWidth={1}
        />
      ))}

      {/* frictionless track */}
      <line
        x1={18}
        y1={floorY + r1 + 6}
        x2={PHYS_VB_W - 18}
        y2={floorY + r1 + 6}
        stroke="#2dd4bf"
        strokeOpacity={0.28}
        strokeWidth={2}
        strokeLinecap="round"
      />

      {/* contact flash at the moment of impact — a short fading ring so the
          beat reads even if a frame lands just past tHit */}
      {!reduced && cycle >= tHit && cycle < tHit + 0.18 && (
        <circle
          cx={startX + contactGap + r1}
          cy={floorY}
          r={14 + (cycle - tHit) * 80}
          fill="none"
          stroke="#5eead4"
          strokeWidth={2.5}
          opacity={0.5 * (1 - (cycle - tHit) / 0.18)}
        />
      )}

      {/* the two balls (right ball is the second mass, drawn neutral until hit) */}
      <g filter="url(#lab-glow-teal)">
        <circle cx={x1} cy={floorY} r={r1} fill="url(#lab-ball-teal)" />
      </g>
      <circle
        cx={x2}
        cy={floorY}
        r={r2}
        fill={movingRight ? "url(#lab-ball-teal)" : "url(#lab-ball-ghost)"}
        filter={movingRight ? "url(#lab-glow-teal)" : undefined}
      />
      {/* specular highlights */}
      <circle cx={x1 - 5} cy={floorY - 5} r={3.4} fill="#ffffff" opacity={0.7} />
      <circle cx={x2 - 5} cy={floorY - 5} r={3.4} fill="#ffffff" opacity={movingRight ? 0.7 : 0.3} />

      {/* live momentum arrow — teal, length ∝ |p| of the moving ball */}
      {arrowLen > 6 && (
        <g>
          <line
            x1={arrowFromX}
            y1={floorY - r1 - 12}
            x2={arrowFromX + arrowLen}
            y2={floorY - r1 - 12}
            stroke="#5eead4"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <path
            d={`M ${arrowFromX + arrowLen} ${floorY - r1 - 12} l -7 -5 v 10 z`}
            fill="#5eead4"
          />
        </g>
      )}

      {/* caption chip */}
      <text x={14} y={24} fontSize={11} fontWeight={700} fill="#5eead4" fontFamily="var(--font-geist-mono)">
        p = m·v
      </text>
      <text x={PHYS_VB_W - 14} y={24} fontSize={9.5} textAnchor="end" fill="#8aa0ad">
        impuls saqlanadi
      </text>
    </svg>
  );
}

/* ============================================================
   CHEMISTRY preview — H + H + O assemble into a real H₂O molecule.

   Three atoms ease (ease-out) from a scattered start to the true bent
   geometry of water: O at centre, two H at the H–O–H bond angle of 104.5°.
   CPK colours (O red, H white-outlined on the dark stage). Once bonded the
   molecule gently breathes (bond-length wiggle) to read as "alive". Looping
   the assemble→breathe→scatter cycle; reduced-motion snaps to the bonded
   molecule. Geometry is real chemistry, motion is decorative easing.
   ============================================================ */
const CHEM_VB_W = 260;
const CHEM_VB_H = 150;

function easeOutCubic(p: number): number {
  return 1 - Math.pow(1 - p, 3);
}

function ChemistryPreview({ t, reduced }: { t: number; reduced: boolean }) {
  const cx = CHEM_VB_W / 2;
  const cy = CHEM_VB_H / 2 + 4;

  // Real water geometry: bent, H–O–H angle 104.5°, bonds drawn at ±52.25° from up.
  const bond = 38; // px O–H bond length
  const halfAngle = (104.5 / 2) * (Math.PI / 180);
  // H positions when fully bonded (pointing up-left and up-right).
  const hTargetL = { x: cx - Math.sin(halfAngle) * bond, y: cy - Math.cos(halfAngle) * bond };
  const hTargetR = { x: cx + Math.sin(halfAngle) * bond, y: cy - Math.cos(halfAngle) * bond };
  // Scattered start positions (atoms drift in from the edges).
  const hStartL = { x: 30, y: 30 };
  const hStartR = { x: CHEM_VB_W - 30, y: 36 };

  const assemble = 1.7; // s to form the bond
  const hold = 2.2; // s bonded + breathing
  const period = assemble + hold + 0.9;
  const cycle = reduced ? assemble + 0.6 : t % period;

  let p: number; // 0..1 assembly progress
  let bonded: boolean;
  if (cycle < assemble) {
    p = easeOutCubic(cycle / assemble);
    bonded = false;
  } else if (cycle < assemble + hold) {
    p = 1;
    bonded = true;
  } else {
    // scatter back out (reverse ease) before the loop restarts
    p = 1 - easeOutCubic((cycle - assemble - hold) / 0.9);
    bonded = false;
  }

  // gentle breathing once bonded — a tiny symmetric bond-length wiggle
  const breathe = bonded && !reduced ? 1 + Math.sin((cycle - assemble) * 3.2) * 0.035 : 1;

  const hL = {
    x: hStartL.x + (hTargetL.x - hStartL.x) * p,
    y: hStartL.y + (hTargetL.y - hStartL.y) * p,
  };
  const hR = {
    x: hStartR.x + (hTargetR.x - hStartR.x) * p,
    y: hStartR.y + (hTargetR.y - hStartR.y) * p,
  };
  // apply breathing along the bond direction
  const hLb = { x: cx + (hL.x - cx) * breathe, y: cy + (hL.y - cy) * breathe };
  const hRb = { x: cx + (hR.x - cx) * breathe, y: cy + (hR.y - cy) * breathe };

  const rO = 22;
  const rH = 12;
  const bondLit = p > 0.55;

  return (
    <svg
      viewBox={`0 0 ${CHEM_VB_W} ${CHEM_VB_H}`}
      className="block h-full w-full"
      role="img"
      aria-label="Ikki vodorod va bitta kislorod — suv (H₂O) molekulasi hosil boʻladi"
    >
      <defs>
        <linearGradient id="lab-stage-chem" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0b0f14" />
          <stop offset="100%" stopColor="#13111d" />
        </linearGradient>
        <radialGradient id="lab-atom-o" cx="0.36" cy="0.3" r="0.85">
          <stop offset="0%" stopColor="#ffb3a7" />
          <stop offset="45%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#8f1f17" />
        </radialGradient>
        <radialGradient id="lab-atom-h" cx="0.36" cy="0.3" r="0.85">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#e8edf2" />
          <stop offset="100%" stopColor="#aab6c2" />
        </radialGradient>
        <filter id="lab-glow-violet" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect x={0} y={0} width={CHEM_VB_W} height={CHEM_VB_H} fill="url(#lab-stage-chem)" />

      {/* faint violet field rings for the cinematic stage */}
      {[0.25, 0.5, 0.75].map((g) => (
        <line
          key={g}
          x1={0}
          y1={CHEM_VB_H * g}
          x2={CHEM_VB_W}
          y2={CHEM_VB_H * g}
          stroke="#a855f7"
          strokeOpacity={0.05}
          strokeWidth={1}
        />
      ))}

      {/* bonds — fade in as atoms approach, violet electron-cloud glow */}
      {bondLit && (
        <g opacity={Math.min(1, (p - 0.55) / 0.4)}>
          <line x1={cx} y1={cy} x2={hLb.x} y2={hLb.y} stroke="#c084fc" strokeWidth={5} strokeLinecap="round" opacity={0.35} />
          <line x1={cx} y1={cy} x2={hRb.x} y2={hRb.y} stroke="#c084fc" strokeWidth={5} strokeLinecap="round" opacity={0.35} />
          <line x1={cx} y1={cy} x2={hLb.x} y2={hLb.y} stroke="#e9d5ff" strokeWidth={2} strokeLinecap="round" />
          <line x1={cx} y1={cy} x2={hRb.x} y2={hRb.y} stroke="#e9d5ff" strokeWidth={2} strokeLinecap="round" />
        </g>
      )}

      {/* bond-formation flash when the molecule snaps together */}
      {!reduced && cycle > assemble - 0.12 && cycle < assemble + 0.2 && (
        <circle cx={cx} cy={cy} r={34} fill="#c084fc" opacity={0.28} />
      )}

      {/* oxygen (centre) */}
      <g filter="url(#lab-glow-violet)">
        <circle cx={cx} cy={cy} r={rO} fill="url(#lab-atom-o)" />
      </g>
      <circle cx={cx - 6} cy={cy - 6} r={5} fill="#ffffff" opacity={0.6} />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={13} fontWeight={800} fill="#fff7f5">
        O
      </text>

      {/* hydrogens — white, outlined so they read on the dark stage */}
      {[hLb, hRb].map((h, i) => (
        <g key={i}>
          <circle cx={h.x} cy={h.y} r={rH} fill="url(#lab-atom-h)" stroke="#cdd8e2" strokeWidth={1.4} />
          <circle cx={h.x - 3.4} cy={h.y - 3.4} r={2.6} fill="#ffffff" opacity={0.85} />
          <text x={h.x} y={h.y + 3.4} textAnchor="middle" fontSize={9.5} fontWeight={800} fill="#3a444f">
            H
          </text>
        </g>
      ))}

      {/* caption chip */}
      <text x={14} y={24} fontSize={11} fontWeight={700} fill="#c084fc" fontFamily="var(--font-geist-mono)">
        2H + O
      </text>
      <text x={CHEM_VB_W - 14} y={24} fontSize={9.5} textAnchor="end" fill="#b39ad6">
        {bonded ? "H₂O hosil boʻldi" : "bogʻlanmoqda…"}
      </text>
    </svg>
  );
}

/* ============================================================
   BIOLOGY preview — a B-DNA double helix (emerald). NEW.

   Two antiparallel sugar–phosphate backbones twist around a shared vertical
   axis; base-pair rungs join them. Parametric, honest projection:
     θ(y,t) = k·y + ω·t
     strand A x = cx + R·cos θ ;  strand B x = cx + R·cos(θ + Δ)
   Depth is sin θ — the strand nearer the viewer is brighter and drawn on top,
   so the weave reads correctly. ω is constant ⇒ rigid uniform rotation about
   the axis (closed-form pose each frame, no integration). Rungs carry the four
   complementary base colours (A·T / G·C), deterministic from the sample index
   so the sequence never flickers. Reduced-motion freezes the clock → a crisp
   static helix. Full equations + constants in labsHub.model.md.
   ============================================================ */
const DNA_VB_W = 260;
const DNA_VB_H = 150;

/** Four CPK-ish base colours; complementary pairs share a hue family. */
const BASE_COLORS = [
  { a: "#34d399", b: "#10b981" }, // A · T
  { a: "#6ee7b7", b: "#059669" }, // T · A
  { a: "#a7f3d0", b: "#34d399" }, // G · C
  { a: "#5eead4", b: "#14b8a6" }, // C · G
];

/** Deterministic base index from a strand position (stable across frames). */
function baseAt(i: number): number {
  // golden-ratio hash → spread but fixed sequence
  return Math.floor((((i * 0.6180339887) % 1) * 4 + 4) % 4);
}

function DnaPreview({ t, reduced }: { t: number; reduced: boolean }) {
  const cx = DNA_VB_W / 2;
  const top = 12;
  const bottom = DNA_VB_H - 12;
  const H = bottom - top;

  const R = 30; // helix radius (px)
  const turns = 2.4; // visible full turns over the height
  const k = (turns * 2 * Math.PI) / H; // spatial twist rate (rad per px of axis)
  const omega = 0.9; // rad/s rotation speed
  const delta = 0.62 * Math.PI; // inter-strand phase offset (B-DNA groove)
  const N = 22; // sampled rungs

  // a tiny vertical breathing for cinematic life (disabled when reduced)
  const sway = reduced ? 0 : Math.sin(t * 1.05) * 2;
  const phase = reduced ? 0 : omega * t;

  type Node = {
    i: number;
    y: number;
    ax: number;
    bx: number;
    aDepth: number; // sin θ for strand A (+1 front … -1 back)
    bDepth: number;
  };

  const nodes: Node[] = [];
  for (let i = 0; i < N; i++) {
    const f = i / (N - 1);
    const y = top + f * H + sway;
    const theta = k * (f * H) + phase;
    nodes.push({
      i,
      y,
      ax: cx + R * Math.cos(theta),
      bx: cx + R * Math.cos(theta + delta),
      aDepth: Math.sin(theta),
      bDepth: Math.sin(theta + delta),
    });
  }

  // Draw rungs back-to-front: a rung's depth is the average of its endpoints.
  // Sorting ascending means the deepest (most negative) paints first → correct weave.
  const rungOrder = nodes
    .map((n) => ({ n, depth: (n.aDepth + n.bDepth) / 2 }))
    .sort((p, q) => p.depth - q.depth);

  // Build the two backbone polylines (smooth curves through the sampled x's).
  const aPath = nodes.map((n) => `${n.ax.toFixed(2)},${n.y.toFixed(2)}`).join(" ");
  const bPath = nodes.map((n) => `${n.bx.toFixed(2)},${n.y.toFixed(2)}`).join(" ");

  // node radius scales subtly with depth (closer = bigger) for parallax
  const nodeR = (depth: number) => 2.4 + (depth + 1) * 1.1;

  return (
    <svg
      viewBox={`0 0 ${DNA_VB_W} ${DNA_VB_H}`}
      className="block h-full w-full"
      role="img"
      aria-label="DNK qoʻsh spirali — komplementar asoslar bilan bogʻlangan ikki zanjir"
    >
      <defs>
        <linearGradient id="lab-stage-dna" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0b0f14" />
          <stop offset="100%" stopColor="#0d1a16" />
        </linearGradient>
        <linearGradient id="lab-dna-backbone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a7f3d0" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
        <filter id="lab-glow-emerald" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect x={0} y={0} width={DNA_VB_W} height={DNA_VB_H} fill="url(#lab-stage-dna)" />

      {/* faint emerald stage lines for depth */}
      {[0.25, 0.5, 0.75].map((g) => (
        <line
          key={g}
          x1={0}
          y1={DNA_VB_H * g}
          x2={DNA_VB_W}
          y2={DNA_VB_H * g}
          stroke="#34d399"
          strokeOpacity={0.05}
          strokeWidth={1}
        />
      ))}

      {/* base-pair rungs, painted back→front for a correct over/under weave */}
      {rungOrder.map(({ n, depth }) => {
        const color = BASE_COLORS[baseAt(n.i)];
        const front = depth > 0;
        return (
          <line
            key={`rung-${n.i}`}
            x1={n.ax}
            y1={n.y}
            x2={n.bx}
            y2={n.y}
            stroke={color.a}
            strokeWidth={front ? 2.6 : 1.8}
            strokeLinecap="round"
            opacity={0.32 + (depth + 1) * 0.3}
          />
        );
      })}

      {/* the two sugar–phosphate backbones */}
      <polyline
        points={aPath}
        fill="none"
        stroke="url(#lab-dna-backbone)"
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.92}
        filter="url(#lab-glow-emerald)"
      />
      <polyline
        points={bPath}
        fill="none"
        stroke="url(#lab-dna-backbone)"
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.7}
      />

      {/* backbone nodes — sized by depth so the helix reads 3-D */}
      {nodes.map((n) => {
        const cA = BASE_COLORS[baseAt(n.i)];
        return (
          <g key={`node-${n.i}`}>
            <circle cx={n.ax} cy={n.y} r={nodeR(n.aDepth)} fill={cA.a} opacity={0.5 + (n.aDepth + 1) * 0.22} />
            <circle cx={n.bx} cy={n.y} r={nodeR(n.bDepth)} fill={cA.b} opacity={0.5 + (n.bDepth + 1) * 0.22} />
          </g>
        );
      })}

      {/* caption chips */}
      <text x={14} y={24} fontSize={11} fontWeight={700} fill="#34d399" fontFamily="var(--font-geist-mono)">
        A·T  G·C
      </text>
      <text x={DNA_VB_W - 14} y={24} fontSize={9.5} textAnchor="end" fill="#86d8b9">
        qoʻsh spiral
      </text>
    </svg>
  );
}

/** Map a preview kind to its renderer. */
function StagePreview({
  preview,
  t,
  reduced,
}: {
  preview: CatalogEntry["preview"];
  t: number;
  reduced: boolean;
}) {
  if (preview === "collision") return <PhysicsPreview t={t} reduced={reduced} />;
  if (preview === "molecule") return <ChemistryPreview t={t} reduced={reduced} />;
  if (preview === "dna") return <DnaPreview t={t} reduced={reduced} />;
  return null;
}

/* ============================================================
   Subject tab bar — segmented pill, mirrors SkyView's SubjectToggle.
   ============================================================ */
const TABS: { id: TabId; label: string; accent?: string }[] = [
  { id: "all", label: "Hammasi" },
  ...SUBJECTS.map((s) => ({ id: s.id as TabId, label: s.label, accent: s.accent })),
];

function SubjectTabs({
  current,
  onPick,
}: {
  current: TabId;
  onPick: (id: TabId) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Fan boʻyicha saralash"
      className="inline-flex flex-wrap justify-center gap-1 rounded-full border border-void-500 bg-void-800 p-1"
    >
      {TABS.map((tab) => {
        const active = tab.id === current;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onPick(tab.id)}
            className={
              "rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition active:scale-95 " +
              (active
                ? "text-void-950"
                : "text-void-300 hover:text-void-100")
            }
            style={
              active
                ? {
                    backgroundColor: tab.accent ?? "var(--color-antares-500)",
                    boxShadow: `0 2px 12px -4px ${tab.accent ?? "rgba(232,162,26,0.5)"}`,
                  }
                : undefined
            }
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================
   Big "lab" card — cinematic live mini-stage + body.
   ============================================================ */
function LabCard({
  entry,
  t,
  reduced,
}: {
  entry: CatalogEntry;
  t: number;
  reduced: boolean;
}) {
  const Icon = entry.icon;
  return (
    <Link
      href={entry.href}
      className="group block overflow-hidden rounded-[22px] border border-void-500 bg-void-800 shadow-[0_2px_18px_-8px_rgba(20,18,14,0.12)] transition-all duration-200 hover:-translate-y-1 hover:border-void-600 hover:shadow-[0_14px_34px_-12px_rgba(20,18,14,0.22)] active:scale-[0.985]"
    >
      {/* ---- cinematic near-black mini-stage thumbnail ---- */}
      <div className="relative aspect-[260/150] w-full overflow-hidden bg-[#0b0f14]">
        <StagePreview preview={entry.preview} t={t} reduced={reduced} />
        {/* corner glow + icon to mark the discipline */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full"
          style={{ backgroundColor: entry.soft, color: entry.accent }}
        >
          <Icon className="h-4 w-4" />
        </div>
        {/* subtle gradient lip so the dark stage meets the light card cleanly */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-6"
          style={{ background: "linear-gradient(to bottom, rgba(11,15,20,0), rgba(11,15,20,0.55))" }}
        />
      </div>

      {/* ---- card body ---- */}
      <div className="p-4">
        <div className="flex items-center gap-2.5">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
            style={{ backgroundColor: entry.soft, color: entry.accent }}
          >
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            {entry.tag && (
              <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-void-300">
                {entry.tag}
              </span>
            )}
            <h2 className="font-serif text-[1.35rem] font-medium leading-none text-antares-700">
              {entry.title}
            </h2>
          </div>
          <span
            aria-hidden
            className="font-mono text-[18px] transition-transform group-hover:translate-x-1"
            style={{ color: entry.accent }}
          >
            →
          </span>
        </div>
        <p className="mt-2.5 text-[13px] leading-[1.45] text-void-200">{entry.hook}</p>
      </div>
    </Link>
  );
}

/* ============================================================
   Compact quick-experiment tile.
   ============================================================ */
function ExperimentCard({ entry }: { entry: CatalogEntry }) {
  const Icon = entry.icon;
  return (
    <Link
      href={entry.href}
      className="group flex flex-col gap-2 rounded-[16px] border border-void-500 bg-void-900 p-3.5 transition hover:-translate-y-0.5 hover:border-void-400 hover:shadow-[0_10px_30px_-14px_rgba(20,18,14,0.25)] active:scale-[0.98]"
    >
      <span
        className="grid h-10 w-10 place-items-center rounded-full"
        style={{ backgroundColor: entry.soft, color: entry.accent }}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div>
        <div className="text-[13.5px] font-semibold leading-tight text-void-100">
          {entry.title}
        </div>
        <div className="mt-0.5 text-[11px] leading-tight text-void-300">{entry.hook}</div>
      </div>
    </Link>
  );
}

/* ============================================================
   "Tez orada" placeholder card.
   ============================================================ */
function SoonCard({ entry }: { entry: CatalogEntry }) {
  const Icon = entry.icon;
  return (
    <div className="flex flex-col gap-2 rounded-[16px] border border-dashed border-void-500 bg-void-700/40 p-3.5">
      <span
        className="grid h-10 w-10 place-items-center rounded-full opacity-70"
        style={{ backgroundColor: entry.soft, color: entry.accent }}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div>
        <div className="flex items-center gap-1.5">
          <span className="text-[13.5px] font-semibold leading-tight text-void-200">
            {entry.title}
          </span>
        </div>
        <div className="mt-0.5 text-[11px] leading-tight text-void-300">{entry.hook}</div>
      </div>
      <span className="mt-0.5 inline-flex w-fit items-center rounded-full bg-void-700 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-void-300">
        Tez orada
      </span>
    </div>
  );
}

/* ============================================================
   Empty-subject state — when a tab has only "soon" content (or nothing).
   ============================================================ */
function EmptyState({ label }: { label: string }) {
  return (
    <div className="rise-in mt-8 flex flex-col items-center justify-center rounded-[22px] border border-dashed border-void-500 bg-void-700/40 px-6 py-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-void-700 text-void-300">
        <Sparkles className="h-5 w-5" />
      </span>
      <p className="mt-4 font-serif text-[1.25rem] font-medium text-void-100">
        {label} — tez orada
      </p>
      <p className="mt-1.5 max-w-[24rem] text-[13px] leading-[1.5] text-void-300">
        Bu fan boʻyicha interaktiv laboratoriyalar tayyorlanmoqda. Tez orada
        qaytib koʻring.
      </p>
    </div>
  );
}

/* ============================================================
   The hub.
   ============================================================ */
export default function LaboratoriyaHub() {
  // SSR-safe: false on the server + first paint (no hydration mismatch), then
  // reconciled to the real value and kept live so a mid-session OS toggle is
  // respected (mirrors the FizikaLab/KimyoLab matchMedia pattern).
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  const t = useStageClock(reduced);

  const [tab, setTab] = useState<TabId>("all");

  // Personalise: greet the student by name (SSR-safe — empty on first paint).
  const [name, setName] = useState("");
  useEffect(() => {
    const p = loadProfile();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is unavailable during SSR; read post-mount
    if (p?.name) setName(p.name);
  }, []);

  // Filter the catalog by the active tab, then split by card kind.
  const { labs, experiments, soons } = useMemo(() => {
    const visible = CATALOG.filter((e) => tab === "all" || e.subject === tab);
    return {
      labs: visible.filter((e) => e.kind === "lab"),
      experiments: visible.filter((e) => e.kind === "experiment"),
      soons: visible.filter((e) => e.kind === "soon"),
    };
  }, [tab]);

  const hasContent = labs.length > 0 || experiments.length > 0;
  const activeLabel = TABS.find((x) => x.id === tab)?.label ?? "";

  return (
    <main className="relative flex min-h-dvh shrink-0 flex-col px-5 pb-36 pt-6">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col">
        {/* ---- top crumb ---- */}
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-void-300">
            <Sparkles className="h-3.5 w-3.5 text-antares-500" />
            Laboratoriya
          </span>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-void-300">
            Scorpius · 2026
          </span>
        </div>

        {/* ---- serif display header + Uzbek hook ---- */}
        <header className="rise-in mt-5">
          {name && (
            <p className="mb-1.5 text-[14px] font-semibold text-antares-700">
              Salom, {name.split(" ")[0]}! 👋
            </p>
          )}
          <h1 className="font-serif text-[2.4rem] font-medium leading-[1.02] tracking-[-0.022em] text-void-100 sm:text-[3rem]">
            Laboratoriya
          </h1>
          <p className="mt-3 max-w-[36rem] text-[1.02rem] leading-[1.5] text-void-200">
            Toʻqnashuvlardan tortib DNK qoʻsh spiraligacha —{" "}
            <span className="font-medium text-void-100">besh fan jonli.</span>
          </p>
        </header>

        {/* ---- subject tab bar (segmented pill) ---- */}
        <div className="rise-in mt-5 flex justify-center sm:justify-start">
          <SubjectTabs current={tab} onPick={setTab} />
        </div>

        {/* ---- big lab cards (filtered) ---- */}
        {labs.length > 0 && (
          <div className="rise-in mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {labs.map((entry) => (
              <LabCard key={entry.id} entry={entry} t={t} reduced={reduced} />
            ))}
          </div>
        )}

        {/* ---- quick experiments (filtered) ---- */}
        {experiments.length > 0 && (
          <section className="rise-in mt-9">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-serif text-[1.5rem] font-medium leading-none text-void-100">
                Tezkor tajribalar
              </h2>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-void-300">
                Sinov maydoni
              </span>
            </div>
            <p className="mt-2 text-[13px] leading-[1.5] text-void-300">
              Tayyor interaktiv tajribalar — bosing va oʻynang.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {experiments.map((entry) => (
                <ExperimentCard key={entry.id} entry={entry} />
              ))}
            </div>
          </section>
        )}

        {/* ---- "Tez orada" cards (filtered) ---- */}
        {soons.length > 0 && (
          <section className="rise-in mt-9">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-serif text-[1.5rem] font-medium leading-none text-void-100">
                Tez orada
              </h2>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-void-300">
                Tayyorlanmoqda
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {soons.map((entry) => (
                <SoonCard key={entry.id} entry={entry} />
              ))}
            </div>
          </section>
        )}

        {/* ---- empty subject (no labs, no experiments) ---- */}
        {!hasContent && <EmptyState label={activeLabel} />}

        <p className="mt-9 text-center text-[12px] leading-[1.5] text-void-300">
          Har bir laboratoriya — haqiqiy fan tenglamalari ustida ishlaydi.
          <br className="hidden sm:block" /> Oʻzgartiring, sinab koʻring, oʻzingiz
          kashf eting.
        </p>
      </div>

      <BottomNav />
    </main>
  );
}
