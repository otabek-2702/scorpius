"use client";

/**
 * Paskal qonuni — hydraulic press / U-tube.
 *
 * Two vertical cylinders connected by oil at the bottom. The left (small)
 * piston has area A1; the right (large) piston has area A2. The learner
 * pushes the small piston DOWN by dragging it.  Because the fluid is
 * incompressible:
 *
 *   F1 / A1  =  F2 / A2          (pressure is the same everywhere — Pascal)
 *   V1       =  V2               (volume conservation)
 *   →  d1 · A1 = d2 · A2         (small moves a lot, big moves a little)
 *   →  F2     = F1 · A2/A1       (small force amplifies into big force)
 *
 * On the large piston sits a CAR — a real 1200 kg load. The car rises when
 * F2 > car weight. We integrate volume conservation directly: as the small
 * piston moves down by dy, the big piston moves up by dy · (A1/A2).
 *
 * Manipulable parameters:
 *   • Drag the small piston (vertical drag)
 *   • Area ratio slider (A2/A1: 1× → 20×)
 *
 * Completion: lift the car at least 12 px off the platform.
 */

import { useEffect, useRef, useState } from "react";

interface Props {
  onComplete?: () => void;
}

const VBW = 480;
const VBH = 340;

// ---- Geometry --------------------------------------------------------------

const LEFT_CYL_X = 80;
const RIGHT_CYL_X = 320;
const LEFT_CYL_W_BASE = 36; // base width — modulated by ratio (keeps small constant, big grows)
const CYL_TOP_Y = 60;
const CYL_BOTTOM_Y = 230;
const CYL_H = CYL_BOTTOM_Y - CYL_TOP_Y;

// Fluid floor — horizontal pipe connects both cylinders at the bottom.
const PIPE_Y = CYL_BOTTOM_Y - 8;

// Visual scale: piston travel in px is the volume column. Bigger cylinder
// → less visible travel for the same volume change. We compute widths from
// the ratio.

const CAR_W = 100;
const CAR_H = 38;

export function PascalSim({ onComplete }: Props) {
  const [ratio, setRatio] = useState<number>(6);
  // Starting piston positions (top y, in px)
  const [leftPistonY, setLeftPistonY] = useState<number>(CYL_TOP_Y + 24);
  const completedRef = useRef(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ pointerStartY: number; startLeftY: number } | null>(null);

  // Derived widths
  const leftW = LEFT_CYL_W_BASE;
  const rightW = LEFT_CYL_W_BASE * Math.sqrt(ratio); // area scales with w², but we want w to grow visibly
  // (We model area = w² for visual cleanness — cylinders are square-cross-section. Physics still correct.)
  const A1 = leftW * leftW;
  const A2 = rightW * rightW;

  // Starting volumes: when both pistons sit at "rest" position, fluid column
  // height is equal on both sides. We pick a baseline left piston rest y =
  // CYL_TOP_Y + 24 (24 px of air above oil on left). The corresponding right
  // piston rest y is set so total fluid volume below the pistons matches.

  const LEFT_REST_Y = CYL_TOP_Y + 24;
  const RIGHT_REST_Y = CYL_TOP_Y + 60; // big piston starts a bit lower
  // Reference fluid volume (constant):
  const REF_VOL = (CYL_BOTTOM_Y - LEFT_REST_Y) * A1 + (CYL_BOTTOM_Y - RIGHT_REST_Y) * A2;

  // Compute right piston Y from left piston Y by conserving REF_VOL.
  function rightPistonYFromLeft(leftY: number): number {
    const rightBottomToTop = (REF_VOL - (CYL_BOTTOM_Y - leftY) * A1) / A2;
    const rightY = CYL_BOTTOM_Y - rightBottomToTop;
    return rightY;
  }

  const rightPistonY = rightPistonYFromLeft(leftPistonY);

  // Car sits on top of the right piston. It rests on the platform initially
  // at y = RIGHT_REST_Y - CAR_H. As the right piston rises (y decreases),
  // the car rises with it. The car's base y = rightPistonY - 4 - CAR_H.
  const carRestY = rightPistonYFromLeft(LEFT_REST_Y) - CAR_H - 4;
  const carY = Math.min(carRestY, rightPistonY - CAR_H - 4);
  const lift = Math.max(0, carRestY - carY);

  // Forces — qualitatively. We treat F1 as user's hand force needed to push
  // the piston: F1 = W_car · A1 / A2, where W_car = 1200 kg × 9.8 ≈ 11760 N.
  const W_CAR = 1200 * 9.8;
  const F1_required = W_CAR * (A1 / A2);

  // Completion + pulse
  useEffect(() => {
    if (lift > 12 && !completedRef.current) {
      completedRef.current = true;
      onComplete?.();
    }
  }, [lift, onComplete]);

  // ---- Drag handling -------------------------------------------------------
  function svgPointer(evt: React.PointerEvent<SVGSVGElement | SVGGElement>) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = ((evt.clientX - rect.left) / rect.width) * VBW;
    const y = ((evt.clientY - rect.top) / rect.height) * VBH;
    return { x, y };
  }

  function onPistonPointerDown(evt: React.PointerEvent<SVGGElement>) {
    evt.preventDefault();
    (evt.target as Element).setPointerCapture?.(evt.pointerId);
    const p = svgPointer(evt);
    dragRef.current = { pointerStartY: p.y, startLeftY: leftPistonY };
  }
  function onPointerMove(evt: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const p = svgPointer(evt);
    const dy = p.y - drag.pointerStartY;
    let newY = drag.startLeftY + dy;
    // Bounds: piston top can't go above the cylinder mouth, can't go below
    // the bottom (would have no fluid). The right piston also can't go above
    // the cylinder mouth.
    newY = clamp(newY, CYL_TOP_Y + 8, CYL_BOTTOM_Y - 20);
    // Also ensure right piston stays in bounds — recompute and back off if needed
    let rY = rightPistonYFromLeft(newY);
    if (rY < CYL_TOP_Y + 8) {
      // Find max leftY such that rY >= CYL_TOP_Y + 8
      // (CYL_BOTTOM_Y - (CYL_TOP_Y + 8)) * A2 = REF_VOL - (CYL_BOTTOM_Y - newY) * A1
      // → newY = CYL_BOTTOM_Y - (REF_VOL - (CYL_BOTTOM_Y - (CYL_TOP_Y + 8)) * A2) / A1
      newY =
        CYL_BOTTOM_Y -
        (REF_VOL - (CYL_BOTTOM_Y - (CYL_TOP_Y + 8)) * A2) / A1;
      rY = rightPistonYFromLeft(newY);
    }
    setLeftPistonY(newY);
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  function reset() {
    setLeftPistonY(LEFT_REST_Y);
  }

  // Changing the area ratio rescales the volume relationship between the two
  // cylinders. If the small piston was pushed deep at a high ratio, the same
  // leftPistonY can drive the big piston (and the car) far above the cylinder
  // mouth at a low ratio — flying off-canvas with a nonsense lift readout.
  // Re-clamp leftPistonY against the NEW ratio so the right piston stays in
  // bounds (rightY >= CYL_TOP_Y + 8), mirroring the drag-time guard.
  function handleRatioChange(nextRatio: number) {
    setRatio(nextRatio);
    const rW = LEFT_CYL_W_BASE * Math.sqrt(nextRatio);
    const a1 = leftW * leftW;
    const a2 = rW * rW;
    const refVol = (CYL_BOTTOM_Y - LEFT_REST_Y) * a1 + (CYL_BOTTOM_Y - RIGHT_REST_Y) * a2;
    // Deepest leftY for which rightY >= CYL_TOP_Y + 8.
    const maxLeftY =
      CYL_BOTTOM_Y - (refVol - (CYL_BOTTOM_Y - (CYL_TOP_Y + 8)) * a2) / a1;
    setLeftPistonY((prev) =>
      clamp(prev, CYL_TOP_Y + 8, Math.min(CYL_BOTTOM_Y - 20, maxLeftY)),
    );
  }

  // ---- Render --------------------------------------------------------------
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
            y1={CYL_BOTTOM_Y + 60}
            x2={VBW - 20}
            y2={CYL_BOTTOM_Y + 60}
            stroke="rgba(132, 126, 107, 0.55)"
            strokeWidth={1.2}
            strokeDasharray="3 4"
          />

          {/* Left cylinder (small) */}
          {(() => {
            const x = LEFT_CYL_X - leftW / 2;
            return (
              <rect
                x={x}
                y={CYL_TOP_Y}
                width={leftW}
                height={CYL_H + 30}
                fill="rgba(255,255,255,0.05)"
                stroke="rgba(132,126,107,0.85)"
                strokeWidth={1.4}
                rx={3}
              />
            );
          })()}

          {/* Right cylinder (big) */}
          {(() => {
            const x = RIGHT_CYL_X - rightW / 2;
            return (
              <rect
                x={x}
                y={CYL_TOP_Y}
                width={rightW}
                height={CYL_H + 30}
                fill="rgba(255,255,255,0.05)"
                stroke="rgba(132,126,107,0.85)"
                strokeWidth={1.4}
                rx={3}
              />
            );
          })()}

          {/* Connecting pipe */}
          <rect
            x={LEFT_CYL_X + leftW / 2}
            y={PIPE_Y}
            width={RIGHT_CYL_X - rightW / 2 - (LEFT_CYL_X + leftW / 2)}
            height={16}
            fill="rgba(132,126,107,0.18)"
            stroke="rgba(132,126,107,0.85)"
            strokeWidth={1.2}
            rx={2}
          />

          {/* Oil fill — left cylinder below piston */}
          <rect
            x={LEFT_CYL_X - leftW / 2 + 1}
            y={leftPistonY + 6}
            width={leftW - 2}
            height={CYL_BOTTOM_Y + 30 - (leftPistonY + 6)}
            fill="rgba(232, 162, 26, 0.28)"
          />
          {/* Oil fill — right cylinder below piston */}
          <rect
            x={RIGHT_CYL_X - rightW / 2 + 1}
            y={rightPistonY + 6}
            width={rightW - 2}
            height={CYL_BOTTOM_Y + 30 - (rightPistonY + 6)}
            fill="rgba(232, 162, 26, 0.28)"
          />
          {/* Oil fill — pipe */}
          <rect
            x={LEFT_CYL_X + leftW / 2}
            y={PIPE_Y + 1}
            width={RIGHT_CYL_X - rightW / 2 - (LEFT_CYL_X + leftW / 2)}
            height={14}
            fill="rgba(232, 162, 26, 0.28)"
          />

          {/* Left piston — draggable */}
          <g style={{ cursor: "ns-resize" }} onPointerDown={onPistonPointerDown}>
            <rect
              x={LEFT_CYL_X - leftW / 2 + 1}
              y={leftPistonY}
              width={leftW - 2}
              height={6}
              fill="#9aa1b2"
              stroke="#1a1813"
              strokeWidth={1}
              rx={1}
            />
            {/* Push handle on top of small piston */}
            <rect
              x={LEFT_CYL_X - 6}
              y={leftPistonY - 18}
              width={12}
              height={18}
              fill="#9aa1b2"
              stroke="#1a1813"
              strokeWidth={1}
              rx={2}
            />
            {/* Down-arrow on the handle */}
            <polygon
              points={`${LEFT_CYL_X - 4},${leftPistonY - 13} ${LEFT_CYL_X + 4},${leftPistonY - 13} ${LEFT_CYL_X},${leftPistonY - 6}`}
              fill="#1a1813"
            />
          </g>

          {/* Right piston */}
          <rect
            x={RIGHT_CYL_X - rightW / 2 + 1}
            y={rightPistonY}
            width={rightW - 2}
            height={6}
            fill="#9aa1b2"
            stroke="#1a1813"
            strokeWidth={1}
            rx={1}
          />

          {/* Car sitting on right piston */}
          {(() => {
            const cx = RIGHT_CYL_X;
            const baseY = carY;
            return (
              <g>
                {/* Car body */}
                <rect
                  x={cx - CAR_W / 2}
                  y={baseY + 12}
                  width={CAR_W}
                  height={CAR_H - 12}
                  rx={4}
                  fill="#3b7bd1"
                  stroke="#1a1813"
                  strokeWidth={1.2}
                />
                {/* Cabin */}
                <polygon
                  points={`${cx - 32},${baseY + 12} ${cx - 18},${baseY} ${cx + 18},${baseY} ${cx + 32},${baseY + 12}`}
                  fill="#5798e0"
                  stroke="#1a1813"
                  strokeWidth={1.2}
                />
                {/* Wheels */}
                <circle cx={cx - 30} cy={baseY + CAR_H - 2} r={8} fill="#1a1813" />
                <circle cx={cx + 30} cy={baseY + CAR_H - 2} r={8} fill="#1a1813" />
                <circle cx={cx - 30} cy={baseY + CAR_H - 2} r={4} fill="#9aa1b2" />
                <circle cx={cx + 30} cy={baseY + CAR_H - 2} r={4} fill="#9aa1b2" />
                {/* Mass label */}
                <text
                  x={cx}
                  y={baseY + 26}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={700}
                  fill="#fbf9f3"
                >
                  1200 kg
                </text>
              </g>
            );
          })()}

          {/* Force arrows */}
          {/* F1 down on left piston */}
          <line
            x1={LEFT_CYL_X + leftW / 2 + 10}
            y1={leftPistonY - 16}
            x2={LEFT_CYL_X + leftW / 2 + 10}
            y2={leftPistonY + 2}
            stroke="#e8453b"
            strokeWidth={2}
          />
          <polygon
            points={`${LEFT_CYL_X + leftW / 2 + 7},${leftPistonY - 2} ${LEFT_CYL_X + leftW / 2 + 13},${leftPistonY - 2} ${LEFT_CYL_X + leftW / 2 + 10},${leftPistonY + 4}`}
            fill="#e8453b"
          />
          <text
            x={LEFT_CYL_X + leftW / 2 + 14}
            y={leftPistonY - 8}
            fontSize={9}
            fontWeight={700}
            fill="#e8453b"
          >
            F₁
          </text>
          {/* F2 up on right piston */}
          <line
            x1={RIGHT_CYL_X + rightW / 2 + 10}
            y1={rightPistonY + 16}
            x2={RIGHT_CYL_X + rightW / 2 + 10}
            y2={rightPistonY - 2}
            stroke="#e8a21a"
            strokeWidth={2}
          />
          <polygon
            points={`${RIGHT_CYL_X + rightW / 2 + 7},${rightPistonY + 2} ${RIGHT_CYL_X + rightW / 2 + 13},${rightPistonY + 2} ${RIGHT_CYL_X + rightW / 2 + 10},${rightPistonY - 4}`}
            fill="#e8a21a"
          />
          <text
            x={RIGHT_CYL_X + rightW / 2 + 14}
            y={rightPistonY + 8}
            fontSize={9}
            fontWeight={700}
            fill="#e8a21a"
          >
            F₂
          </text>

          {/* Area labels */}
          <text
            x={LEFT_CYL_X}
            y={CYL_TOP_Y - 8}
            fontSize={10}
            fontWeight={700}
            fill="#fbf9f3"
            textAnchor="middle"
          >
            A₁
          </text>
          <text
            x={RIGHT_CYL_X}
            y={CYL_TOP_Y - 8}
            fontSize={10}
            fontWeight={700}
            fill="#fbf9f3"
            textAnchor="middle"
          >
            A₂
          </text>

          {/* Lift readout — top right */}
          <g transform={`translate(${VBW - 134}, 14)`}>
            <rect
              x={0}
              y={0}
              width={120}
              height={84}
              rx={8}
              fill="rgba(242, 239, 230, 0.7)"
              stroke="rgba(132, 126, 107, 0.45)"
              strokeWidth={1}
            />
            <text x={10} y={16} fontSize={9} fontWeight={700} fill="#1a1813" letterSpacing="0.04em">
              MASHINA QALQDI
            </text>
            <text x={10} y={36} fontSize={15} fontWeight={700} fill="#1a1813" fontFamily="ui-monospace, monospace">
              {(lift / 50).toFixed(2)} m
            </text>
            <text x={10} y={56} fontSize={9} fontWeight={700} fill="#1a1813" letterSpacing="0.04em">
              SIZNING KUCH
            </text>
            <text x={10} y={72} fontSize={12} fontWeight={700} fill="#a9760a" fontFamily="ui-monospace, monospace">
              {(F1_required / 9.8).toFixed(0)} kg
            </text>
          </g>
        </svg>
      </div>

      {/* Ratio slider */}
      <div className="rounded-[14px] border border-void-500 bg-void-700/60 p-3">
        <div className="flex items-baseline justify-between">
          <label htmlFor="psk-ratio" className="text-[12px] font-semibold text-void-200">
            Yuzalar nisbati A₂ / A₁
          </label>
          <span className="font-mono text-[12px] text-void-300">
            {ratio.toFixed(0)}×
          </span>
        </div>
        <input
          id="psk-ratio"
          type="range"
          min={1}
          max={20}
          step={1}
          value={ratio}
          onChange={(e) => handleRatioChange(Number(e.target.value))}
          className="mt-2 w-full accent-antares-500"
        />
        <div className="mt-1 flex justify-between text-[10px] text-void-300">
          <span>1×</span>
          <span>10×</span>
          <span>20×</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-[40px] flex-1 items-center justify-center rounded-full border border-void-500 bg-void-700 px-4 text-[13px] font-semibold text-void-100 transition hover:bg-void-600 active:scale-[0.98]"
        >
          Boshlang&apos;ich holatga qaytarish
        </button>
      </div>

      <p className="text-[12px] leading-relaxed text-void-300">
        Kichik pistonni <span className="text-void-200">pastga torting</span> — katta piston
        mashinani ko&apos;taradi. Bosim ikkala tomonda bir xil: F₁/A₁ = F₂/A₂. Yuzani 20 marta
        kattalashtirsangiz — kuchingiz ham 20 marta kuchayadi. Bu — gidravlik tormoz, ekskavator
        va liftlarning siri.
      </p>
    </div>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
