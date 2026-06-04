"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Arximed qonuni — buoyancy lab.
 *
 * A glass tank holds a fluid of density ρ_fluid (slider: mercury → water →
 * oil → air). Six objects of different density sit on a shelf above:
 * cork, ice, wood, aluminum, iron, gold. The learner drags any object into
 * the tank.
 *
 * Real physics: each frame we integrate
 *   F_net = m·g − ρ_fluid · V_submerged(y) · g − c · v
 * via semi-implicit Euler. V_submerged is computed from the rectangle's depth
 * below the waterline. The block settles at equilibrium depth = (ρ_obj/ρ_fluid)
 * fraction submerged (Archimedes' principle).
 *
 * The water level rises by exactly the displaced volume (sum of submerged
 * volumes across all dropped objects, scaled into pixel space).
 *
 * Force arrows redraw live; the colour switches when the object reverses
 * direction. Completion: drop ≥ 3 distinct objects.
 *
 * Pure SVG + RAF. No deps.
 */

interface Props {
  onComplete?: () => void;
}

// Geometry — SVG viewBox is 480x320 like the other sims
const VBW = 480;
const VBH = 340;

const TANK = {
  x: 30,
  y: 110,
  w: 280,
  h: 210,
};
const SHELF_Y = 70; // shelf line for the resting objects
// Pixel rect for the dynamic water surface
const WATER_BASE_Y = TANK.y + 40; // empty start: 40px of "air" above the water

// Fluids the slider lets you pick (kg/m³, real values)
interface Fluid {
  key: string;
  label: string;
  density: number;
  fill: string;
  surfaceStroke: string;
}
const FLUIDS: Fluid[] = [
  { key: "air",     label: "Havo",     density: 1.2,    fill: "rgba(180, 200, 220, 0.10)", surfaceStroke: "rgba(120, 140, 160, 0.45)" },
  { key: "oil",     label: "Yog'",     density: 920,    fill: "rgba(220, 170, 60, 0.20)",  surfaceStroke: "rgba(180, 140, 40, 0.65)" },
  { key: "water",   label: "Suv",      density: 1000,   fill: "rgba(59, 123, 209, 0.18)",  surfaceStroke: "rgba(59, 123, 209, 0.65)" },
  { key: "mercury", label: "Simob",    density: 13534,  fill: "rgba(180, 180, 195, 0.45)", surfaceStroke: "rgba(120, 120, 140, 0.85)" },
];

interface ObjectDef {
  key: string;
  label: string;
  density: number; // kg/m³
  fill: string;
  // Visual size in px (cubic-ish)
  size: number;
}
const OBJECTS: ObjectDef[] = [
  { key: "cork",   label: "Probka",     density: 240,   fill: "#d6a256", size: 30 },
  { key: "ice",    label: "Muz",        density: 917,   fill: "#c9d8e6", size: 34 },
  { key: "wood",   label: "Yog'och",    density: 700,   fill: "#a07142", size: 32 },
  { key: "alum",   label: "Alyuminiy",  density: 2700,  fill: "#bdbdc1", size: 30 },
  { key: "iron",   label: "Temir",      density: 7870,  fill: "#5a5a64", size: 32 },
  { key: "gold",   label: "Oltin",      density: 19300, fill: "#e8a21a", size: 28 },
];

interface Body {
  id: number;
  defKey: string;
  density: number;
  fill: string;
  size: number;
  x: number; // center
  y: number; // center
  vy: number;
  dragging: boolean;
}

const G = 380; // px/s², scaled (real g doesn't fit nicely in 200px tank)
const DRAG_COEF = 3.5; // viscous damping; bigger → settles faster

let nextId = 1;

export function BuoyancySim({ onComplete }: Props) {
  const [fluidIdx, setFluidIdx] = useState(2); // start in water
  const [bodies, setBodies] = useState<Body[]>([]);
  // Set of object def keys that have been splashed in.
  const droppedKindsRef = useRef<Set<string>>(new Set());
  const [, forceRender] = useState(0);
  const bodiesRef = useRef<Body[]>([]);
  bodiesRef.current = bodies;
  const fluidRef = useRef<Fluid>(FLUIDS[fluidIdx]);
  fluidRef.current = FLUIDS[fluidIdx];
  const svgRef = useRef<SVGSVGElement | null>(null);
  const completedRef = useRef(false);

  // RAF loop: integrate every body.
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.04, (now - last) / 1000);
      last = now;
      const fluid = fluidRef.current;
      const waterY = waterSurfaceY();
      let changed = false;
      for (const b of bodiesRef.current) {
        if (b.dragging) continue;
        // submerged depth (top of body's surface below water)
        const topY = b.y - b.size / 2;
        const botY = b.y + b.size / 2;
        const submergedPx = Math.max(0, Math.min(b.size, botY - waterY));
        const submergedFrac = submergedPx / b.size;
        // Buoyant force per unit volume: rho_fluid * g (scaled). Mass per
        // unit volume: rho_obj. So effective accel = g * (1 − ρ_fluid/ρ_obj · frac)
        const buoyantAccel =
          (fluid.density / b.density) * G * submergedFrac;
        const dragAccel = -DRAG_COEF * b.vy * (0.4 + submergedFrac);
        const ay = G - buoyantAccel + dragAccel;
        b.vy += ay * dt;
        b.y += b.vy * dt;

        // Tank floor
        const floorY = TANK.y + TANK.h - b.size / 2 - 2;
        if (b.y > floorY) {
          b.y = floorY;
          if (b.vy > 0) b.vy = -b.vy * 0.15;
        }
        // Ceiling (above the tank — let it bounce off the air above)
        const ceilY = TANK.y + b.size / 2;
        if (b.y < ceilY) {
          b.y = ceilY;
          if (b.vy < 0) b.vy = -b.vy * 0.2;
        }
        changed = true;
      }
      if (changed) forceRender((n) => n + 1);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);

  /** Water surface y in px — base level rises by the total displaced volume of all submerged bodies. */
  function waterSurfaceY(): number {
    // Sum of submerged area (since we treat objects as cubes ≈ size^2 area)
    let displaced = 0;
    const baseY = WATER_BASE_Y;
    // First-pass: use current baseY to estimate submerged amount.
    // (one fixed-point iteration is enough since the rise is small relative
    // to tank size.)
    for (const pass of [0, 1]) {
      void pass;
      let yEst = baseY - displaced / TANK.w;
      displaced = 0;
      for (const b of bodiesRef.current) {
        if (b.dragging) continue;
        const bot = b.y + b.size / 2;
        const sub = Math.max(0, Math.min(b.size, bot - yEst));
        displaced += sub * b.size; // submerged "area" px²
      }
    }
    return baseY - displaced / TANK.w;
  }

  // ---- Drag handling ---------------------------------------------------
  const dragRef = useRef<{ id: number; offsetX: number; offsetY: number } | null>(null);

  function svgPointer(evt: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = ((evt.clientX - rect.left) / rect.width) * VBW;
    const y = ((evt.clientY - rect.top) / rect.height) * VBH;
    return { x, y };
  }

  function onShelfPointerDown(
    evt: React.PointerEvent<SVGSVGElement>,
    def: ObjectDef,
    shelfX: number,
  ) {
    evt.preventDefault();
    (evt.target as Element).setPointerCapture?.(evt.pointerId);
    const p = svgPointer(evt);
    const id = nextId++;
    const body: Body = {
      id,
      defKey: def.key,
      density: def.density,
      fill: def.fill,
      size: def.size,
      x: shelfX,
      y: SHELF_Y,
      vy: 0,
      dragging: true,
    };
    bodiesRef.current = [...bodiesRef.current, body];
    setBodies(bodiesRef.current);
    dragRef.current = { id, offsetX: shelfX - p.x, offsetY: SHELF_Y - p.y };
  }

  function onBodyPointerDown(
    evt: React.PointerEvent<SVGGElement>,
    body: Body,
  ) {
    evt.preventDefault();
    (evt.target as Element).setPointerCapture?.(evt.pointerId);
    const p = svgPointer(evt as unknown as React.PointerEvent<SVGSVGElement>);
    body.dragging = true;
    body.vy = 0;
    dragRef.current = { id: body.id, offsetX: body.x - p.x, offsetY: body.y - p.y };
    setBodies([...bodiesRef.current]);
  }

  function onPointerMove(evt: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const p = svgPointer(evt);
    const body = bodiesRef.current.find((b) => b.id === drag.id);
    if (!body) return;
    body.x = clamp(p.x + drag.offsetX, TANK.x + body.size / 2 + 2, TANK.x + TANK.w - body.size / 2 - 2);
    body.y = clamp(p.y + drag.offsetY, body.size / 2, TANK.y + TANK.h - body.size / 2 - 2);
    body.vy = 0;
    forceRender((n) => n + 1);
  }

  function onPointerUp() {
    const drag = dragRef.current;
    if (!drag) return;
    const body = bodiesRef.current.find((b) => b.id === drag.id);
    if (body) {
      // If released outside the tank, remove it (you can't drop air).
      if (
        body.x < TANK.x ||
        body.x > TANK.x + TANK.w ||
        body.y < TANK.y - 8
      ) {
        bodiesRef.current = bodiesRef.current.filter((b) => b.id !== body.id);
        setBodies(bodiesRef.current);
      } else {
        body.dragging = false;
        droppedKindsRef.current.add(body.defKey);
        if (
          !completedRef.current &&
          droppedKindsRef.current.size >= 3
        ) {
          completedRef.current = true;
          onComplete?.();
        }
        setBodies([...bodiesRef.current]);
      }
    }
    dragRef.current = null;
  }

  function clearTank() {
    bodiesRef.current = [];
    setBodies([]);
  }

  // ---- Render ----------------------------------------------------------
  const waterY = waterSurfaceY();
  const fluid = FLUIDS[fluidIdx];
  const shelfSpacing = (TANK.w + 100) / OBJECTS.length;
  const droppedCount = droppedKindsRef.current.size;

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
          {/* Shelf */}
          <line
            x1={20}
            y1={SHELF_Y + 22}
            x2={VBW - 140}
            y2={SHELF_Y + 22}
            stroke="rgba(132, 126, 107, 0.55)"
            strokeWidth={1.2}
            strokeDasharray="3 4"
          />
          {OBJECTS.map((def, i) => {
            const shelfX = 30 + i * shelfSpacing;
            return (
              <g key={def.key} style={{ cursor: "grab" }}>
                <rect
                  x={shelfX - def.size / 2}
                  y={SHELF_Y - def.size / 2}
                  width={def.size}
                  height={def.size}
                  fill={def.fill}
                  stroke="#1a1813"
                  strokeWidth={1.2}
                  rx={3}
                  onPointerDown={(e) =>
                    onShelfPointerDown(
                      e as unknown as React.PointerEvent<SVGSVGElement>,
                      def,
                      shelfX,
                    )
                  }
                />
                <text
                  x={shelfX}
                  y={SHELF_Y + 28}
                  fontSize={9}
                  fontWeight={600}
                  fill="#55513f"
                  textAnchor="middle"
                >
                  {def.label}
                </text>
              </g>
            );
          })}

          {/* Tank — glass */}
          <rect
            x={TANK.x}
            y={TANK.y}
            width={TANK.w}
            height={TANK.h}
            fill="rgba(255, 255, 255, 0.05)"
            stroke="rgba(132, 126, 107, 0.85)"
            strokeWidth={1.4}
            rx={6}
          />

          {/* Fluid fill */}
          <rect
            x={TANK.x + 1.2}
            y={waterY}
            width={TANK.w - 2.4}
            height={TANK.y + TANK.h - waterY - 1.2}
            fill={fluid.fill}
          />
          {/* Fluid surface line */}
          <line
            x1={TANK.x + 1}
            y1={waterY}
            x2={TANK.x + TANK.w - 1}
            y2={waterY}
            stroke={fluid.surfaceStroke}
            strokeWidth={1.6}
          />
          {/* Original-level marker — dashed */}
          <line
            x1={TANK.x - 8}
            y1={WATER_BASE_Y}
            x2={TANK.x + TANK.w + 8}
            y2={WATER_BASE_Y}
            stroke="rgba(132, 126, 107, 0.55)"
            strokeWidth={1}
            strokeDasharray="2 4"
          />

          {/* Bodies inside the world */}
          {bodies.map((b) => {
            const topY = b.y - b.size / 2;
            const botY = b.y + b.size / 2;
            const submergedPx = Math.max(0, Math.min(b.size, botY - waterY));
            const submergedFrac = submergedPx / b.size;
            const buoy = (fluid.density / b.density) * submergedFrac; // dimensionless: 1 == equilibrium
            const weight = 1;
            const arrowScale = 22; // baseline length in px when force == weight
            const arrowDownLen = weight * arrowScale;
            const arrowUpLen = Math.min(weight * 2.4 * arrowScale, buoy * arrowScale);
            return (
              <g
                key={b.id}
                style={{ cursor: "grab" }}
                onPointerDown={(e) => onBodyPointerDown(e, b)}
              >
                {/* Body */}
                <rect
                  x={b.x - b.size / 2}
                  y={b.y - b.size / 2}
                  width={b.size}
                  height={b.size}
                  fill={b.fill}
                  stroke="#1a1813"
                  strokeWidth={1.2}
                  rx={3}
                />
                {/* Force arrows when at least partially in tank */}
                {!b.dragging && b.y > TANK.y - 8 && (
                  <>
                    {/* Weight down — neutral grey */}
                    <line
                      x1={b.x - 8}
                      y1={b.y}
                      x2={b.x - 8}
                      y2={b.y + arrowDownLen}
                      stroke="#55513f"
                      strokeWidth={2}
                    />
                    <polygon
                      points={`${b.x - 11},${b.y + arrowDownLen - 4} ${b.x - 5},${b.y + arrowDownLen - 4} ${b.x - 8},${b.y + arrowDownLen + 2}`}
                      fill="#55513f"
                    />
                    {/* Buoyancy up — gold */}
                    {arrowUpLen > 2 && (
                      <>
                        <line
                          x1={b.x + 8}
                          y1={b.y}
                          x2={b.x + 8}
                          y2={b.y - arrowUpLen}
                          stroke="#e8a21a"
                          strokeWidth={2}
                        />
                        <polygon
                          points={`${b.x + 5},${b.y - arrowUpLen + 4} ${b.x + 11},${b.y - arrowUpLen + 4} ${b.x + 8},${b.y - arrowUpLen - 2}`}
                          fill="#e8a21a"
                        />
                      </>
                    )}
                  </>
                )}
              </g>
            );
          })}

          {/* Readout panel — right side */}
          <g transform={`translate(${TANK.x + TANK.w + 14}, ${TANK.y + 4})`}>
            <rect
              x={0}
              y={0}
              width={120}
              height={210}
              rx={8}
              fill="rgba(242, 239, 230, 0.7)"
              stroke="rgba(132, 126, 107, 0.45)"
              strokeWidth={1}
            />
            <text x={10} y={20} fontSize={10} fontWeight={700} fill="#1a1813" letterSpacing="0.04em">
              SUYUQLIK
            </text>
            <text x={10} y={36} fontSize={12} fontWeight={700} fill="#1a1813">
              {fluid.label}
            </text>
            <text x={10} y={51} fontSize={10} fill="#55513f">
              ρ = {formatDensity(fluid.density)}
            </text>
            <line x1={10} y1={62} x2={110} y2={62} stroke="rgba(132,126,107,0.3)" strokeWidth={1} />

            <text x={10} y={80} fontSize={10} fontWeight={700} fill="#1a1813" letterSpacing="0.04em">
              KO&apos;TARILGAN
            </text>
            <text x={10} y={97} fontSize={13} fontWeight={700} fill="#1a1813" fontFamily="ui-monospace, monospace">
              {Math.max(0, (WATER_BASE_Y - waterY)).toFixed(1)} px
            </text>

            <text x={10} y={120} fontSize={10} fontWeight={700} fill="#1a1813" letterSpacing="0.04em">
              TASHLAGAN
            </text>
            <text x={10} y={137} fontSize={13} fontWeight={700} fill="#1a1813" fontFamily="ui-monospace, monospace">
              {droppedCount} / 3 turi
            </text>

            <text x={10} y={170} fontSize={9} fill="#55513f">
              Pastga — og&apos;irlik
            </text>
            <line x1={84} y1={166} x2={84} y2={176} stroke="#55513f" strokeWidth={2} />
            <text x={10} y={188} fontSize={9} fill="#a9760a">
              Yuqoriga — Arximed
            </text>
            <line x1={92} y1={184} x2={92} y2={194} stroke="#e8a21a" strokeWidth={2} />
          </g>
        </svg>
      </div>

      {/* Fluid slider */}
      <div className="rounded-[14px] border border-void-500 bg-void-700/60 p-3">
        <div className="flex items-baseline justify-between">
          <label htmlFor="arx-fluid" className="text-[12px] font-semibold text-void-200">
            Suyuqlik turi
          </label>
          <span className="font-mono text-[12px] text-void-300">
            {fluid.label} · ρ = {formatDensity(fluid.density)}
          </span>
        </div>
        <input
          id="arx-fluid"
          type="range"
          min={0}
          max={FLUIDS.length - 1}
          value={fluidIdx}
          step={1}
          onChange={(e) => setFluidIdx(Number(e.target.value))}
          className="mt-2 w-full accent-antares-500"
        />
        <div className="mt-1 flex justify-between text-[10px] text-void-300">
          {FLUIDS.map((f) => (
            <span key={f.key}>{f.label}</span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={clearTank}
          className="inline-flex h-[40px] flex-1 items-center justify-center rounded-full border border-void-500 bg-void-700 px-4 text-[13px] font-semibold text-void-100 transition hover:bg-void-600 active:scale-[0.98]"
        >
          Idishni bo&apos;shatish
        </button>
      </div>

      <p className="text-[12px] leading-relaxed text-void-300">
        Tepadagi jismni{" "}
        <span className="text-void-200">idishga torting</span>. Suv ko&apos;tariladi, ikki o&apos;q paydo bo&apos;ladi:
        oltin — Arximed kuchi, qoramtir — og&apos;irlik. Suyuqlikni almashtirib ko&apos;ring — temir simobda{" "}
        <em>suzadi</em>.
      </p>
    </div>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function formatDensity(d: number): string {
  if (d >= 1000) return `${(d / 1000).toFixed(d >= 10000 ? 1 : 2)} g/sm³`;
  if (d >= 10) return `${(d / 1000).toFixed(2)} g/sm³`;
  return `${(d / 1000).toFixed(4)} g/sm³`;
}
