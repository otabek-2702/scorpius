"use client";

/**
 * Oddiy elektr zanjiri — battery, switch, bulb, resistor.
 *
 * The circuit is a closed rectangular loop. The learner toggles the SWITCH
 * (open/closed) and adjusts the BATTERY voltage and the RESISTOR. When the
 * switch is closed, electrons (drawn as glowing fireflies) march along the
 * wire, around the loop, in single file. The bulb GLOWS with brightness
 * proportional to power P = V²/R = I²R = V·I.
 *
 * Real physics — Ohm's law:
 *   I = V / (R_bulb + R_resistor)
 *   P_bulb = I² · R_bulb
 *
 * The bulb's resistance is fixed; the external resistor R is variable. The
 * brightness is normalized so that at V=6V, R=0Ω, the bulb is at full glow.
 *
 * Manipulable parameters:
 *   • Switch on/off (click)
 *   • Voltage slider 0–12 V
 *   • Resistor slider 0–20 Ω
 *
 * Completion: close the switch AND adjust at least one of V or R while the
 * switch is closed.
 */

import { useEffect, useRef, useState } from "react";
import { useLabNotebook } from "@/lib/labNotebook";
import { useSimIdentity, useSimState } from "@/lib/simState";

interface Props {
  onComplete?: () => void;
}

const VBW = 480;
const VBH = 280;

// --- Loop geometry ----------------------------------------------------------
// Counter-clockwise wire path: starts at battery + terminal (top-left), goes
// up, right across top, down right side through bulb, down + left back
// through resistor + switch + back to battery -.
//
// Define waypoints. Each segment is straight; we sample along total length.

interface Pt { x: number; y: number; }
const LOOP: Pt[] = [
  { x: 80, y: 200 },   // 0: battery + terminal (start)
  { x: 80, y: 60 },    // 1: top-left corner
  { x: 240, y: 60 },   // 2: pre-bulb (top)
  { x: 280, y: 60 },   // 3: post-bulb (top)
  { x: 400, y: 60 },   // 4: top-right corner
  { x: 400, y: 130 },  // 5: pre-resistor
  { x: 400, y: 170 },  // 6: post-resistor
  { x: 400, y: 200 },  // 7: bottom-right corner
  { x: 260, y: 200 },  // 8: pre-switch
  { x: 220, y: 200 },  // 9: post-switch
  { x: 80, y: 200 },   // 10: back to battery (loop)
];

const BULB_CENTER: Pt = { x: 260, y: 60 };
const SWITCH_CENTER: Pt = { x: 240, y: 200 };
const RESISTOR_CENTER: Pt = { x: 400, y: 150 };
const BATTERY_CENTER: Pt = { x: 80, y: 200 };

// Cumulative arc-length along the loop
const SEG_LENS: number[] = [];
let TOTAL_LEN = 0;
for (let i = 0; i < LOOP.length - 1; i++) {
  const dx = LOOP[i + 1].x - LOOP[i].x;
  const dy = LOOP[i + 1].y - LOOP[i].y;
  const L = Math.hypot(dx, dy);
  SEG_LENS.push(L);
  TOTAL_LEN += L;
}

function pointOnLoop(s: number): Pt {
  // s in [0, TOTAL_LEN). Walk segments.
  let sLeft = ((s % TOTAL_LEN) + TOTAL_LEN) % TOTAL_LEN;
  for (let i = 0; i < SEG_LENS.length; i++) {
    if (sLeft <= SEG_LENS[i]) {
      const t = sLeft / SEG_LENS[i];
      return {
        x: LOOP[i].x + (LOOP[i + 1].x - LOOP[i].x) * t,
        y: LOOP[i].y + (LOOP[i + 1].y - LOOP[i].y) * t,
      };
    }
    sLeft -= SEG_LENS[i];
  }
  return LOOP[0];
}

// Physics constants
const R_BULB = 4; // Ohms — fixed
const I_MAX_GLOW = 12 / R_BULB; // = 3 A at V=12, R_ext=0 → max glow

const N_ELECTRONS = 18;

export function CircuitSim({ onComplete }: Props) {
  const { recordEntry } = useLabNotebook();
  const { publish: publishSimState } = useSimState();
  useSimIdentity("zanjir", "Elektr zanjiri laboratoriyasi");
  const [voltage, setVoltage] = useState<number>(6);
  const [rExt, setRExt] = useState<number>(4);
  const [closed, setClosed] = useState<boolean>(false);

  const closedRef = useRef(closed);
  closedRef.current = closed;
  const voltageRef = useRef(voltage);
  voltageRef.current = voltage;
  const rExtRef = useRef(rExt);
  rExtRef.current = rExt;

  // Track adjustments after switch close
  const initiallyAdjustedRef = useRef<{ v: number; r: number } | null>(null);
  const completedRef = useRef(false);

  // Electron positions (s, arc length around loop).
  const electronsRef = useRef<number[]>([]);
  if (electronsRef.current.length === 0) {
    for (let i = 0; i < N_ELECTRONS; i++) {
      electronsRef.current.push((i * TOTAL_LEN) / N_ELECTRONS);
    }
  }

  const [, forceRender] = useState(0);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (closedRef.current) {
        const I = voltageRef.current / (R_BULB + Math.max(0.1, rExtRef.current));
        // Speed: at max current (3 A), electrons travel ~ 120 px/s. Tuned for
        // pleasant motion, not realism (drift velocity is actually mm/hour).
        const speed = (I / I_MAX_GLOW) * 120;
        for (let i = 0; i < electronsRef.current.length; i++) {
          electronsRef.current[i] = (electronsRef.current[i] + speed * dt) % TOTAL_LEN;
        }
        forceRender((n) => n + 1);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  function toggleSwitch() {
    // Side effects (recordEntry + ref mutation) must NOT live inside the
    // setState updater — StrictMode runs the updater twice in dev, which
    // double-fires the lab-notebook entry. Compute the next value imperatively.
    const next = !closedRef.current;
    if (next && !initiallyAdjustedRef.current) {
      initiallyAdjustedRef.current = { v: voltageRef.current, r: rExtRef.current };
    }
    // Record an entry every time the circuit goes from open → closed. The
    // V/I/R triple at this moment is the measurement the student "took".
    if (next) {
      const v = voltageRef.current;
      const r = rExtRef.current;
      const I = v / (R_BULB + Math.max(0.1, r));
      const P = v * I;
      recordEntry({
        label: "I",
        value: `${I.toFixed(2)} A`,
        context: `V = ${v.toFixed(1)} V · R = ${r.toFixed(1)} Ω · P = ${P.toFixed(2)} W`,
      });
      publishSimState({
        params: {
          kuchlanish: `${v.toFixed(1)} V`,
          qarshilik: `${r.toFixed(1)} Ω`,
          kalit: "yopiq",
        },
        observations: {
          tok: `${I.toFixed(2)} A`,
          quvvat: `${P.toFixed(2)} W`,
        },
      });
    } else {
      publishSimState({ params: { kalit: "ochiq" }, observations: { tok: "0 A" } });
    }
    setClosed(next);
  }

  // Completion check
  useEffect(() => {
    if (!closed) return;
    if (completedRef.current) return;
    const init = initiallyAdjustedRef.current;
    if (!init) return;
    if (
      Math.abs(voltage - init.v) > 0.5 ||
      Math.abs(rExt - init.r) > 0.5
    ) {
      completedRef.current = true;
      onComplete?.();
    }
  }, [voltage, rExt, closed, onComplete]);

  // Derived for display
  const totalR = R_BULB + Math.max(0.1, rExt);
  const current = closed ? voltage / totalR : 0;
  const power = current * current * R_BULB;
  const brightness = Math.min(1, power / (I_MAX_GLOW * I_MAX_GLOW * R_BULB));

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="overflow-hidden rounded-[18px] border border-void-500 bg-void-700/40">
        <svg viewBox={`0 0 ${VBW} ${VBH}`} className="block w-full" role="img" aria-label="Electric circuit">
          {/* Wires — drawn as a single polyline, breaks at the switch + bulb */}
          {/* Segments 0-1, 1-2 (battery → pre-bulb) */}
          <polyline
            points={`${LOOP[0].x},${LOOP[0].y} ${LOOP[1].x},${LOOP[1].y} ${LOOP[2].x},${LOOP[2].y}`}
            fill="none"
            stroke="#9aa1b2"
            strokeWidth={3}
            strokeLinecap="round"
          />
          {/* Segment 3-4-5 (post-bulb → top right → pre-resistor) */}
          <polyline
            points={`${LOOP[3].x},${LOOP[3].y} ${LOOP[4].x},${LOOP[4].y} ${LOOP[5].x},${LOOP[5].y}`}
            fill="none"
            stroke="#9aa1b2"
            strokeWidth={3}
            strokeLinecap="round"
          />
          {/* Segment 6-7-8 (post-resistor → bottom-right corner → pre-switch) */}
          <polyline
            points={`${LOOP[6].x},${LOOP[6].y} ${LOOP[7].x},${LOOP[7].y} ${LOOP[8].x},${LOOP[8].y}`}
            fill="none"
            stroke="#9aa1b2"
            strokeWidth={3}
            strokeLinecap="round"
          />
          {/* Segment 9-10 (post-switch → battery −) */}
          <polyline
            points={`${LOOP[9].x},${LOOP[9].y} ${LOOP[10].x},${LOOP[10].y}`}
            fill="none"
            stroke="#9aa1b2"
            strokeWidth={3}
            strokeLinecap="round"
          />

          {/* Battery — vertical, with long + and short - plates */}
          {(() => {
            const cx = BATTERY_CENTER.x;
            const cy = BATTERY_CENTER.y;
            return (
              <g>
                {/* Body */}
                <rect x={cx - 14} y={cy - 24} width={28} height={48} rx={3} fill="#3aa867" stroke="#1a1813" strokeWidth={1.2} />
                {/* + plate (long line at top) */}
                <line x1={cx - 10} y1={cy - 10} x2={cx + 10} y2={cy - 10} stroke="#1a1813" strokeWidth={2.4} />
                <text x={cx + 18} y={cy - 7} fontSize={12} fontWeight={700} fill="#fbf9f3">+</text>
                {/* - plate (short line at bottom) */}
                <line x1={cx - 6} y1={cy + 10} x2={cx + 6} y2={cy + 10} stroke="#1a1813" strokeWidth={2.4} />
                <text x={cx + 18} y={cy + 14} fontSize={12} fontWeight={700} fill="#fbf9f3">−</text>
                <text x={cx} y={cy - 32} fontSize={10} fontWeight={700} fill="#fbf9f3" textAnchor="middle">
                  {voltage.toFixed(1)} V
                </text>
              </g>
            );
          })()}

          {/* Bulb — glows by brightness */}
          {(() => {
            const cx = BULB_CENTER.x;
            const cy = BULB_CENTER.y;
            const glow = brightness;
            return (
              <g style={{ cursor: "default" }}>
                {/* Glow halo */}
                {glow > 0.02 && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={28 + glow * 24}
                    fill={`rgba(255, 220, 110, ${glow * 0.45})`}
                  />
                )}
                {/* Bulb glass */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={16}
                  fill={glow > 0.04 ? `rgb(${Math.round(255 - glow * 20)}, ${Math.round(210 + glow * 30)}, ${Math.round(60 + glow * 60)})` : "#3a3a3a"}
                  stroke="#1a1813"
                  strokeWidth={1.4}
                />
                {/* Filament — visible when not too bright */}
                <path
                  d={`M ${cx - 8},${cy} Q ${cx - 4},${cy - 6} ${cx},${cy} T ${cx + 8},${cy}`}
                  fill="none"
                  stroke={glow > 0.5 ? "#1a1813" : "rgba(232,162,26,0.85)"}
                  strokeWidth={1.6}
                />
                {/* Bulb base (cap) */}
                <rect x={cx - 6} y={cy - 18} width={12} height={4} fill="#5a5a64" stroke="#1a1813" strokeWidth={0.8} />
                {/* Label */}
                <text x={cx} y={cy + 32} fontSize={9} fontWeight={700} fill="#fbf9f3" textAnchor="middle">
                  Lampochka
                </text>
              </g>
            );
          })()}

          {/* Resistor — zig-zag */}
          {(() => {
            const cx = RESISTOR_CENTER.x;
            const cy = RESISTOR_CENTER.y;
            const zig = `M ${cx},${cy - 20} l -6,4 l 12,8 l -12,8 l 12,8 l -6,4`;
            return (
              <g>
                <path d={zig} fill="none" stroke="#e8a21a" strokeWidth={2.4} strokeLinecap="round" />
                <text x={cx + 18} y={cy + 4} fontSize={10} fontWeight={700} fill="#fbf9f3">
                  {rExt.toFixed(1)} Ω
                </text>
              </g>
            );
          })()}

          {/* Switch — line that hinges at one end. Closed = horizontal, Open = tilted up */}
          {(() => {
            const cx = SWITCH_CENTER.x;
            const cy = SWITCH_CENTER.y;
            // Hinge at right end (x = cx+16), free end at (cx-16, cy) when closed
            const hinge = { x: cx + 18, y: cy };
            const angle = closed ? 0 : -Math.PI / 4;
            const armLen = 30;
            const freeEnd = {
              x: hinge.x - armLen * Math.cos(angle),
              y: hinge.y - armLen * Math.sin(angle),
            };
            return (
              <g style={{ cursor: "pointer" }} onClick={toggleSwitch}>
                {/* invisible hit area */}
                <rect x={cx - 26} y={cy - 26} width={56} height={36} fill="transparent" />
                {/* hinge contact */}
                <circle cx={hinge.x} cy={hinge.y} r={3.2} fill="#fbf9f3" stroke="#1a1813" strokeWidth={1} />
                {/* free contact */}
                <circle cx={cx - 18} cy={cy} r={3.2} fill="#fbf9f3" stroke="#1a1813" strokeWidth={1} />
                {/* lever */}
                <line
                  x1={hinge.x}
                  y1={hinge.y}
                  x2={freeEnd.x}
                  y2={freeEnd.y}
                  stroke={closed ? "#3aa867" : "#e8453b"}
                  strokeWidth={3.2}
                  strokeLinecap="round"
                />
                <text x={cx} y={cy + 22} fontSize={10} fontWeight={700} fill={closed ? "#3aa867" : "#e8453b"} textAnchor="middle">
                  {closed ? "YOPIQ" : "OCHIQ"}
                </text>
              </g>
            );
          })()}

          {/* Electrons (fireflies). Only render when switch closed. */}
          {closed && electronsRef.current.map((s, i) => {
            const p = pointOnLoop(s);
            return (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={3}
                fill="#e8a21a"
                opacity={0.95}
                filter="drop-shadow(0 0 3px rgba(232,162,26,0.9))"
              />
            );
          })}

          {/* Readout — top right */}
          <g transform={`translate(${VBW - 132}, 8)`}>
            <rect
              x={0}
              y={0}
              width={120}
              height={92}
              rx={8}
              fill="rgba(242, 239, 230, 0.85)"
              stroke="rgba(132, 126, 107, 0.45)"
              strokeWidth={1}
            />
            <text x={10} y={14} fontSize={9} fontWeight={700} fill="#1a1813" letterSpacing="0.04em">
              KUCHLANISH V
            </text>
            <text x={10} y={28} fontSize={12} fontWeight={700} fill="#1a1813" fontFamily="ui-monospace, monospace">
              {voltage.toFixed(1)} V
            </text>
            <text x={10} y={42} fontSize={9} fontWeight={700} fill="#1a1813" letterSpacing="0.04em">
              TOK KUCHI I
            </text>
            <text x={10} y={56} fontSize={12} fontWeight={700} fill="#a9760a" fontFamily="ui-monospace, monospace">
              {current.toFixed(2)} A
            </text>
            <text x={10} y={70} fontSize={9} fontWeight={700} fill="#1a1813" letterSpacing="0.04em">
              QUVVAT
            </text>
            <text x={10} y={84} fontSize={12} fontWeight={700} fill="#1a1813" fontFamily="ui-monospace, monospace">
              {power.toFixed(1)} W
            </text>
          </g>
        </svg>
      </div>

      {/* Switch button (visible action) */}
      <button
        type="button"
        onClick={toggleSwitch}
        className={`inline-flex h-[44px] w-full items-center justify-center gap-2 rounded-full px-6 text-[14px] font-semibold transition active:scale-[0.98] ${
          closed
            ? "border border-void-500 bg-void-700 text-void-100 hover:bg-void-600"
            : "bg-antares-500 text-void-100 hover:bg-antares-300"
        }`}
      >
        {closed ? "Kalitni ochish" : "Kalitni yopish"}
      </button>

      {/* Voltage slider */}
      <div className="rounded-[14px] border border-void-500 bg-void-700/60 p-3">
        <div className="flex items-baseline justify-between">
          <label htmlFor="cir-v" className="text-[12px] font-semibold text-void-200">
            Batareya kuchlanishi
          </label>
          <span className="font-mono text-[12px] text-void-300">
            {voltage.toFixed(1)} V
          </span>
        </div>
        <input
          id="cir-v"
          type="range"
          min={0}
          max={12}
          step={0.1}
          value={voltage}
          onChange={(e) => setVoltage(Number(e.target.value))}
          className="mt-2 w-full accent-antares-500"
        />
      </div>

      {/* Resistor slider */}
      <div className="rounded-[14px] border border-void-500 bg-void-700/60 p-3">
        <div className="flex items-baseline justify-between">
          <label htmlFor="cir-r" className="text-[12px] font-semibold text-void-200">
            Qarshilik (qo&apos;shimcha rezistor)
          </label>
          <span className="font-mono text-[12px] text-void-300">
            R = {rExt.toFixed(1)} Ω
          </span>
        </div>
        <input
          id="cir-r"
          type="range"
          min={0}
          max={20}
          step={0.2}
          value={rExt}
          onChange={(e) => setRExt(Number(e.target.value))}
          className="mt-2 w-full accent-antares-500"
        />
      </div>

      <p className="text-[12px] leading-relaxed text-void-300">
        Kalitni <span className="text-void-200">yopish</span> — elektronlar yo&apos;lga chiqadi,
        lampochka yonadi. Kuchlanishni oshiring — tok kuchayadi (I = V/R). Qarshilikni
        oshiring — tok kamayadi, lampochka so&apos;nadi. Ohm qonuni shu —
        <span className="text-void-200"> V = I · R</span>.
      </p>
    </div>
  );
}
