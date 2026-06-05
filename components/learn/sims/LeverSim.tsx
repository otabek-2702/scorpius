"use client";

/**
 * Kuch momenti — Richag (lever / torque).
 *
 * A horizontal plank rests on a triangular fulcrum. The learner drags two
 * weighted boxes (a small one and a big one) along the plank. The plank
 * physically rotates under net torque:
 *
 *   τ_net = m_left · g · d_left  −  m_right · g · d_right
 *
 * where d is the (signed) distance from the fulcrum. The plank's angular
 * acceleration α = τ_net / I, with the moment of inertia I computed from the
 * plank itself plus the two boxes as point masses at distance d.
 *
 * The fulcrum position is also a slider so the learner can move the pivot.
 *
 * Completion fires the first time the learner gets |τ_net| < 0.3 N·m
 * (balanced) — i.e. the plank holds still horizontally for a full second.
 *
 * Pure SVG + requestAnimationFrame. No deps.
 */

import { useEffect, useRef, useState } from "react";
import { useLabNotebook } from "@/lib/labNotebook";
import { useSimIdentity, useSimState } from "@/lib/simState";

interface Props {
  onComplete?: () => void;
}

// ---- Geometry --------------------------------------------------------------

const VBW = 480;
const VBH = 320;

const PLANK = {
  cy: 190,
  length: 400, // px
  thickness: 10,
};
const FULCRUM_Y = PLANK.cy + PLANK.thickness / 2;
const PLANK_X_CENTER = VBW / 2;

// Plank pixel scale: 50 px = 1 meter (so a 400px plank is 8 m, big enough for
// real-feeling torque numbers).
const PX_PER_M = 50;
const G = 9.8;

// Plank's own moment of inertia about its center: I = (1/12) m L²
const PLANK_MASS = 4; // kg
const PLANK_LEN_M = PLANK.length / PX_PER_M;
const PLANK_I0 = (PLANK_MASS * PLANK_LEN_M * PLANK_LEN_M) / 12;

// Angular damping — keeps the plank from oscillating forever.
const ANG_DAMP = 1.8;

// ---- Weights ---------------------------------------------------------------

interface WeightDef {
  id: string;
  label: string;
  mass: number; // kg
  size: number; // px square
  color: string;
}

const WEIGHTS: WeightDef[] = [
  { id: "small", label: "2 kg", mass: 2, size: 28, color: "#9aa1b2" },
  { id: "big",   label: "5 kg", mass: 5, size: 40, color: "#e8a21a" },
];

interface WeightState {
  id: string;
  /** Position along the plank, in plank-local px (signed, from plank center). */
  s: number;
  dragging: boolean;
}

export function LeverSim({ onComplete }: Props) {
  const { recordEntry } = useLabNotebook();
  const { publish: publishSimState } = useSimState();
  useSimIdentity("richag", "Kuch momenti laboratoriyasi");
  // Fulcrum position along plank: -1 (left end) to +1 (right end). 0 = center.
  const [fulcrum, setFulcrum] = useState(0);

  // Two weights start on either side of the fulcrum.
  const [weights, setWeights] = useState<WeightState[]>([
    { id: "small", s: -120, dragging: false },
    { id: "big", s: 80, dragging: false },
  ]);

  // Plank angle (radians) and angular velocity.
  const angleRef = useRef(0);
  const angVelRef = useRef(0);
  const [, forceRender] = useState(0);

  const weightsRef = useRef(weights);
  weightsRef.current = weights;
  const fulcrumRef = useRef(fulcrum);
  fulcrumRef.current = fulcrum;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ id: string; offsetS: number } | null>(null);

  const balancedTimeRef = useRef(0); // seconds of being balanced
  const completedRef = useRef(false);

  // ---- Physics loop --------------------------------------------------------
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.04, (now - last) / 1000);
      last = now;

      const fulcrumPx = fulcrumRef.current * (PLANK.length / 2);
      // Distance from fulcrum for each weight, in meters (signed)
      let net = 0;
      let I = PLANK_I0;
      for (const w of weightsRef.current) {
        const def = WEIGHTS.find((d) => d.id === w.id)!;
        const dPx = w.s - fulcrumPx;
        const dM = dPx / PX_PER_M;
        net += def.mass * G * dM;
        I += def.mass * dM * dM;
      }
      // Plank itself contributes torque if fulcrum is off-center
      const plankCenterToFulcrum = -fulcrumPx / PX_PER_M;
      net += PLANK_MASS * G * plankCenterToFulcrum;

      const alpha = net / I - ANG_DAMP * angVelRef.current;
      angVelRef.current += alpha * dt;
      angleRef.current += angVelRef.current * dt;

      // Clamp angle: when plank tip touches the ground, stop.
      const halfLen = PLANK.length / 2;
      const leftFromFulcrum = -halfLen - fulcrumPx;
      const rightFromFulcrum = halfLen - fulcrumPx;
      // Ground is at FULCRUM_Y (a bit below the plank's rest line)
      const groundDy = 86; // px below pivot
      // We use convention: positive angle rotates plank CW (right end down).
      // So right tip y = pivotY + sin(angle)*rightFromFulcrum (positive = down).
      // ground touch on right: sin(angle)*rightFromFulcrum = groundDy → angle = asin(groundDy/right)
      const rightLimit = rightFromFulcrum > 0 ? Math.asin(Math.min(1, groundDy / rightFromFulcrum)) : Math.PI / 2;
      const leftLimit = leftFromFulcrum < 0 ? Math.asin(Math.min(1, groundDy / -leftFromFulcrum)) : Math.PI / 2;
      if (angleRef.current > rightLimit) {
        angleRef.current = rightLimit;
        if (angVelRef.current > 0) angVelRef.current = 0;
      }
      if (angleRef.current < -leftLimit) {
        angleRef.current = -leftLimit;
        if (angVelRef.current < 0) angVelRef.current = 0;
      }

      // Balanced check: small net torque + small angular velocity + small angle
      if (
        Math.abs(net) < 0.3 &&
        Math.abs(angVelRef.current) < 0.05 &&
        Math.abs(angleRef.current) < 0.04
      ) {
        balancedTimeRef.current += dt;
        if (
          balancedTimeRef.current > 1.0 &&
          !completedRef.current &&
          // require the weights to NOT be at the trivial mirror starting position
          weightsRef.current.some((w, i) => Math.abs(w.s - (i === 0 ? -120 : 80)) > 5)
        ) {
          // Record the balance moment to the Lab Notebook — the moment-arm
          // products that produced equilibrium are the actual measurement.
          const ws = weightsRef.current;
          const fulcrumPxNow = fulcrumRef.current * (PLANK.length / 2);
          const parts = ws
            .map((w) => {
              const def = WEIGHTS.find((d) => d.id === w.id)!;
              const dM = Math.abs(w.s - fulcrumPxNow) / PX_PER_M;
              return `${def.mass.toFixed(0)} kg × ${dM.toFixed(2)} m`;
            })
            .join(" = ");
          recordEntry({
            label: "τ",
            value: "muvozanat",
            context: parts,
          });
          publishSimState({
            observations: { "muvozanat holatida": parts },
          });
          completedRef.current = true;
          onComplete?.();
        }
      } else {
        balancedTimeRef.current = 0;
      }

      forceRender((n) => n + 1);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Drag handling -------------------------------------------------------

  function svgPointer(evt: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = ((evt.clientX - rect.left) / rect.width) * VBW;
    const y = ((evt.clientY - rect.top) / rect.height) * VBH;
    return { x, y };
  }

  /** Convert world (x,y) → plank-local s (along plank from its center). */
  function worldToS(x: number): number {
    // Project x onto the plank, accounting for its current rotation. For
    // simplicity (and since drag is mostly horizontal), use cos(angle).
    const angle = angleRef.current;
    const cos = Math.cos(angle);
    const fulcrumPx = fulcrumRef.current * (PLANK.length / 2);
    const fulcrumAbsX = PLANK_X_CENTER + fulcrumPx;
    const dx = x - fulcrumAbsX;
    const sFromFulcrum = dx / Math.max(0.2, cos);
    return clamp(sFromFulcrum + fulcrumPx, -PLANK.length / 2 + 16, PLANK.length / 2 - 16);
  }

  function onWeightPointerDown(evt: React.PointerEvent<SVGGElement>, w: WeightState) {
    evt.preventDefault();
    (evt.target as Element).setPointerCapture?.(evt.pointerId);
    const p = svgPointer(evt as unknown as React.PointerEvent<SVGSVGElement>);
    const sAtPointer = worldToS(p.x);
    dragRef.current = { id: w.id, offsetS: w.s - sAtPointer };
    setWeights((prev) => prev.map((x) => (x.id === w.id ? { ...x, dragging: true } : x)));
  }

  function onPointerMove(evt: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const p = svgPointer(evt);
    const sNew = clamp(worldToS(p.x) + drag.offsetS, -PLANK.length / 2 + 16, PLANK.length / 2 - 16);
    setWeights((prev) => prev.map((w) => (w.id === drag.id ? { ...w, s: sNew } : w)));
  }

  function onPointerUp() {
    if (dragRef.current) {
      const id = dragRef.current.id;
      dragRef.current = null;
      setWeights((prev) => prev.map((w) => (w.id === id ? { ...w, dragging: false } : w)));
    }
  }

  // ---- Derived for render --------------------------------------------------

  const angle = angleRef.current;
  const fulcrumPx = fulcrum * (PLANK.length / 2);
  const fulcrumAbsX = PLANK_X_CENTER + fulcrumPx;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  // Net torque + per-weight contribution for readouts
  let netTorque = 0;
  const torques = WEIGHTS.map((def) => {
    const w = weights.find((x) => x.id === def.id)!;
    const dM = (w.s - fulcrumPx) / PX_PER_M;
    const t = def.mass * G * dM;
    netTorque += t;
    return { def, w, dM, t };
  });
  // Plank own torque
  netTorque += PLANK_MASS * G * (-fulcrumPx / PX_PER_M);

  const balanced = Math.abs(netTorque) < 0.3;
  const tilt = netTorque > 0 ? "right" : "left";

  // Plank endpoints in world space (rotated about fulcrum)
  function plankPt(sFromCenter: number) {
    const sFromFulcrum = sFromCenter - fulcrumPx;
    const rotX = sFromFulcrum * cos;
    const rotY = sFromFulcrum * sin;
    return { x: fulcrumAbsX + rotX, y: PLANK.cy + rotY };
  }

  const leftEnd = plankPt(-PLANK.length / 2);
  const rightEnd = plankPt(PLANK.length / 2);

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
          {/* Ground line */}
          <line
            x1={20}
            y1={FULCRUM_Y + 86}
            x2={VBW - 20}
            y2={FULCRUM_Y + 86}
            stroke="rgba(132, 126, 107, 0.55)"
            strokeWidth={1.2}
            strokeDasharray="3 4"
          />

          {/* Plank — rotated rectangle drawn as a polygon so we don't need transforms */}
          {(() => {
            const halfT = PLANK.thickness / 2;
            // Normal to plank (perpendicular)
            const nx = -sin;
            const ny = cos;
            const a = { x: leftEnd.x + nx * halfT, y: leftEnd.y + ny * halfT };
            const b = { x: rightEnd.x + nx * halfT, y: rightEnd.y + ny * halfT };
            const c = { x: rightEnd.x - nx * halfT, y: rightEnd.y - ny * halfT };
            const d = { x: leftEnd.x - nx * halfT, y: leftEnd.y - ny * halfT };
            const pts = [a, b, c, d].map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
            return (
              <polygon
                points={pts}
                fill="#a07142"
                stroke="#1a1813"
                strokeWidth={1.2}
              />
            );
          })()}

          {/* Tick marks along plank, every 1 m, drawn UNDER the plank */}
          {(() => {
            const ticks: React.ReactNode[] = [];
            for (let m = -3; m <= 3; m++) {
              const sCenter = m * PX_PER_M;
              const p = plankPt(sCenter);
              ticks.push(
                <g key={`tick-${m}`}>
                  <line
                    x1={p.x}
                    y1={p.y + PLANK.thickness / 2}
                    x2={p.x - sin * 4}
                    y2={p.y + PLANK.thickness / 2 + cos * 4}
                    stroke="#1a1813"
                    strokeWidth={0.8}
                    opacity={0.5}
                  />
                  {m !== 0 && (
                    <text
                      x={p.x - sin * 14}
                      y={p.y + PLANK.thickness / 2 + cos * 14 + 4}
                      fontSize={8}
                      fill="rgba(180,170,140,0.7)"
                      textAnchor="middle"
                    >
                      {Math.abs(m)}
                    </text>
                  )}
                </g>
              );
            }
            return ticks;
          })()}

          {/* Weights — sit on top of the plank, ride its rotation */}
          {WEIGHTS.map((def) => {
            const w = weights.find((x) => x.id === def.id)!;
            const top = plankPt(w.s);
            // Offset above plank by box half-size, perpendicular to plank
            const nx = -sin;
            const ny = cos;
            const cx = top.x + nx * (def.size / 2 + PLANK.thickness / 2);
            const cy = top.y + ny * (def.size / 2 + PLANK.thickness / 2) - def.size;
            const center = { x: cx + def.size / 2, y: cy + def.size / 2 };
            return (
              <g
                key={def.id}
                style={{ cursor: "grab" }}
                onPointerDown={(e) => onWeightPointerDown(e, w)}
                transform={`rotate(${(angle * 180) / Math.PI} ${center.x} ${center.y})`}
              >
                <rect
                  x={cx}
                  y={cy}
                  width={def.size}
                  height={def.size}
                  rx={4}
                  fill={def.color}
                  stroke="#1a1813"
                  strokeWidth={1.2}
                />
                <text
                  x={center.x}
                  y={center.y + 3}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={700}
                  fill="#1a1813"
                >
                  {def.label}
                </text>
              </g>
            );
          })}

          {/* Fulcrum — triangular wedge, sits under plank */}
          <polygon
            points={`${fulcrumAbsX - 22},${FULCRUM_Y + 60} ${fulcrumAbsX + 22},${FULCRUM_Y + 60} ${fulcrumAbsX},${FULCRUM_Y}`}
            fill="#5a5a64"
            stroke="#1a1813"
            strokeWidth={1.2}
          />
          {/* Fulcrum tip dot */}
          <circle cx={fulcrumAbsX} cy={FULCRUM_Y} r={2.5} fill="#1a1813" />

          {/* Torque readout — top-right card */}
          <g transform={`translate(${VBW - 134}, 14)`}>
            <rect
              x={0}
              y={0}
              width={120}
              height={68}
              rx={8}
              fill="rgba(242, 239, 230, 0.7)"
              stroke="rgba(132, 126, 107, 0.45)"
              strokeWidth={1}
            />
            <text x={10} y={16} fontSize={9} fontWeight={700} fill="#1a1813" letterSpacing="0.04em">
              NET MOMENT
            </text>
            <text x={10} y={36} fontSize={15} fontWeight={700} fill="#1a1813" fontFamily="ui-monospace, monospace">
              {netTorque >= 0 ? "+" : ""}{netTorque.toFixed(1)} N·m
            </text>
            <text x={10} y={56} fontSize={9} fontWeight={600} fill={balanced ? "#1f7240" : "#a9760a"}>
              {balanced ? "Muvozanat ✓" : `Yengilroq: ${tilt === "right" ? "chap" : "o'ng"}`}
            </text>
          </g>

        </svg>
      </div>

      {/* Per-weight readouts */}
      <div className="grid grid-cols-2 gap-2">
        {torques.map(({ def, dM, t }) => (
          <div
            key={def.id}
            className="rounded-[12px] border border-void-500 bg-void-700 px-3 py-2.5"
          >
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: def.color }} />
              <span className="text-[12px] font-semibold text-void-100">{def.label}</span>
            </div>
            <div className="mt-1.5 font-mono text-[12px] tabular-nums text-void-200">
              d = {dM.toFixed(2)} m
            </div>
            <div className="font-mono text-[13px] font-semibold tabular-nums text-void-100">
              τ = {t >= 0 ? "+" : ""}{t.toFixed(1)} N·m
            </div>
          </div>
        ))}
      </div>

      {/* Fulcrum slider */}
      <div className="rounded-[14px] border border-void-500 bg-void-700/60 p-3">
        <div className="flex items-baseline justify-between">
          <label htmlFor="lev-fulcrum" className="text-[12px] font-semibold text-void-200">
            Tayanch nuqtasi (richagning markazidan)
          </label>
          <span className="font-mono text-[12px] text-void-300">
            {(fulcrum * (PLANK.length / 2 / PX_PER_M)).toFixed(2)} m
          </span>
        </div>
        <input
          id="lev-fulcrum"
          type="range"
          min={-0.9}
          max={0.9}
          step={0.02}
          value={fulcrum}
          onChange={(e) => setFulcrum(Number(e.target.value))}
          className="mt-2 w-full accent-antares-500"
        />
        <div className="mt-1 flex justify-between text-[10px] text-void-300">
          <span>Chapga</span>
          <span>Markaz</span>
          <span>O&apos;ngga</span>
        </div>
      </div>

      <p className="text-[12px] leading-relaxed text-void-300">
        Tarozini <span className="text-void-200">muvozanatga keltiring</span>: og&apos;ir va yengil
        toshlarni richag bo&apos;ylab suring. Kuch momenti τ = F · d — kuch va yelka ko&apos;paytmasi.
        Ikkala tomonning momentlari teng bo&apos;lsa — tinch.
      </p>
    </div>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
