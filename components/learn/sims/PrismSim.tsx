"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Kamalak — prism refraction + dispersion sim.
 *
 * A glass triangular prism with apex angle A sits center-stage. A draggable
 * white-light source emits a single ray toward the prism. We apply Snell's
 * law n₁ sin θ₁ = n₂ sin θ₂ at each glass-air interface for 7 visible
 * wavelengths. The refractive index of glass varies with wavelength via
 * Cauchy's equation n(λ) = A + B/λ² (we use the BK7 glass constants), so
 * shorter wavelengths bend more — Newton's discovery.
 *
 * Manipulable knobs:
 *   • Drag the source — angle of incidence
 *   • Apex slider — sharper apex → wider spread
 *
 * Completion: when the user has aimed the ray AND created a visible spectrum
 * spread (the violet & red exit rays diverge by > 4°), they get the AHA.
 */

interface Props {
  onComplete?: () => void;
}

const VBW = 480;
const VBH = 320;

// Cauchy's equation constants (close to BK7 glass): n(λ) ≈ 1.5046 + 0.00420/λ²
// where λ is in micrometers. We boost B a bit so dispersion is visible at
// our small scale — physically accurate up to a scaling.
const CAUCHY_A = 1.51;
const CAUCHY_B = 0.012; // micrometer² (exaggerated ~3x for visibility)

interface Wave {
  nm: number;
  color: string;
}
const WAVES: Wave[] = [
  { nm: 660, color: "#e8453b" }, // red
  { nm: 615, color: "#f08826" }, // orange
  { nm: 580, color: "#f2c11d" }, // yellow
  { nm: 530, color: "#3aa867" }, // green
  { nm: 475, color: "#3b7bd1" }, // blue
  { nm: 445, color: "#5b3bd1" }, // indigo
  { nm: 410, color: "#9a3bd1" }, // violet
];

function indexFor(nm: number): number {
  const lamUm = nm / 1000;
  return CAUCHY_A + CAUCHY_B / (lamUm * lamUm);
}

interface Pt {
  x: number;
  y: number;
}

export function PrismSim({ onComplete }: Props) {
  // Source position (draggable)
  const [source, setSource] = useState<Pt>({ x: 50, y: 200 });
  // Apex angle in degrees (top vertex)
  const [apexDeg, setApexDeg] = useState<number>(60);
  const completedRef = useRef(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<"source" | null>(null);

  // Prism geometry: equilateral-like triangle centered on canvas, apex on top.
  // The apex angle is the interior angle at the top vertex.
  const prism = useMemo(() => {
    const cx = 250;
    const cy = 180;
    const half = (apexDeg * Math.PI) / 360; // half apex angle
    const sideLen = 130; // length of the two upper edges
    const apex: Pt = { x: cx, y: cy - 50 };
    const left: Pt = {
      x: apex.x - Math.sin(half) * sideLen,
      y: apex.y + Math.cos(half) * sideLen,
    };
    const right: Pt = {
      x: apex.x + Math.sin(half) * sideLen,
      y: apex.y + Math.cos(half) * sideLen,
    };
    return { apex, left, right };
  }, [apexDeg]);

  // Snell's law: returns the refracted direction (unit vector) given
  // incoming unit direction `d`, surface unit normal `n` (pointing into the
  // incidence medium), and refractive indices n1, n2. If TIR, returns null.
  function refract(
    d: Pt,
    n: Pt,
    n1: number,
    n2: number,
  ): Pt | null {
    // We need cos θ₁ = -d · n (n points OUT of the surface toward incidence)
    const cos1 = -(d.x * n.x + d.y * n.y);
    const eta = n1 / n2;
    const k = 1 - eta * eta * (1 - cos1 * cos1);
    if (k < 0) return null; // total internal reflection
    const cos2 = Math.sqrt(k);
    return {
      x: eta * d.x + (eta * cos1 - cos2) * n.x,
      y: eta * d.y + (eta * cos1 - cos2) * n.y,
    };
  }

  // Ray-segment intersection: ray origin O, dir D, segment P1→P2. Returns t
  // and the hit point or null.
  function raySegment(
    O: Pt,
    D: Pt,
    P1: Pt,
    P2: Pt,
  ): { t: number; hit: Pt; segT: number } | null {
    const sx = P2.x - P1.x;
    const sy = P2.y - P1.y;
    const denom = D.x * sy - D.y * sx;
    if (Math.abs(denom) < 1e-9) return null;
    const dx = P1.x - O.x;
    const dy = P1.y - O.y;
    const t = (dx * sy - dy * sx) / denom;
    const u = (dx * D.y - dy * D.x) / denom;
    if (t < 1e-4 || u < 0 || u > 1) return null;
    return { t, hit: { x: O.x + D.x * t, y: O.y + D.y * t }, segT: u };
  }

  /** Compute the full ray polyline for one wavelength: source → left face →
   *  inside glass → right (or another) face → out. Returns null if it misses. */
  function traceRay(dir0: Pt, n: number): Pt[] | null {
    // Try to intersect with the LEFT face first
    const left1 = raySegment(source, dir0, prism.apex, prism.left);
    const right1 = raySegment(source, dir0, prism.apex, prism.right);
    const bot1 = raySegment(source, dir0, prism.left, prism.right);

    // Pick the nearest valid first hit
    const candidates = [
      { face: "left" as const, hit: left1 },
      { face: "right" as const, hit: right1 },
      { face: "bot" as const, hit: bot1 },
    ].filter((c) => c.hit !== null) as Array<{
      face: "left" | "right" | "bot";
      hit: { t: number; hit: Pt; segT: number };
    }>;
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.hit.t - b.hit.t);
    const first = candidates[0];

    // Normal of the hit face, pointing OUT of the prism (toward incidence)
    const normal = faceNormal(first.face);
    // Refract from air (n=1) into glass (n)
    const r1 = refract(dir0, normal, 1.0, n);
    if (!r1) return null;
    // Trace inside the glass — try the OTHER two faces, pick nearest
    const O2 = first.hit.hit;
    const otherFaces: Array<"left" | "right" | "bot"> = (
      ["left", "right", "bot"] as const
    ).filter((f) => f !== first.face);
    const secondCandidates = otherFaces
      .map((face) => {
        const seg = faceSegment(face);
        return { face, hit: raySegment(O2, r1, seg.a, seg.b) };
      })
      .filter((c) => c.hit !== null) as Array<{
      face: "left" | "right" | "bot";
      hit: { t: number; hit: Pt; segT: number };
    }>;
    if (secondCandidates.length === 0) return null;
    secondCandidates.sort((a, b) => a.hit.t - b.hit.t);
    const second = secondCandidates[0];

    // For exit face, the normal points OUT of prism (i.e. outward from inside).
    // The refract function expects the normal pointing into the incidence
    // medium — when going glass → air, the incidence medium is glass, the
    // normal should point INTO the glass (i.e. invert the outward normal).
    const exitNormal = faceNormal(second.face);
    const exitN = { x: -exitNormal.x, y: -exitNormal.y };
    const r2 = refract(r1, exitN, n, 1.0);
    const exitPt = second.hit.hit;
    if (!r2) {
      // TIR: ray bounces inside (we won't trace further to keep it readable)
      return [source, O2, exitPt];
    }
    // Extend the exit ray to the edge of the canvas
    const farT = 1200;
    const tail = { x: exitPt.x + r2.x * farT, y: exitPt.y + r2.y * farT };
    return [source, O2, exitPt, tail];
  }

  function faceSegment(face: "left" | "right" | "bot"): { a: Pt; b: Pt } {
    if (face === "left") return { a: prism.apex, b: prism.left };
    if (face === "right") return { a: prism.apex, b: prism.right };
    return { a: prism.left, b: prism.right };
  }

  function faceNormal(face: "left" | "right" | "bot"): Pt {
    // Outward-pointing unit normal of the given prism face
    const seg = faceSegment(face);
    const dx = seg.b.x - seg.a.x;
    const dy = seg.b.y - seg.a.y;
    const len = Math.hypot(dx, dy);
    // Centroid of prism for "outward" direction
    const cx = (prism.apex.x + prism.left.x + prism.right.x) / 3;
    const cy = (prism.apex.y + prism.left.y + prism.right.y) / 3;
    // Two candidate normals (perpendicular to edge)
    const n1 = { x: -dy / len, y: dx / len };
    const n2 = { x: dy / len, y: -dx / len };
    // Midpoint of the segment
    const mx = (seg.a.x + seg.b.x) / 2;
    const my = (seg.a.y + seg.b.y) / 2;
    // Pick the one pointing AWAY from centroid (outward)
    const dot1 = n1.x * (mx - cx) + n1.y * (my - cy);
    return dot1 > 0 ? n1 : n2;
  }

  // Aim the ray at the prism centroid by default; the user can drag the
  // source to change the incidence angle.
  const aimX = (prism.apex.x + prism.left.x + prism.right.x) / 3;
  const aimY = (prism.apex.y + prism.left.y + prism.right.y) / 3;
  const dx = aimX - source.x;
  const dy = aimY - source.y;
  const dl = Math.hypot(dx, dy);
  const dir0: Pt = { x: dx / dl, y: dy / dl };

  // Trace all 7 wavelengths
  const rays = WAVES.map((w) => {
    const ray = traceRay(dir0, indexFor(w.nm));
    return { ...w, ray };
  });

  // Detect dispersion: angular spread between red and violet exit rays.
  function exitAngle(poly: Pt[] | null): number | null {
    if (!poly || poly.length < 4) return null;
    const last = poly[poly.length - 1];
    const prev = poly[poly.length - 2];
    return Math.atan2(last.y - prev.y, last.x - prev.x);
  }
  const redAng = exitAngle(rays[0].ray);
  const violetAng = exitAngle(rays[rays.length - 1].ray);
  const spreadDeg =
    redAng !== null && violetAng !== null
      ? Math.abs(((redAng - violetAng) * 180) / Math.PI)
      : 0;

  useEffect(() => {
    if (spreadDeg > 4 && !completedRef.current) {
      completedRef.current = true;
      onComplete?.();
    }
  }, [spreadDeg, onComplete]);

  // ---- Drag handling ---------------------------------------------------
  function svgPointer(evt: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((evt.clientX - rect.left) / rect.width) * VBW,
      y: ((evt.clientY - rect.top) / rect.height) * VBH,
    };
  }

  function onPointerDown(evt: React.PointerEvent<SVGSVGElement>) {
    const p = svgPointer(evt);
    const dd = Math.hypot(p.x - source.x, p.y - source.y);
    if (dd < 30 || p.x < prism.left.x - 20) {
      dragRef.current = "source";
      (evt.target as Element).setPointerCapture?.(evt.pointerId);
      // Constrain to the left half of canvas, away from prism
      setSource({
        x: clamp(p.x, 12, prism.apex.x - 30),
        y: clamp(p.y, 30, VBH - 20),
      });
    }
  }
  function onPointerMove(evt: React.PointerEvent<SVGSVGElement>) {
    if (dragRef.current !== "source") return;
    const p = svgPointer(evt);
    setSource({
      x: clamp(p.x, 12, prism.apex.x - 30),
      y: clamp(p.y, 30, VBH - 20),
    });
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="overflow-hidden rounded-[18px] border border-void-500 bg-void-700/40">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VBW} ${VBH}`}
          className="block w-full touch-none"
          style={{ cursor: dragRef.current ? "grabbing" : "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* Background subtle grid */}
          <defs>
            <linearGradient id="prismFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(180, 200, 230, 0.25)" />
              <stop offset="100%" stopColor="rgba(180, 200, 230, 0.12)" />
            </linearGradient>
          </defs>

          {/* Incoming white ray (before the prism) */}
          {rays[0].ray && rays[0].ray.length >= 2 && (
            <line
              x1={source.x}
              y1={source.y}
              x2={rays[0].ray[1].x}
              y2={rays[0].ray[1].y}
              stroke="#fbf9f3"
              strokeWidth={3}
              strokeLinecap="round"
            />
          )}

          {/* Prism */}
          <polygon
            points={`${prism.apex.x},${prism.apex.y} ${prism.right.x},${prism.right.y} ${prism.left.x},${prism.left.y}`}
            fill="url(#prismFill)"
            stroke="rgba(132, 126, 107, 0.85)"
            strokeWidth={1.6}
          />

          {/* Colored rays inside + exit */}
          {rays.map((w) => {
            if (!w.ray) return null;
            // Inside-glass segment is index 1 → 2; exit segment is 2 → 3
            return (
              <g key={w.nm}>
                {w.ray.length >= 3 && (
                  <line
                    x1={w.ray[1].x}
                    y1={w.ray[1].y}
                    x2={w.ray[2].x}
                    y2={w.ray[2].y}
                    stroke={w.color}
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    opacity={0.85}
                  />
                )}
                {w.ray.length >= 4 && (
                  <line
                    x1={w.ray[2].x}
                    y1={w.ray[2].y}
                    x2={w.ray[3].x}
                    y2={w.ray[3].y}
                    stroke={w.color}
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    opacity={0.95}
                  />
                )}
              </g>
            );
          })}

          {/* Source — a draggable lamp */}
          <g style={{ cursor: "grab" }}>
            <circle
              cx={source.x}
              cy={source.y}
              r={11}
              fill="#fbf9f3"
              stroke="#1a1813"
              strokeWidth={1.6}
            />
            <circle cx={source.x} cy={source.y} r={4} fill="#e8a21a" />
            <circle
              cx={source.x}
              cy={source.y}
              r={18}
              fill="none"
              stroke="rgba(232, 162, 26, 0.6)"
              strokeWidth={1.2}
              strokeDasharray="2 3"
              opacity={completedRef.current ? 0 : 0.85}
            />
          </g>

          {/* Apex angle readout */}
          <g transform={`translate(${VBW - 110}, 14)`}>
            <rect width={96} height={28} rx={6} fill="rgba(242, 239, 230, 0.85)" stroke="rgba(132,126,107,0.45)" strokeWidth={1} />
            <text x={48} y={18} fontSize={11} fontWeight={700} fill="#1a1813" textAnchor="middle" letterSpacing="0.02em">
              A = {apexDeg.toFixed(0)}°
            </text>
          </g>

          {/* Spread badge */}
          <g transform="translate(14, 14)">
            <rect
              width={132}
              height={28}
              rx={6}
              fill={spreadDeg > 4 ? "rgba(217, 138, 5, 0.95)" : "rgba(242, 239, 230, 0.85)"}
              stroke={spreadDeg > 4 ? "#d98a05" : "rgba(132,126,107,0.45)"}
              strokeWidth={1}
            />
            <text
              x={66}
              y={18}
              fontSize={11}
              fontWeight={700}
              fill={spreadDeg > 4 ? "#fbf9f3" : "#1a1813"}
              textAnchor="middle"
              letterSpacing="0.02em"
            >
              SPEKTR · {spreadDeg.toFixed(1)}°
            </text>
          </g>
        </svg>
      </div>

      {/* Apex slider */}
      <div className="rounded-[14px] border border-void-500 bg-void-700/60 p-3">
        <div className="flex items-baseline justify-between">
          <label htmlFor="apex" className="text-[12px] font-semibold text-void-200">
            Prizma uchki burchagi
          </label>
          <span className="font-mono text-[12px] text-void-300">{apexDeg.toFixed(0)}°</span>
        </div>
        <input
          id="apex"
          type="range"
          min={20}
          max={80}
          step={1}
          value={apexDeg}
          onChange={(e) => setApexDeg(Number(e.target.value))}
          className="mt-2 w-full accent-antares-500"
        />
        <div className="mt-1 flex justify-between text-[10px] text-void-300">
          <span>tor (20°)</span>
          <span>keng (80°)</span>
        </div>
      </div>

      {/* Legend */}
      <div className="rounded-[14px] border border-void-500 bg-void-700/40 p-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-void-200">
          To&apos;lqin uzunligi → sinish indeksi
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {WAVES.map((w) => (
            <div key={w.nm} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: w.color }}
              />
              <span className="font-mono text-[10px] tabular-nums text-void-200">
                {w.nm}nm · n={indexFor(w.nm).toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[12px] leading-relaxed text-void-300">
        Yorug&apos;lik manbaini{" "}
        <span className="text-void-200">torting</span> — oq nur prizmaga turli burchak ostida
        kiradi. Har bir rang o&apos;z burchagi bilan sinadi (binafsha eng kuchli, qizil eng kam).
        Burchak farqi 4° dan oshganda — siz spektrni topdingiz.
      </p>
    </div>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
