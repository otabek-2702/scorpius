// components/laboratoriya/LaboratoriyaHub.tsx
/**
 * LaboratoriyaHub — the premium landing for Scorpius' virtual laboratory.
 *
 * A warm-light app section (matching app/page.tsx + SkyView.tsx) framing a grid
 * of large lab cards. Each card previews the *dark cinematic stage* aesthetic of
 * the sim it links to via a tiny, genuinely-live SVG mini-stage:
 *
 *   • Fizika  — two balls run a REAL 1-D elastic collision (momentum + energy
 *               conserved) with a live momentum arrow. Teal accent.
 *   • Kimyo   — two hydrogen atoms + one oxygen drift together and bond into an
 *               H₂O molecule (CPK colours), then gently breathe. Violet accent.
 *
 * Architecture law (AGENTS.md): motion is driven by ONE requestAnimationFrame
 * loop integrating a tiny model on the clock — never CSS keyframes faking
 * physics. prefers-reduced-motion → the previews snap to a settled state. The
 * full sims (with their own SimModel + model.md) live in the fizika/ + kimyo/
 * folders owned by other agents; these are lightweight, decorative previews of
 * what waits inside, deliberately self-contained so the hub needs no props.
 *
 * The cards are data-driven (LABS[]) so more drop in later with one entry.
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Atom,
  CircleDot,
  Droplets,
  Eclipse,
  FlaskConical,
  type LucideIcon,
  Orbit,
  Spline,
  Sparkles,
  Triangle,
} from "lucide-react";
import { BottomNav } from "@/components/nav/BottomNav";

/** Quick experiments — the project's existing interactive sims, surfaced as
 *  standalone lab cards via /laboratoriya/tajriba/[key]. */
const QUICK: {
  key: string;
  title: string;
  sub: string;
  icon: LucideIcon;
  accent: string;
  soft: string;
}[] = [
  { key: "density-buoyancy-tank", title: "Zichlik va suzish", sub: "Suvga tashlab koʻr", icon: Droplets, accent: "#3b7bd1", soft: "rgba(59,123,209,0.12)" },
  { key: "prism", title: "Prizma", sub: "Kamalak hosil qil", icon: Triangle, accent: "#a855f7", soft: "rgba(168,85,247,0.12)" },
  { key: "eclipse", title: "Tutilish", sub: "Quyosh–Oy–Yer", icon: Eclipse, accent: "#e8a21a", soft: "rgba(232,162,26,0.14)" },
  { key: "brownian", title: "Broun harakati", sub: "Zarralar raqsi", icon: Atom, accent: "#2dd4bf", soft: "rgba(45,212,191,0.14)" },
  { key: "brachistochrone", title: "Eng tez yoʻl", sub: "Brakistoxrona", icon: Spline, accent: "#e8a21a", soft: "rgba(232,162,26,0.14)" },
];

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
   Lab card model — data-driven so new labs drop in with one entry.
   ============================================================ */
type LabId = "fizika" | "kimyo";

interface LabDef {
  id: LabId;
  href: string;
  title: string;
  hook: string;
  tag: string;
  /** CSS accent colour for this lab's stage + chrome. */
  accent: string;
  accentSoft: string;
  Icon: typeof CircleDot;
  AltIcon: typeof Orbit;
}

const LABS: LabDef[] = [
  {
    id: "fizika",
    href: "/laboratoriya/fizika",
    title: "Fizika",
    hook: "Ikki shar toʻqnashadi — impuls va energiya jonli.",
    tag: "Mexanika",
    accent: "#2dd4bf",
    accentSoft: "rgba(45,212,191,0.14)",
    Icon: CircleDot,
    AltIcon: Orbit,
  },
  {
    id: "kimyo",
    href: "/laboratoriya/kimyo",
    title: "Kimyo",
    hook: "Elementlarni torting, reaksiyani koʻring — H₂O hosil boʻladi.",
    tag: "Reaksiyalar",
    accent: "#a855f7",
    accentSoft: "rgba(168,85,247,0.14)",
    Icon: FlaskConical,
    AltIcon: Atom,
  },
];

function LabCard({ lab, t, reduced }: { lab: LabDef; t: number; reduced: boolean }) {
  const { Icon, AltIcon } = lab;
  return (
    <Link
      href={lab.href}
      className="group block overflow-hidden rounded-[22px] border border-void-500 bg-void-800 shadow-[0_2px_18px_-8px_rgba(20,18,14,0.12)] transition-all duration-200 hover:-translate-y-1 hover:border-void-600 hover:shadow-[0_14px_34px_-12px_rgba(20,18,14,0.22)] active:scale-[0.985]"
    >
      {/* ---- cinematic near-black mini-stage thumbnail ---- */}
      <div className="relative aspect-[260/150] w-full overflow-hidden bg-[#0b0f14]">
        {lab.id === "fizika" ? (
          <PhysicsPreview t={t} reduced={reduced} />
        ) : (
          <ChemistryPreview t={t} reduced={reduced} />
        )}
        {/* corner glow + alt icon to mark the discipline */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full"
          style={{ backgroundColor: lab.accentSoft, color: lab.accent }}
        >
          <AltIcon className="h-4 w-4" />
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
            style={{ backgroundColor: lab.accentSoft, color: lab.accent }}
          >
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-void-300">
              {lab.tag}
            </span>
            <h2 className="font-serif text-[1.35rem] font-medium leading-none text-antares-700">
              {lab.title}
            </h2>
          </div>
          <span
            aria-hidden
            className="font-mono text-[18px] text-void-300 transition-transform group-hover:translate-x-1"
            style={{ color: lab.accent }}
          >
            →
          </span>
        </div>
        <p className="mt-2.5 text-[13px] leading-[1.45] text-void-200">{lab.hook}</p>
      </div>
    </Link>
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
        <h1 className="font-serif text-[2.4rem] font-medium leading-[1.02] tracking-[-0.022em] text-void-100 sm:text-[3rem]">
          Laboratoriya
        </h1>
        <p className="mt-3 max-w-[36rem] text-[1.02rem] leading-[1.5] text-void-200">
          Elementlarni qoʻshing, toʻqnashuvlarni oʻrnating —{" "}
          <span className="font-medium text-void-100">fizika va kimyo jonli.</span>
        </p>
      </header>

      {/* ---- responsive grid of large lab cards ---- */}
      <div className="rise-in mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {LABS.map((lab) => (
          <LabCard key={lab.id} lab={lab} t={t} reduced={reduced} />
        ))}
      </div>

      {/* ---- quick experiments: the existing interactive sim library ---- */}
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
          {QUICK.map((q) => {
            const Icon = q.icon;
            return (
              <Link
                key={q.key}
                href={`/laboratoriya/tajriba/${q.key}`}
                className="group flex flex-col gap-2 rounded-[16px] border border-void-500 bg-void-900 p-3.5 transition hover:-translate-y-0.5 hover:border-void-400 hover:shadow-[0_10px_30px_-14px_rgba(20,18,14,0.25)] active:scale-[0.98]"
              >
                <span
                  className="grid h-10 w-10 place-items-center rounded-full"
                  style={{ backgroundColor: q.soft, color: q.accent }}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <div className="text-[13.5px] font-semibold leading-tight text-void-100">
                    {q.title}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-tight text-void-300">
                    {q.sub}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ---- "coming soon" lane — signals the grid is built to grow ---- */}
      <div className="mt-4 flex items-center justify-center gap-2 rounded-[18px] border border-dashed border-void-500 bg-void-700/50 px-4 py-3 text-center">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-void-300">
          Tez orada
        </span>
        <span className="text-[12.5px] text-void-300">
          · Elektr zanjirlari · Optika · Termodinamika
        </span>
      </div>

      <p className="mt-5 text-center text-[12px] leading-[1.5] text-void-300">
        Har bir laboratoriya — haqiqiy fizika tenglamalari ustida ishlaydi.
        <br className="hidden sm:block" /> Oʻzgartiring, sinab koʻring, oʻzingiz kashf eting.
      </p>
      </div>

      <BottomNav />
    </main>
  );
}
