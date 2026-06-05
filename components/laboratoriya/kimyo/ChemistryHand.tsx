// components/laboratoriya/kimyo/ChemistryHand.tsx
/**
 * ChemistryHand — Variant A: the hand-built, "video-real" chemistry stage.
 *
 * Reads the eased poses + bonds + flash from ChemistryModel (zero chemistry
 * here — the model computes, this view paints). Atoms render as CPK radial-
 * gradient spheres with a soft drop shadow + specular highlight (white atoms
 * get a grey rim so they read on the near-black stage). Bonds draw in as
 * gradient "sticks" (single/double/triple) as atoms arrive. The energy flash
 * is an expanding radial bloom painted on a <canvas> over the SVG (warm for
 * exo, cool for endo), plus a rising energy bar. Ionic reactions animate an
 * electron dot leaping metal → non-metal, then a packing cubic lattice.
 *
 * One requestAnimationFrame loop (owned by the PARENT KimyoLab) calls
 * model.step(dt); this component just subscribes via useProperty and renders
 * against the current state. Honors prefers-reduced-motion (parent snaps).
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { useProperty } from "@/lib/sim/observable/useProperty";
import type { ChemistryModel } from "@/lib/sims/chemistry/Model";
import { ATOMS } from "@/lib/sims/chemistry/data";

// ---- SVG viewport + Å→px mapping -------------------------------------------
const VBW = 520;
const VBH = 360;
const CX = VBW / 2;
const CY = VBH / 2 + 6;
const PX_PER_A = 28; // ångström → px (molecules are a few Å across)

const toX = (a: number) => CX + a * PX_PER_A;
const toY = (a: number) => CY - a * PX_PER_A;
// Atom render radius (px) from relative radius; gentle compression so big metals
// (Na, Mg) don't dominate the frame.
const atomPx = (rRel: number) => 6 + Math.pow(rRel, 0.62) * 7.2;

interface Props {
  model: ChemistryModel;
  /** Monotonic ms clock from the parent rAF loop (drives subtle idle motion). */
  clock: number;
}

export default function ChemistryHand({ model, clock }: Props) {
  const phase = useProperty(model.phase);
  const progress = useProperty(model.progress);
  const flash = useProperty(model.flash);
  const electron = useProperty(model.electronJump);
  const tray = useProperty(model.tray);
  const matched = useProperty(model.matched);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // bumps when the canvas backing store is resized → re-paint the bloom
  const [sizeTick, setSizeTick] = useState(0);

  // ---- size the bloom canvas to its container at DPR, re-measure on resize --
  // (the stage scales freely — full-width on md, large on lg, fullscreen — so
  // the canvas backing store must track clientWidth*dpr to stay crisp). The
  // SVG is resolution-independent via viewBox; only the canvas needs this.
  useEffect(() => {
    const cv = canvasRef.current;
    const wrap = wrapRef.current;
    if (!cv || !wrap || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const dpr = Math.min(2.5, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(wrap.clientWidth * dpr));
      const h = Math.max(1, Math.round(wrap.clientHeight * dpr));
      if (cv.width !== w || cv.height !== h) {
        cv.width = w;
        cv.height = h;
        setSizeTick((t) => t + 1);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    // also re-measure on fullscreen enter/exit (layout changes after the event)
    const onFs = () => requestAnimationFrame(measure);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      ro.disconnect();
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, []);

  // ---- energy bloom: painted on a canvas over the SVG ----------------------
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const w = cv.width;
    const h = cv.height;
    ctx.clearRect(0, 0, w, h);
    if (flash <= 0.01 || !matched) return;

    const cx = (CX / VBW) * w;
    const cy = (CY / VBH) * h;
    const exo = matched.exo;
    const slow = !!matched.slow;
    // bloom radius grows as flash decays from its peak; map flash→radius
    const peak = matched.flash || 0.4;
    const k = 1 - Math.min(1, flash / Math.max(0.05, peak)); // 0 at peak → 1 faded
    const radius = (slow ? 120 : 70 + 220 * k) * (w / VBW);
    const alpha = flash;

    const warm = matched.flashColor;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    if (exo) {
      grad.addColorStop(0, hexA("#ffffff", alpha * 0.95));
      grad.addColorStop(0.25, hexA(warm, alpha * 0.85));
      grad.addColorStop(0.7, hexA(warm, alpha * 0.22));
      grad.addColorStop(1, hexA(warm, 0));
    } else {
      grad.addColorStop(0, hexA("#dff3ff", alpha * 0.8));
      grad.addColorStop(0.6, hexA("#7db8ff", alpha * 0.3));
      grad.addColorStop(1, hexA("#7db8ff", 0));
    }
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // spark particles for a bright exo flash
    if (exo && !slow && flash > 0.18) {
      const n = Math.round(10 + peak * 22);
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + i * 1.3;
        const d = radius * (0.5 + 0.5 * pseudo(i));
        const px = cx + Math.cos(ang) * d;
        const py = cy + Math.sin(ang) * d;
        ctx.beginPath();
        ctx.fillStyle = hexA("#fff7e0", alpha * 0.9);
        ctx.arc(px, py, (1.2 + pseudo(i * 3) * 1.8) * (w / VBW), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }, [flash, matched, clock, sizeTick]);

  const pre = phase === "idle" || phase === "armed";
  const poses = pre ? trayPoses(tray, clock) : scenePoses(model);
  const bonds = pre ? [] : model.bonds();
  const ionic = model.isIonic();
  // slot → pose lookup so bonds don't recompute poses per-edge
  const bySlot = new Map<number, Pose>();
  if (!pre) for (const p of poses) bySlot.set(p.slot, p);

  // electron dot path (ionic): from a metal (cation) to a non-metal (anion)
  const electronDot = (() => {
    if (!ionic || (phase !== "assembling" && phase !== "product")) return null;
    if (electron >= 1) return null;
    const all = model.poses();
    const cat = all.find((p) => p.ion > 0);
    const an = all.find((p) => p.ion < 0);
    if (!cat || !an) return null;
    const t = electron;
    return {
      x: toX(cat.x + (an.x - cat.x) * t),
      y: toY(cat.y + (an.y - cat.y) * t),
    };
  })();

  return (
    <div
      ref={wrapRef}
      className="relative mx-auto w-full self-center"
      style={{ aspectRatio: `${VBW} / ${VBH}` }}
    >
      {/* near-black cinematic stage */}
      <svg
        viewBox={`0 0 ${VBW} ${VBH}`}
        className="absolute inset-0 block h-full w-full"
        role="img"
        aria-label="Kimyoviy reaksiya sahnasi — atomlar birikib molekula hosil qiladi"
      >
        <defs>
          <radialGradient id="ch-stage" cx="50%" cy="42%" r="75%">
            <stop offset="0%" stopColor="#11161d" />
            <stop offset="100%" stopColor="#0b0f14" />
          </radialGradient>
          {/* per-element sphere gradients are generated inline below */}
          <linearGradient id="ch-bond" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#e8edf2" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#aeb8c4" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#e8edf2" stopOpacity="0.95" />
          </linearGradient>
          <filter id="ch-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
        </defs>

        <rect x={0} y={0} width={VBW} height={VBH} fill="url(#ch-stage)" />

        {/* subtle grid floor for depth */}
        <g opacity={0.5}>
          {Array.from({ length: 7 }).map((_, i) => (
            <line
              key={`gx${i}`}
              x1={(VBW / 6) * i}
              y1={0}
              x2={(VBW / 6) * i}
              y2={VBH}
              stroke="#1b232d"
              strokeWidth={1}
            />
          ))}
          {Array.from({ length: 5 }).map((_, i) => (
            <line
              key={`gy${i}`}
              x1={0}
              y1={(VBH / 4) * i}
              x2={VBW}
              y2={(VBH / 4) * i}
              stroke="#1b232d"
              strokeWidth={1}
            />
          ))}
        </g>

        {/* ---------- BONDS (behind atoms) ---------- */}
        {!ionic &&
          bonds.map((bd, i) => {
            const A = bySlot.get(bd.a);
            const B = bySlot.get(bd.b);
            if (!A || !B || bd.grow <= 0.02) return null;
            return (
              <BondStick
                key={i}
                x1={toX(A.x)}
                y1={toY(A.y)}
                x2={toX(B.x)}
                y2={toY(B.y)}
                order={bd.order}
                grow={bd.grow}
              />
            );
          })}

        {/* ---------- ATOMS ---------- */}
        {poses.map((p) => (
          <AtomSphere
            key={p.id}
            id={p.id}
            cx={toX(p.x)}
            cy={toY(p.y)}
            r={atomPx(p.r)}
            el={p.el}
            depth={p.z}
            removable={phase === "idle" || phase === "armed"}
            onRemove={() => model.removeAtom(p.id)}
          />
        ))}

        {/* ---------- electron jump dot (ionic) ---------- */}
        {electronDot && (
          <g>
            <circle cx={electronDot.x} cy={electronDot.y} r={6} fill="#7dd3ff" opacity={0.4} filter="url(#ch-soft)" />
            <circle cx={electronDot.x} cy={electronDot.y} r={3} fill="#eaf7ff" />
            <text x={electronDot.x} y={electronDot.y - 9} textAnchor="middle" fontSize={9} fontWeight={700} fill="#9fdcff">
              e⁻
            </text>
          </g>
        )}

        {/* ionic lattice frame hint once product */}
        {ionic && phase === "product" && (
          <text x={CX} y={VBH - 14} textAnchor="middle" fontSize={11} fontWeight={600} fill="#a855f7">
            ion panjarasi — bu molekula emas, cheksiz kristall
          </text>
        )}

        {/* empty-state hint */}
        {phase === "idle" && tray.length === 0 && (
          <text x={CX} y={CY} textAnchor="middle" fontSize={13} fontWeight={500} fill="#5b6b7d">
            Atomlarni shu yerga torting — yoki pastdan reaksiya tanlang
          </text>
        )}
        {phase === "idle" && tray.length > 0 && !matched && (
          <text x={CX} y={VBH - 16} textAnchor="middle" fontSize={11.5} fontWeight={500} fill="#7a8a9c">
            Bu atomlar hech bir tanish reaksiyani tashkil etmaydi — yana qoʻshing yoki olib tashlang
          </text>
        )}
      </svg>

      {/* energy bloom overlay (canvas, over the SVG, lighter blend).
          The backing-store size is set by the ResizeObserver effect above to
          container clientWidth*DPR; these attrs are just an SSR fallback. */}
      <canvas
        ref={canvasRef}
        width={VBW * 2}
        height={VBH * 2}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />

      {/* rising energy bar (right edge) */}
      {(phase === "assembling" || phase === "product") && matched && (
        <div className="pointer-events-none absolute bottom-3 right-3 top-3 flex w-2.5 flex-col-reverse overflow-hidden rounded-full bg-white/10">
          <div
            className="w-full rounded-full transition-[height] duration-100"
            style={{
              height: `${Math.min(100, progress * 100)}%`,
              background: matched.exo
                ? "linear-gradient(to top, #f59e0b, #fbbf24, #fff1c4)"
                : "linear-gradient(to top, #2563eb, #60a5fa, #dbeafe)",
            }}
          />
        </div>
      )}
    </div>
  );
}

// ----- atom poses helpers ----------------------------------------------------

interface Pose {
  id: number;
  el: string;
  x: number;
  y: number;
  z: number;
  r: number;
  ion: number;
  slot: number;
}

/** During assembly/product: read the model's eased poses. */
function scenePoses(model: ChemistryModel): Pose[] {
  return model.poses();
}

/** Pre-reaction: lay gathered tray atoms out in a gentle floating cluster. */
function trayPoses(tray: { id: number; el: string }[], clock: number): Pose[] {
  const n = tray.length;
  const t = clock / 1000;
  return tray.map((a, i) => {
    const ang = (i / Math.max(1, n)) * Math.PI * 2;
    const ring = n <= 1 ? 0 : 1.6 + (n > 6 ? 1.1 : 0);
    const info = ATOMS[a.el];
    const bob = Math.sin(t * 1.4 + i * 1.1) * 0.18;
    return {
      id: a.id,
      el: a.el,
      x: Math.cos(ang) * ring + Math.cos(t * 0.6 + i) * 0.12,
      y: Math.sin(ang) * ring * 0.78 + bob,
      z: 0,
      r: info?.r ?? 1.5,
      ion: 0,
      slot: -1,
    };
  });
}

// ----- atom sphere -----------------------------------------------------------

function AtomSphere({
  id,
  cx,
  cy,
  r,
  el,
  depth,
  removable,
  onRemove,
}: {
  id: number;
  cx: number;
  cy: number;
  r: number;
  el: string;
  depth: number;
  removable: boolean;
  onRemove: () => void;
}) {
  const info = ATOMS[el];
  const base = info?.color ?? "#cccccc";
  const stroke = info?.stroke ?? "#888888";
  const isWhite = el === "H";
  // Unique per atom so multiple atoms of the same element don't emit duplicate
  // <radialGradient> ids (invalid DOM).
  const gid = `ch-sph-${el}-${id}`;
  // depth-based dimming so back atoms recede
  const dim = Math.max(0.6, Math.min(1, 1 - depth * 0.06));

  return (
    <g
      style={{ cursor: removable ? "pointer" : "default" }}
      onClick={removable ? onRemove : undefined}
    >
      {/* drop shadow */}
      <ellipse cx={cx} cy={cy + r * 0.9} rx={r * 0.85} ry={r * 0.3} fill="#000000" opacity={0.32} />
      <defs>
        <radialGradient id={gid} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={isWhite ? 1 : 0.92} />
          <stop offset="22%" stopColor={lighten(base, 0.4)} />
          <stop offset="70%" stopColor={base} />
          <stop offset="100%" stopColor={darken(base, 0.34)} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${gid})`} opacity={dim} />
      {/* rim so dark/white atoms read on the stage */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={stroke} strokeWidth={isWhite ? 1.3 : 1} strokeOpacity={0.85} />
      {/* specular highlight */}
      <ellipse cx={cx - r * 0.32} cy={cy - r * 0.36} rx={r * 0.34} ry={r * 0.22} fill="#ffffff" opacity={0.65} />
      {/* element label */}
      <text
        x={cx}
        y={cy + r * 0.34}
        textAnchor="middle"
        fontSize={Math.max(8, r * 0.78)}
        fontWeight={700}
        fill={isWhite ? "#2a2a2a" : "#0c0f13"}
        style={{ paintOrder: "stroke" }}
        stroke={isWhite ? "none" : "#ffffff"}
        strokeWidth={0.5}
        strokeOpacity={0.4}
        pointerEvents="none"
      >
        {el}
      </text>
    </g>
  );
}

// ----- bond stick (single / double / triple, grows in) -----------------------

function BondStick({
  x1,
  y1,
  x2,
  y2,
  order,
  grow,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  order: number;
  grow: number;
}) {
  // shorten endpoints so the stick sits between sphere surfaces, and grow from
  // both ends toward the middle (grow 0..1)
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy; // perpendicular for double/triple offset
  const py = ux;
  const mid = grow; // 0..1 of the full length, drawn from center out
  const cxm = (x1 + x2) / 2;
  const cym = (y1 + y2) / 2;
  const half = (len / 2) * mid;
  const ax = cxm - ux * half;
  const ay = cym - uy * half;
  const bx = cxm + ux * half;
  const by = cym + uy * half;

  const offsets = order === 1 ? [0] : order === 2 ? [-3, 3] : [-4.2, 0, 4.2];
  const sw = order === 1 ? 4.2 : 3.2;

  return (
    <g opacity={Math.min(1, grow * 1.4)}>
      {offsets.map((o, i) => (
        <line
          key={i}
          x1={ax + px * o}
          y1={ay + py * o}
          x2={bx + px * o}
          y2={by + py * o}
          stroke="url(#ch-bond)"
          strokeWidth={sw}
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

// ----- color utils -----------------------------------------------------------

function clamp255(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}
function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}
function lighten(hex: string, amt: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgb(${clamp255(r + (255 - r) * amt)},${clamp255(g + (255 - g) * amt)},${clamp255(b + (255 - b) * amt)})`;
}
function darken(hex: string, amt: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgb(${clamp255(r * (1 - amt))},${clamp255(g * (1 - amt))},${clamp255(b * (1 - amt))})`;
}
function hexA(hex: string, a: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}
function pseudo(n: number): number {
  const s = Math.sin(n * 91.7 + 13.3) * 43758.5453;
  return s - Math.floor(s);
}
