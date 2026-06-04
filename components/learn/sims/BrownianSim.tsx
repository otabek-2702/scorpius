"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Broun harakati va diffuziya — Brownian motion sim.
 *
 * Real microphysics: ~200 invisible water molecules bounce inside a circular
 * dish under elastic wall collisions. A single large pollen grain receives
 * impulsive kicks whenever a molecule contacts it (impulse on the grain
 * proportional to molecule speed, inversely to grain mass — Langevin-style).
 * The grain's centre-of-mass path is drawn as a fading gold trail so the
 * learner SEES the zig-zag they could never see in a textbook.
 *
 * Manipulable knobs:
 *   • Temperature slider — scales molecule RMS speed (kinetic temperature).
 *   • "Ko'rinmas/Ko'rinadigan" toggle — reveals the invisible molecules.
 *   • Reset — re-seeds the molecule swarm.
 *
 * Completion fires after ~6 seconds of observation (real, integrated time).
 * Pure Canvas2D + requestAnimationFrame. No deps.
 */

interface Props {
  onComplete?: () => void;
}

const CANVAS_W = 480;
const CANVAS_H = 320;
const DISH_R = 140;
const DISH_CX = CANVAS_W / 2;
const DISH_CY = CANVAS_H / 2;
const MOL_COUNT = 180;
const MOL_R = 1.6;
const GRAIN_R = 9;
// Grain "mass" relative to a molecule: heavier means kicks are smaller.
const GRAIN_MASS = 24;
// Trail buffer length — short enough to feel "live", long enough to read shape.
const TRAIL_LEN = 220;

interface Mol {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Grain {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function seedMolecules(speed: number): Mol[] {
  const out: Mol[] = [];
  for (let i = 0; i < MOL_COUNT; i++) {
    // Uniform within disk
    const r = Math.sqrt(Math.random()) * (DISH_R - MOL_R - 2);
    const ang = Math.random() * Math.PI * 2;
    const dir = Math.random() * Math.PI * 2;
    out.push({
      x: DISH_CX + r * Math.cos(ang),
      y: DISH_CY + r * Math.sin(ang),
      vx: Math.cos(dir) * speed,
      vy: Math.sin(dir) * speed,
    });
  }
  return out;
}

function newGrain(): Grain {
  return { x: DISH_CX, y: DISH_CY, vx: 0, vy: 0 };
}

export function BrownianSim({ onComplete }: Props) {
  // Temperature in arbitrary units, mapped to molecule speed in px/s.
  const [temp, setTemp] = useState<number>(50);
  const [visible, setVisible] = useState<boolean>(false);
  const [observedMs, setObservedMs] = useState<number>(0);
  const [rms, setRms] = useState<number>(0);
  const completedRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const molsRef = useRef<Mol[]>([]);
  const grainRef = useRef<Grain>(newGrain());
  const trailRef = useRef<Array<{ x: number; y: number }>>([]);
  const tempRef = useRef<number>(temp);
  const visibleRef = useRef<boolean>(visible);
  const startTimeRef = useRef<number>(0);

  tempRef.current = temp;
  visibleRef.current = visible;

  // Translate slider 0..100 to a physical-feeling speed in px/s.
  function tempToSpeed(t: number): number {
    return 30 + t * 1.6; // 30..190 px/s
  }

  // Seed once on mount.
  useEffect(() => {
    molsRef.current = seedMolecules(tempToSpeed(temp));
    grainRef.current = newGrain();
    trailRef.current = [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the user changes temperature, rescale existing molecule velocities
  // (don't reseed — that would feel jumpy).
  useEffect(() => {
    const target = tempToSpeed(temp);
    const mols = molsRef.current;
    for (const m of mols) {
      const s = Math.hypot(m.vx, m.vy) || 1;
      m.vx = (m.vx / s) * target;
      m.vy = (m.vy / s) * target;
    }
  }, [temp]);

  // Main physics + render loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let last = performance.now();
    startTimeRef.current = last;

    const step = (now: number) => {
      const dt = Math.min(0.04, (now - last) / 1000);
      last = now;

      const mols = molsRef.current;
      const grain = grainRef.current;

      // ---- Molecule physics: linear motion + circular-wall elastic bounce
      for (const m of mols) {
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        const dx = m.x - DISH_CX;
        const dy = m.y - DISH_CY;
        const r = Math.hypot(dx, dy);
        const maxR = DISH_R - MOL_R - 1;
        if (r > maxR) {
          // Reflect velocity about the inward normal
          const nx = dx / r;
          const ny = dy / r;
          const vn = m.vx * nx + m.vy * ny;
          m.vx -= 2 * vn * nx;
          m.vy -= 2 * vn * ny;
          // Pull back inside
          m.x = DISH_CX + nx * maxR;
          m.y = DISH_CY + ny * maxR;
        }
      }

      // ---- Grain physics: receive impulses from molecules within radius.
      // We process collisions: if a mol touches the grain, both bounce off
      // (treating grain as much more massive). Net impulse on grain ~ v_mol / M.
      let kickFx = 0;
      let kickFy = 0;
      const colR = GRAIN_R + MOL_R;
      for (const m of mols) {
        const dx = m.x - grain.x;
        const dy = m.y - grain.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < colR * colR) {
          const d = Math.sqrt(d2) || 1;
          const nx = dx / d;
          const ny = dy / d;
          const vRel = (m.vx - grain.vx) * nx + (m.vy - grain.vy) * ny;
          if (vRel < 0) {
            // Reflect molecule (heavy grain ~ wall)
            m.vx -= 2 * vRel * nx;
            m.vy -= 2 * vRel * ny;
            // Tiny impulse on the grain in -n direction (Newton's third law)
            const impulse = (-2 * vRel) / GRAIN_MASS;
            kickFx += impulse * nx;
            kickFy += impulse * ny;
            // Push molecule out so it doesn't re-collide
            m.x = grain.x + nx * (colR + 0.5);
            m.y = grain.y + ny * (colR + 0.5);
          }
        }
      }
      grain.vx += kickFx;
      grain.vy += kickFy;
      // Gentle drag so the grain doesn't run away (Langevin viscosity)
      const drag = Math.exp(-2.4 * dt);
      grain.vx *= drag;
      grain.vy *= drag;

      grain.x += grain.vx * dt;
      grain.y += grain.vy * dt;

      // Soft confinement: keep the grain inside the dish
      {
        const dx = grain.x - DISH_CX;
        const dy = grain.y - DISH_CY;
        const r = Math.hypot(dx, dy);
        const maxR = DISH_R - GRAIN_R - 2;
        if (r > maxR) {
          const nx = dx / r;
          const ny = dy / r;
          const vn = grain.vx * nx + grain.vy * ny;
          grain.vx -= 2 * vn * nx;
          grain.vy -= 2 * vn * ny;
          grain.x = DISH_CX + nx * maxR;
          grain.y = DISH_CY + ny * maxR;
        }
      }

      // Trail
      const trail = trailRef.current;
      trail.push({ x: grain.x, y: grain.y });
      if (trail.length > TRAIL_LEN) trail.shift();

      // Stats: RMS displacement from dish centre (Einstein's diffusion signature).
      const dxg = grain.x - DISH_CX;
      const dyg = grain.y - DISH_CY;
      setRms(Math.hypot(dxg, dyg));
      const obs = now - startTimeRef.current;
      setObservedMs(obs);
      if (!completedRef.current && obs > 6000) {
        completedRef.current = true;
        onComplete?.();
      }

      // ---- Render
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // Dish (a watery puddle)
      ctx.beginPath();
      ctx.arc(DISH_CX, DISH_CY, DISH_R, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(232, 162, 26, 0.04)";
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = "rgba(132, 126, 107, 0.55)"; // void-300 ish
      ctx.setLineDash([2, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Molecules (only when toggled)
      if (visibleRef.current) {
        ctx.fillStyle = "rgba(59, 123, 209, 0.55)"; // subject-math blue
        for (const m of mols) {
          ctx.beginPath();
          ctx.arc(m.x, m.y, MOL_R, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Trail (fading gold)
      if (trail.length > 1) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        for (let i = 1; i < trail.length; i++) {
          const a = i / trail.length;
          ctx.strokeStyle = `rgba(232, 162, 26, ${0.05 + a * 0.55})`;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
          ctx.lineTo(trail[i].x, trail[i].y);
          ctx.stroke();
        }
      }

      // Grain
      ctx.beginPath();
      ctx.arc(grain.x, grain.y, GRAIN_R, 0, Math.PI * 2);
      ctx.fillStyle = "#e8a21a";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#fbf9f3";
      ctx.stroke();

      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [onComplete]);

  function reset() {
    molsRef.current = seedMolecules(tempToSpeed(temp));
    grainRef.current = newGrain();
    trailRef.current = [];
    startTimeRef.current = performance.now();
    completedRef.current = false;
    setObservedMs(0);
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="overflow-hidden rounded-[18px] border border-void-500 bg-void-700/40">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="block w-full"
          style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
        />
      </div>

      {/* Live readouts */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-[12px] border border-void-500 bg-void-700 px-3 py-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-void-300">
            Harorat
          </div>
          <div className="mt-1 font-mono text-[15px] font-semibold tabular-nums text-void-100">
            {temp}°
          </div>
        </div>
        <div className="rounded-[12px] border border-void-500 bg-void-700 px-3 py-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-void-300">
            Markazdan masofa
          </div>
          <div className="mt-1 font-mono text-[15px] font-semibold tabular-nums text-void-100">
            {rms.toFixed(1)} px
          </div>
        </div>
      </div>

      {/* Temperature slider */}
      <div className="rounded-[14px] border border-void-500 bg-void-700/60 p-3">
        <div className="flex items-baseline justify-between">
          <label
            htmlFor="brown-temp"
            className="text-[12px] font-semibold text-void-200"
          >
            Suvni qizdirish
          </label>
          <span className="font-mono text-[12px] text-void-300">
            sovuq → issiq
          </span>
        </div>
        <input
          id="brown-temp"
          type="range"
          min={5}
          max={100}
          value={temp}
          onChange={(e) => setTemp(Number(e.target.value))}
          className="mt-2 w-full accent-antares-500"
        />
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className={`inline-flex h-[40px] flex-1 items-center justify-center rounded-full px-4 text-[13px] font-semibold transition active:scale-[0.98] ${
            visible
              ? "bg-antares-500 text-void-100 hover:bg-antares-300"
              : "border border-void-500 bg-void-700 text-void-100 hover:bg-void-600"
          }`}
        >
          {visible ? "Molekulalarni yashirish" : "Molekulalarni ko'rsatish"}
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-[40px] items-center justify-center rounded-full border border-void-500 bg-void-700 px-4 text-[13px] font-semibold text-void-100 transition hover:bg-void-600 active:scale-[0.98]"
        >
          Qaytadan
        </button>
      </div>

      <p className="text-[12px] leading-relaxed text-void-300">
        Oltin nuqta — gulchang. Uni{" "}
        <span className="text-void-200">hech kim ko&apos;rinmas qo&apos;l bilan turtmaydi</span>{" "}
        — uni minglab issiq suv molekulalari urib turibdi. Haroratni oshiring va izga qarang.
        {observedMs >= 6000 && (
          <span className="ml-1 font-semibold text-signal-correct">
            Yo&apos;l zig-zag — bu Broun harakati.
          </span>
        )}
      </p>
    </div>
  );
}
