// components/laboratoriya/fizika/CollisionHand.tsx
/**
 * CollisionHand — Variant A: the "video-real", hand-built renderer.
 *
 * A cinematic CANVAS layer (motion-blur trails via a translucent clear, an
 * expanding radial contact-flash on impact, a red-orange heat puff for inelastic
 * collisions) sits BEHIND a razor-sharp SVG instructional layer (balls as
 * radial-gradient spheres with a teal/ink rim, momentum vectors as teal arrows
 * with length ∝ m·v, and a hollow centre-of-mass diamond gliding at constant
 * v_cm straight through the collision).
 *
 * Architecture (AGENTS.md): this view owns ZERO physics. It subscribes to the
 * shared CollisionModel via useProperty() and only paints. The single rAF loop
 * that calls model.step(dt) lives in the PARENT (FizikaLab), so both variants
 * share one clock. Reduced-motion → the canvas trail layer is disabled.
 *
 * See lib/sims/collision/model.md for the equations + integration.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { useProperty } from "@/lib/sim/observable/useProperty";
import {
  CollisionModel,
  PHYS,
  TABLE_W,
  type Ball,
} from "@/lib/sims/collision/Model";

// SVG / canvas viewport (px). The stage is a wide cinematic strip.
const VBW = 720;
const VBH = 320;
const PAD_X = 26;
// The play strip is centred vertically; the centre line is the table.
const CENTER_Y = VBH * 0.5;
const PLOT_W = VBW - PAD_X * 2;
const PX_PER_M = PLOT_W / TABLE_W;

const toX = (m: number) => PAD_X + m * PX_PER_M;
const toY = (m: number) => CENTER_Y - m * PX_PER_M; // up positive
const mToPx = (m: number) => m * PX_PER_M;

// Momentum-vector scale: px per (kg·m/s). Chosen so a 1 kg ball at 4 m/s
// (p = 4) reads ~70 px. Both pre/post vectors share this scale, so the total
// momentum bar is visibly identical across the impact — the punchline.
const PX_PER_P = 70 / 4;
const MAX_VEC = 150;

interface Props {
  model: CollisionModel;
  reduced: boolean;
  /** monotonically increasing ms clock from the parent rAF loop. */
  clock: number;
}

export function CollisionHand({ model, reduced, clock }: Props) {
  const balls = useProperty(model.balls);
  const inv = useProperty(model.invariants);
  const flashes = useProperty(model.flashes);
  const scenario = useProperty(model.scenario);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevPosRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  // Measured CSS size of the stage (drives the canvas backing store so the
  // motion-blur layer stays crisp when the stage grows on lg / in fullscreen).
  const [box, setBox] = useState({ w: VBW, h: VBH });

  // Re-measure the stage on mount + every resize / fullscreen enter-exit.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setBox((prev) =>
          Math.abs(prev.w - rect.width) < 0.5 && Math.abs(prev.h - rect.height) < 0.5
            ? prev
            : { w: rect.width, h: rect.height },
        );
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // --- CANVAS LAYER: motion-blur trails + contact flashes + heat puffs ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Backing store = measured CSS size × devicePixelRatio. The drawing code
    // works in the fixed VBW×VBH logical space, so we pre-scale by sx/sy and
    // dpr — keeping the trails pixel-crisp at any stage width.
    const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    const cssW = box.w || VBW;
    const cssH = box.h || VBH;
    const wPx = Math.round(cssW * dpr);
    const hPx = Math.round(cssH * dpr);
    if (canvas.width !== wPx || canvas.height !== hPx) {
      canvas.width = wPx;
      canvas.height = hPx;
    }
    const sx = (cssW / VBW) * dpr;
    const sy = (cssH / VBH) * dpr;
    ctx.setTransform(sx, 0, 0, sy, 0, 0);

    if (reduced) {
      // No trails in reduced motion — clear fully and stamp current discs.
      ctx.clearRect(0, 0, VBW, VBH);
    } else {
      // Translucent clear = motion-blur trails fade over a few frames.
      ctx.fillStyle = "rgba(11,15,20,0.18)";
      ctx.fillRect(0, 0, VBW, VBH);
    }

    // Trail discs (soft, accent-tinted) at the ball centres.
    for (const b of balls) {
      const cx = toX(b.x);
      const cy = toY(b.y);
      const rpx = mToPx(b.r);
      const speed = Math.hypot(b.vx, b.vy);
      const glow = Math.min(0.5, 0.12 + speed * 0.04);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rpx * 1.5);
      grad.addColorStop(0, hexA(b.color, glow));
      grad.addColorStop(1, hexA(b.color, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, rpx * 1.5, 0, Math.PI * 2);
      ctx.fill();
      prevPosRef.current.set(b.id, { x: cx, y: cy });
    }

    // Contact flashes: expanding bright ring + radial bloom; heat puff if inelastic.
    const now = clock || performance.now();
    for (const f of flashes) {
      const age = (now - f.bornAt) / 700; // 0..1 over lifetime
      if (age < 0 || age > 1) continue;
      const cx = toX(f.x);
      const cy = toY(f.y);
      const fade = 1 - age;
      const R = (10 + f.strength * 44) * age;
      // bloom
      const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, R + 8);
      bloom.addColorStop(0, `rgba(255,255,255,${0.55 * fade})`);
      bloom.addColorStop(0.4, `rgba(45,212,191,${0.4 * fade})`);
      bloom.addColorStop(1, "rgba(45,212,191,0)");
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.arc(cx, cy, R + 8, 0, Math.PI * 2);
      ctx.fill();
      // ring
      ctx.strokeStyle = `rgba(214,255,250,${fade * 0.9})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();
      // heat puff (energy lost) — red-orange particles flung outward
      if (f.inelastic) {
        const n = Math.round(6 + f.strength * 8);
        for (let i = 0; i < n; i++) {
          const ang = (i / n) * Math.PI * 2 + f.id;
          const pr = R * 0.9 * (0.5 + (i % 3) * 0.2);
          const px = cx + Math.cos(ang) * pr;
          const py = cy + Math.sin(ang) * pr - age * 8;
          const hue = 18 + (i % 4) * 8;
          ctx.fillStyle = `hsla(${hue},90%,58%,${fade * 0.85})`;
          ctx.beginPath();
          ctx.arc(px, py, 2.2 + f.strength * 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }, [balls, flashes, clock, reduced, box.w, box.h]);

  // Cheap pure derivation; recomputed each render (this view re-renders on every
  // model.balls / invariants change, so the story stays in sync with the inputs).
  const story = storyLine(model, scenario);

  return (
    <div
      ref={wrapRef}
      className="relative block w-full overflow-hidden"
      style={{ aspectRatio: `${VBW} / ${VBH}` }}
    >
      {/* LAYER 1 — cinematic dark stage + table (pure decoration, scales w/ viewBox) */}
      <svg
        viewBox={`0 0 ${VBW} ${VBH}`}
        className="absolute inset-0 block h-full w-full"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="ch-bg" cx="50%" cy="36%" r="80%">
            <stop offset="0%" stopColor="#11161d" />
            <stop offset="100%" stopColor="#0b0f14" />
          </radialGradient>
          <linearGradient id="ch-table" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0e141b" />
            <stop offset="100%" stopColor="#0a0e13" />
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={VBW} height={VBH} fill="url(#ch-bg)" />
        <line x1={PAD_X} y1={CENTER_Y} x2={VBW - PAD_X} y2={CENTER_Y} stroke="#21303f" strokeWidth={1.5} strokeDasharray="2 6" />
        <rect x={PAD_X} y={CENTER_Y} width={PLOT_W} height={VBH - CENTER_Y - 10} fill="url(#ch-table)" opacity={0.5} />
      </svg>

      {/* LAYER 2 — MOTION-BLUR CANVAS (measured backing store → crisp at any size) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full"
        aria-hidden="true"
      />

      {/* LAYER 3 — razor-sharp SVG instruction layer on top */}
      <svg
        viewBox={`0 0 ${VBW} ${VBH}`}
        className="absolute inset-0 block h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <marker id="ch-arrow" viewBox="0 0 10 10" refX="7.5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,1 L9,5 L0,9 Z" fill="#2dd4bf" />
          </marker>
          <marker id="ch-arrow-gold" viewBox="0 0 10 10" refX="7.5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,1 L9,5 L0,9 Z" fill="#fbbf24" />
          </marker>
          <marker id="ch-arrow-p" viewBox="0 0 10 10" refX="7.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,1 L9,5 L0,9 Z" fill="#7dd3fc" />
          </marker>
        </defs>

        {/* centre-of-mass diamond — glides at constant v_cm through the impact */}
        <CmDiamond inv={inv} />

        {/* balls + their momentum vectors (the key readout) */}
        {balls.map((b) => (
          <BallGfx key={b.id} b={b} />
        ))}

        {/* total-momentum vector from the CM (proof: length never changes) */}
        <TotalMomentum inv={inv} />

        {/* story caption */}
        {story && (
          <g>
            <rect x={VBW / 2 - 150} y={14} width={300} height={28} rx={14} fill="#0b0f14" opacity={0.72} />
            <text x={VBW / 2} y={32} textAnchor="middle" fontSize={13} fontWeight={700} fill={story.color}>
              {story.text}
            </text>
          </g>
        )}

        {/* scene label */}
        <text x={PAD_X} y={26} fontSize={11} fontWeight={600} fill="#5b6b7d" letterSpacing="0.04em">
          {sceneLabel(scenario)}
        </text>
      </svg>
    </div>
  );
}

/* --------------------------------------------------------- a single ball */
function BallGfx({ b }: { b: Ball }) {
  const cx = toX(b.x);
  const cy = toY(b.y);
  const rpx = mToPx(b.r);
  const gid = `ch-ball-${b.id}`;
  // momentum vector for THIS ball (length ∝ m·|v|, capped)
  const pmag = b.m * Math.hypot(b.vx, b.vy);
  const showVec = pmag > 0.05;
  const dirx = b.vx, diry = b.vy;
  const dl = Math.hypot(dirx, diry) || 1;
  const vlen = Math.min(MAX_VEC, pmag * PX_PER_P);
  const ex = cx + (dirx / dl) * vlen;
  const ey = cy - (diry / dl) * vlen; // up positive
  const arrow = b.color === PHYS.ACCENT_B ? "url(#ch-arrow-gold)" : "url(#ch-arrow)";
  const vecColor = b.color === PHYS.ACCENT_B ? "#fbbf24" : "#2dd4bf";

  return (
    <g>
      <defs>
        <radialGradient id={gid} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.95} />
          <stop offset="22%" stopColor={lighten(b.color)} />
          <stop offset="70%" stopColor={b.color} />
          <stop offset="100%" stopColor={darken(b.color)} />
        </radialGradient>
      </defs>

      {/* contact shadow on the table */}
      <ellipse cx={cx} cy={cy + rpx * 0.82} rx={rpx * 0.9} ry={rpx * 0.26} fill="#000" opacity={0.32} />

      {/* sphere body */}
      <circle cx={cx} cy={cy} r={rpx} fill={`url(#${gid})`} stroke={b.color} strokeWidth={1.6} strokeOpacity={0.9} />
      {/* ink rim so white spheres read on dark */}
      <circle cx={cx} cy={cy} r={rpx} fill="none" stroke="#06090d" strokeWidth={1} strokeOpacity={0.45} />
      {/* specular highlight */}
      <ellipse cx={cx - rpx * 0.32} cy={cy - rpx * 0.36} rx={rpx * 0.28} ry={rpx * 0.18} fill="#fff" opacity={0.7} />

      {/* label */}
      {b.label && (
        <text x={cx} y={cy + 4.5} textAnchor="middle" fontSize={Math.max(10, rpx * 0.7)} fontWeight={800} fill="#06121a">
          {b.label}
        </text>
      )}

      {/* momentum vector */}
      {showVec && (
        <>
          <line x1={cx} y1={cy} x2={ex} y2={ey} stroke={vecColor} strokeWidth={3} markerEnd={arrow} strokeLinecap="round" />
          <text
            x={ex + (dirx >= 0 ? 6 : -6)}
            y={ey - 6}
            textAnchor={dirx >= 0 ? "start" : "end"}
            fontSize={10}
            fontWeight={700}
            fill={vecColor}
            className="tabular-nums"
          >
            p {pmag.toFixed(1)}
          </text>
        </>
      )}
    </g>
  );
}

/* ------------------------------------------ centre-of-mass diamond */
function CmDiamond({ inv }: { inv: ReturnType<CollisionModel["invariants"]["get"]> }) {
  if (inv.mtot <= 0) return null;
  const cx = toX(inv.cmx);
  const cy = toY(inv.cmy);
  const s = 8;
  return (
    <g>
      <line x1={cx} y1={CENTER_Y - VBH} x2={cx} y2={CENTER_Y + VBH} stroke="#a855f7" strokeWidth={0.8} strokeDasharray="2 5" opacity={0.28} />
      <path
        d={`M ${cx} ${cy - s} L ${cx + s} ${cy} L ${cx} ${cy + s} L ${cx - s} ${cy} Z`}
        fill="none"
        stroke="#c084fc"
        strokeWidth={2}
      />
      <circle cx={cx} cy={cy} r={1.6} fill="#c084fc" />
      <text x={cx} y={cy - s - 4} textAnchor="middle" fontSize={9} fontWeight={700} fill="#c084fc">
        massa markazi
      </text>
    </g>
  );
}

/* ------------------------------------------ total momentum vector from CM */
function TotalMomentum({ inv }: { inv: ReturnType<CollisionModel["invariants"]["get"]> }) {
  if (inv.p < 0.05) return null;
  const cx = toX(inv.cmx);
  const cy = toY(inv.cmy) - 34;
  const dl = inv.p || 1;
  const vlen = Math.min(MAX_VEC, inv.p * PX_PER_P);
  const ex = cx + (inv.px / dl) * vlen;
  const ey = cy - (inv.py / dl) * vlen;
  return (
    <g>
      <line x1={cx} y1={cy} x2={ex} y2={ey} stroke="#7dd3fc" strokeWidth={2.4} markerEnd="url(#ch-arrow-p)" strokeDasharray="1 0" opacity={0.95} />
      <text x={(cx + ex) / 2} y={cy - 8} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#7dd3fc" className="tabular-nums">
        Σp {inv.p.toFixed(1)} (oʻzgarmas)
      </text>
    </g>
  );
}

/* --------------------------------------------------------------- helpers */
function sceneLabel(s: string): string {
  const map: Record<string, string> = {
    "equal-mass-stop": "TENG MASSA · A toʻxtaydi",
    "newtons-cradle": "NYUTON BESHIGI",
    "mass-mismatch": "MASSA FARQI",
    "restitution-dial": "ELASTIKLIK DIALI",
    "perfectly-inelastic": "MUTLAQ NOELASTIK",
    "2d-glancing": "2D · YONLAMA ZARBA",
  };
  return map[s] ?? "";
}

function storyLine(
  model: CollisionModel,
  scenario: string,
): { text: string; color: string } | null {
  const m1 = model.m1.value, m2 = model.m2.value, e = model.e.value;
  if (scenario === "equal-mass-stop" || (scenario === "mass-mismatch" && Math.abs(m1 - m2) < 1e-3)) {
    if (Math.abs(m1 - m2) < 1e-3 && e === 1) return { text: "tezliklar almashinadi!", color: "#2dd4bf" };
  }
  if (e === 1) return { text: "e = 1 · KE saqlanadi", color: "#34d399" };
  if (e === 0) return { text: "e = 0 · yopishib qoladi", color: "#f87171" };
  if (e < 1) return { text: `e = ${e.toFixed(2)} · energiya yoʻqoladi`, color: "#fbbf24" };
  return null;
}

// hex → rgba with alpha
function hexA(hex: string, a: number): string {
  const c = hex.replace("#", "");
  const n = c.length === 3 ? c.split("").map((x) => x + x).join("") : c;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function lighten(hex: string): string {
  return mix(hex, "#ffffff", 0.45);
}
function darken(hex: string): string {
  return mix(hex, "#000000", 0.4);
}
function mix(a: string, b: string, t: number): string {
  const pa = hexParts(a), pb = hexParts(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}
function hexParts(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  const n = c.length === 3 ? c.split("").map((x) => x + x).join("") : c;
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}
