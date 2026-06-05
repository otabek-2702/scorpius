"use client";

/**
 * Linzalar — converging-lens ray tracing.
 *
 * A thin converging lens sits on the optical axis. The learner drags an
 * OBJECT (a glowing fly — our metaphor) along the axis. We trace the three
 * principal rays from the tip of the object:
 *
 *   1. Parallel ray  — hits the lens, refracts through focal point F'.
 *   2. Center ray    — passes straight through the lens center, undeviated.
 *   3. Focal ray     — through F first, exits parallel.
 *
 * Where the three rays meet on the far side = the IMAGE. The image flips,
 * grows, shrinks, or becomes virtual (rays diverge on the object side) as
 * the learner moves through the focal regions.
 *
 * Real physics: thin lens equation 1/f = 1/u + 1/v.  We also draw u, v, and
 * the magnification m = -v/u live.
 *
 * Manipulable parameters:
 *   • Drag the fly (object distance u)
 *   • Focal length slider (f)
 *
 * Completion: when the user has moved the fly through TWO regimes — i.e.
 * from u > 2f (small real image) to u < f (virtual magnified image), or
 * vice versa.
 */

import { useEffect, useRef, useState } from "react";

interface Props {
  onComplete?: () => void;
}

const VBW = 480;
const VBH = 280;

const AXIS_Y = VBH / 2;
const LENS_X = 270;
const LENS_H = 130; // visual lens height

// Pixel scale: 50 px per "unit" (cm-ish). f, u, v will be in px.
const X_MIN = 30;
const X_MAX = VBW - 30;

interface Tip { x: number; y: number; }

export function LensSim({ onComplete }: Props) {
  // Object position (its base on the axis). Fly is a vertical "arrow" of
  // fixed height h_obj px above the axis.
  const H_OBJ = 50;
  const [objX, setObjX] = useState<number>(LENS_X - 160);
  const [f, setF] = useState<number>(80); // focal length in px

  const completedRef = useRef(false);
  const regimesSeenRef = useRef<Set<string>>(new Set());
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<boolean>(false);

  // ---- Drag ----------------------------------------------------------------
  function svgPointer(evt: React.PointerEvent<SVGSVGElement | SVGGElement>) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = ((evt.clientX - rect.left) / rect.width) * VBW;
    const y = ((evt.clientY - rect.top) / rect.height) * VBH;
    return { x, y };
  }
  function onFlyPointerDown(evt: React.PointerEvent<SVGGElement>) {
    evt.preventDefault();
    (evt.target as Element).setPointerCapture?.(evt.pointerId);
    dragRef.current = true;
  }
  function onPointerMove(evt: React.PointerEvent<SVGSVGElement>) {
    if (!dragRef.current) return;
    const p = svgPointer(evt);
    // Object always sits to the LEFT of the lens (u > 0); clamp so it stops
    // at a min distance from the lens (1 px) and at the canvas edge.
    setObjX(clamp(p.x, X_MIN, LENS_X - 12));
  }
  function onPointerUp() {
    dragRef.current = false;
  }

  // ---- Optics --------------------------------------------------------------
  // Object distance u (>0). The object tip is at (objX, AXIS_Y - H_OBJ).
  const u = LENS_X - objX;

  // Thin lens: 1/v = 1/f - 1/u → v = f*u/(u-f)
  // - u > f: real image, v > 0 (right side)
  // - u < f: virtual image, v < 0 (image stays on object side)
  // - u = f: image at infinity
  const denom = u - f;
  const isAtFocus = Math.abs(denom) < 1.5;
  const v = isAtFocus ? Number.POSITIVE_INFINITY : (f * u) / denom;
  const m = isAtFocus ? Number.POSITIVE_INFINITY : -v / u; // magnification (negative = inverted)
  const imageReal = v > 0;
  const imageX = LENS_X + (Number.isFinite(v) ? v : 0);
  const imageY = AXIS_Y - H_OBJ * m;

  // Track regimes for completion: "near" (u < f), "two-f" (f < u < 2f), "far" (u > 2f).
  // Side-effect lives in a useEffect — calling onComplete during render would
  // setState in the parent SimulationCard, which React 19 (correctly) forbids.
  useEffect(() => {
    const uNow = LENS_X - objX;
    let regime: string;
    if (uNow < f) regime = "virtual";
    else if (uNow > 2 * f) regime = "far";
    else regime = "between";
    regimesSeenRef.current.add(regime);
    if (
      !completedRef.current &&
      regimesSeenRef.current.has("virtual") &&
      (regimesSeenRef.current.has("far") || regimesSeenRef.current.has("between"))
    ) {
      completedRef.current = true;
      onComplete?.();
    }
  }, [objX, f, onComplete]);

  // ---- Ray construction ----------------------------------------------------
  const objTip: Tip = { x: objX, y: AXIS_Y - H_OBJ };

  // 1) Parallel ray: goes from objTip horizontally to lens, then to focal point F' on right
  const parallelHit: Tip = { x: LENS_X, y: objTip.y };
  const fRight: Tip = { x: LENS_X + f, y: AXIS_Y };
  // Continue from parallelHit through fRight to the far edge
  const ray1_far = extendRay(parallelHit, fRight, X_MAX);
  // Virtual back-extension on the object side (dashed) when image is virtual
  const ray1_back = extendRay(parallelHit, fRight, objX - 40, /*backwards*/ true);

  // 2) Center ray: undeviated, from objTip through lens center
  const lensCenter: Tip = { x: LENS_X, y: AXIS_Y };
  const ray2_far = extendRay(objTip, lensCenter, X_MAX);
  const ray2_back = extendRay(objTip, lensCenter, objX - 40, /*backwards*/ true);

  // 3) Focal ray: from objTip through F (left focal point), straight to lens, then exits parallel
  const fLeft: Tip = { x: LENS_X - f, y: AXIS_Y };
  // Where does the line from objTip through fLeft hit the lens plane (x = LENS_X)?
  const focalHit = lineAtX(objTip, fLeft, LENS_X);
  // From focalHit it exits parallel to the axis, going right
  const ray3_far: Tip = { x: X_MAX, y: focalHit.y };
  const ray3_back: Tip = { x: objX - 40, y: focalHit.y };

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="overflow-hidden rounded-[18px] border border-void-500 bg-void-700/40">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VBW} ${VBH}`}
          className="block w-full touch-none"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* Optical axis */}
          <line
            x1={X_MIN}
            y1={AXIS_Y}
            x2={X_MAX}
            y2={AXIS_Y}
            stroke="rgba(132, 126, 107, 0.5)"
            strokeWidth={1}
            strokeDasharray="3 4"
          />

          {/* Focal points */}
          <circle cx={LENS_X - f} cy={AXIS_Y} r={3.5} fill="#fbf9f3" stroke="#1a1813" strokeWidth={1} />
          <text x={LENS_X - f} y={AXIS_Y + 16} fontSize={10} fontWeight={700} fill="#fbf9f3" textAnchor="middle">F</text>
          <circle cx={LENS_X + f} cy={AXIS_Y} r={3.5} fill="#fbf9f3" stroke="#1a1813" strokeWidth={1} />
          <text x={LENS_X + f} y={AXIS_Y + 16} fontSize={10} fontWeight={700} fill="#fbf9f3" textAnchor="middle">F&apos;</text>
          {/* 2F markers */}
          <circle cx={LENS_X - 2 * f} cy={AXIS_Y} r={2} fill="rgba(180,170,140,0.7)" />
          <text x={LENS_X - 2 * f} y={AXIS_Y + 14} fontSize={8} fill="rgba(180,170,140,0.8)" textAnchor="middle">2F</text>
          <circle cx={LENS_X + 2 * f} cy={AXIS_Y} r={2} fill="rgba(180,170,140,0.7)" />
          <text x={LENS_X + 2 * f} y={AXIS_Y + 14} fontSize={8} fill="rgba(180,170,140,0.8)" textAnchor="middle">2F&apos;</text>

          {/* Lens — a slim ellipse with arrow-tips at top + bottom to suggest converging */}
          <ellipse
            cx={LENS_X}
            cy={AXIS_Y}
            rx={9}
            ry={LENS_H / 2}
            fill="rgba(59, 123, 209, 0.18)"
            stroke="#3b7bd1"
            strokeWidth={1.6}
          />
          {/* Convex arrows on top/bottom — purely decorative */}
          <polygon points={`${LENS_X - 6},${AXIS_Y - LENS_H / 2 + 4} ${LENS_X + 6},${AXIS_Y - LENS_H / 2 + 4} ${LENS_X},${AXIS_Y - LENS_H / 2 - 4}`} fill="#3b7bd1" />
          <polygon points={`${LENS_X - 6},${AXIS_Y + LENS_H / 2 - 4} ${LENS_X + 6},${AXIS_Y + LENS_H / 2 - 4} ${LENS_X},${AXIS_Y + LENS_H / 2 + 4}`} fill="#3b7bd1" />

          {/* Object — a glowing fly (arrow with a circle head + tiny wings) */}
          <g
            style={{ cursor: "grab" }}
            onPointerDown={onFlyPointerDown}
          >
            {/* invisible drag hit area */}
            <rect x={objX - 14} y={objTip.y - 8} width={28} height={H_OBJ + 16} fill="transparent" />
            {/* shaft */}
            <line x1={objX} y1={AXIS_Y} x2={objX} y2={objTip.y} stroke="#e8a21a" strokeWidth={2.2} />
            {/* body */}
            <ellipse cx={objX} cy={objTip.y} rx={6} ry={8} fill="#e8a21a" stroke="#1a1813" strokeWidth={1.2} />
            {/* wings */}
            <ellipse cx={objX - 8} cy={objTip.y - 4} rx={5} ry={3} fill="rgba(251,249,243,0.5)" stroke="#1a1813" strokeWidth={0.8} />
            <ellipse cx={objX + 8} cy={objTip.y - 4} rx={5} ry={3} fill="rgba(251,249,243,0.5)" stroke="#1a1813" strokeWidth={0.8} />
          </g>

          {/* Three rays (real portion) */}
          <RayLine from={objTip} to={parallelHit} color="#e8453b" />
          <RayLine from={parallelHit} to={ray1_far} color="#e8453b" />
          {!imageReal && <RayLine from={parallelHit} to={ray1_back} color="#e8453b" dashed />}

          <RayLine from={objTip} to={ray2_far} color="#3aa867" />
          {!imageReal && <RayLine from={objTip} to={ray2_back} color="#3aa867" dashed />}

          {Number.isFinite(v) && (
            <>
              <RayLine from={objTip} to={focalHit} color="#9a3bd1" />
              <RayLine from={focalHit} to={ray3_far} color="#9a3bd1" />
              {!imageReal && <RayLine from={focalHit} to={ray3_back} color="#9a3bd1" dashed />}
            </>
          )}

          {/* Image (if finite) */}
          {Number.isFinite(v) && (
            <g>
              {/* shaft */}
              <line
                x1={imageX}
                y1={AXIS_Y}
                x2={imageX}
                y2={imageY}
                stroke={imageReal ? "#fbf9f3" : "rgba(251,249,243,0.55)"}
                strokeWidth={2.2}
                strokeDasharray={imageReal ? undefined : "4 4"}
              />
              {/* fly body at image tip */}
              <ellipse
                cx={imageX}
                cy={imageY}
                rx={6}
                ry={8}
                fill={imageReal ? "#fbf9f3" : "rgba(251,249,243,0.55)"}
                stroke="#1a1813"
                strokeWidth={1.2}
              />
              <ellipse cx={imageX - 8} cy={imageY + (m > 0 ? -4 : 4)} rx={5} ry={3} fill={imageReal ? "rgba(232,162,26,0.5)" : "rgba(232,162,26,0.25)"} stroke="#1a1813" strokeWidth={0.7} />
              <ellipse cx={imageX + 8} cy={imageY + (m > 0 ? -4 : 4)} rx={5} ry={3} fill={imageReal ? "rgba(232,162,26,0.5)" : "rgba(232,162,26,0.25)"} stroke="#1a1813" strokeWidth={0.7} />
            </g>
          )}

          {/* Readout — top right */}
          <g transform={`translate(${VBW - 132}, 8)`}>
            <rect
              x={0}
              y={0}
              width={120}
              height={88}
              rx={8}
              fill="rgba(242, 239, 230, 0.85)"
              stroke="rgba(132, 126, 107, 0.45)"
              strokeWidth={1}
            />
            <text x={10} y={14} fontSize={9} fontWeight={700} fill="#1a1813" letterSpacing="0.04em">
              u (jismgacha)
            </text>
            <text x={10} y={28} fontSize={12} fontWeight={700} fill="#1a1813" fontFamily="ui-monospace, monospace">
              {(u / 10).toFixed(1)} sm
            </text>
            <text x={10} y={44} fontSize={9} fontWeight={700} fill="#1a1813" letterSpacing="0.04em">
              v (tasvirgacha)
            </text>
            <text x={10} y={58} fontSize={12} fontWeight={700} fill={imageReal ? "#1f7240" : "#a9760a"} fontFamily="ui-monospace, monospace">
              {Number.isFinite(v) ? `${(v / 10).toFixed(1)} sm` : "∞"}
            </text>
            <text x={10} y={74} fontSize={9} fontWeight={700} fill="#1a1813" letterSpacing="0.04em">
              kattalashish
            </text>
            <text x={10} y={86} fontSize={11} fontWeight={700} fill="#1a1813" fontFamily="ui-monospace, monospace">
              {Number.isFinite(m) ? `${m.toFixed(2)}×` : "∞"}
            </text>
          </g>

          {/* Regime badge — bottom-left */}
          <g transform={`translate(8, ${VBH - 28})`}>
            <rect x={0} y={0} width={160} height={22} rx={11} fill={badgeFill(imageReal, u, f)} />
            <text x={80} y={15} fontSize={10} fontWeight={700} fill="#1a1813" textAnchor="middle">
              {regimeLabel(u, f)}
            </text>
          </g>
        </svg>
      </div>

      {/* Focal length slider */}
      <div className="rounded-[14px] border border-void-500 bg-void-700/60 p-3">
        <div className="flex items-baseline justify-between">
          <label htmlFor="lns-f" className="text-[12px] font-semibold text-void-200">
            Fokus masofasi (linzaning kuchi)
          </label>
          <span className="font-mono text-[12px] text-void-300">
            f = {(f / 10).toFixed(1)} sm
          </span>
        </div>
        <input
          id="lns-f"
          type="range"
          min={30}
          max={140}
          step={1}
          value={f}
          onChange={(e) => setF(Number(e.target.value))}
          className="mt-2 w-full accent-antares-500"
        />
        <div className="mt-1 flex justify-between text-[10px] text-void-300">
          <span>Kuchli linza</span>
          <span>Bo&apos;sh linza</span>
        </div>
      </div>

      <p className="text-[12px] leading-relaxed text-void-300">
        Pashshani <span className="text-void-200">o&apos;q bo&apos;ylab torting</span>. Uchta nur har
        doim aniq qoidaga ko&apos;ra siniadi: ko&apos;k yo&apos;l — markazdan, qizil — fokusdan, binafsha —
        boshqa fokusga. Ular kesishadigan joy — tasvir. Jismni fokusdan yaqinroq tortsangiz —
        tasvir <em>haqiqiy</em> emas, <em>virtual</em> bo&apos;ladi.
      </p>
    </div>
  );
}

function RayLine({ from, to, color, dashed }: { from: Tip; to: Tip; color: string; dashed?: boolean }) {
  return (
    <line
      x1={from.x}
      y1={from.y}
      x2={to.x}
      y2={to.y}
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeDasharray={dashed ? "5 4" : undefined}
      opacity={dashed ? 0.7 : 0.95}
    />
  );
}

/** Linear extension of the ray from `a` through `b`, to the point with x = targetX.
 *  If backwards is true, we project back through `a`. Useful for virtual-image
 *  dashed back-extensions. */
function extendRay(a: Tip, b: Tip, targetX: number, backwards = false): Tip {
  void backwards;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) < 1e-6) return { x: b.x, y: targetX > a.x ? b.y + 1000 : b.y - 1000 };
  const t = (targetX - a.x) / dx;
  return { x: targetX, y: a.y + dy * t };
}

function lineAtX(a: Tip, b: Tip, x: number): Tip {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) < 1e-6) return { x, y: a.y };
  const t = (x - a.x) / dx;
  return { x, y: a.y + dy * t };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function regimeLabel(u: number, f: number): string {
  if (u < f) return "u < f · virtual, katta, tik";
  if (Math.abs(u - f) < 2) return "u = f · tasvir cheksizlikda";
  if (Math.abs(u - 2 * f) < 2) return "u = 2f · teng o'lchamli";
  if (u < 2 * f) return "f < u < 2f · katta, teskari";
  return "u > 2f · kichik, teskari";
}

function badgeFill(real: boolean, u: number, f: number): string {
  if (u < f) return "rgba(232, 162, 26, 0.85)";
  if (real) return "rgba(58, 168, 103, 0.85)";
  return "rgba(232, 162, 26, 0.85)";
}
