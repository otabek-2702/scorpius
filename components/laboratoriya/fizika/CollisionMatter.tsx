// components/laboratoriya/fizika/CollisionMatter.tsx
/**
 * CollisionMatter — Variant B: the library-powered renderer (matter-js@0.20).
 *
 * Same phenomenon as Variant A, but driven by matter-js's iterative constraint
 * solver instead of the analytic closed-form law. The point of the comparison:
 * matter-js resolves contacts with position/velocity bias (Baumgarte-style), so
 * its total momentum + KE DRIFT slightly frame-to-frame — visible in the same
 * live readout. That contrast (exact analytic vs iterative engine) is a feature.
 *
 * Everything is built inside a single useEffect against a ref div, with FULL
 * cleanup (Events.off, Render.stop, Runner.stop, Composite.clear, Engine.clear,
 * canvas.remove) because React 19 StrictMode double-mounts in dev.
 *
 * This component reads the same scenario inputs off the shared CollisionModel
 * (so the toggle is a true apples-to-apples compare) but runs its OWN engine —
 * it does NOT call model.step(). It reports live momentum/KE up via onReadout.
 */
"use client";

import { useEffect, useRef } from "react";
import Matter from "matter-js";
import {
  CollisionModel,
  TABLE_W,
  ballRadius,
  type ScenarioId,
} from "@/lib/sims/collision/Model";

// World units = metres × SCALE → px (matter-js works best at ~screen scale).
const VBW = 720;
const VBH = 320;
const PAD = 26;
const SCALE = (VBW - PAD * 2) / TABLE_W; // px per metre
const CENTER_Y = VBH * 0.5;

const ACCENT = "#2dd4bf";
const ACCENT_B = "#fbbf24";
const CRADLE = "#cbd5e1";

const toPx = (m: number) => PAD + m * SCALE;
const toPyUp = (m: number) => CENTER_Y - m * SCALE; // up positive → screen down

export interface MatterReadout {
  px: number;
  py: number;
  p: number;
  ke: number;
}

interface Props {
  model: CollisionModel;
  running: boolean;
  /** bump this number to force a re-arm (parent increments on scenario/slider/reset). */
  armToken: number;
  reduced: boolean;
  /** simulation-time multiplier (0.25 … 2) — scales the matter-js delta. */
  speed?: number;
  onReadout?: (r: MatterReadout) => void;
}

export function CollisionMatter({ model, running, armToken, reduced, speed = 1, onReadout }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const runningRef = useRef(running);
  const speedRef = useRef(speed);
  const onReadoutRef = useRef(onReadout);
  // Keep mutable refs in sync OUTSIDE render (StrictMode / refs-lint safe).
  useEffect(() => { runningRef.current = running; }, [running]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { onReadoutRef.current = onReadout; }, [onReadout]);

  // Rebuild the whole engine whenever the scenario/inputs change (armToken).
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const {
      Engine, Render, Runner, Bodies, Body, Composite, Events, World,
    } = Matter;

    const engine = Engine.create();
    engine.gravity.x = 0;
    engine.gravity.y = 0; // flat table — no gravity
    engine.positionIterations = 10;
    engine.velocityIterations = 10;

    const render = Render.create({
      element: host,
      engine,
      options: {
        width: VBW,
        height: VBH,
        wireframes: false,
        background: "#0b0f14",
        pixelRatio: typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1,
      },
    });

    const world = engine.world;
    const scenario = model.scenario.value as ScenarioId;
    const e = model.e.value;

    // ---- walls (thin static bounds so balls stay on the table) ----
    const wallOpts = { isStatic: true, render: { fillStyle: "#11161d" } };
    const wallT = 40;
    const walls = [
      Bodies.rectangle(VBW / 2, -wallT / 2 + 2, VBW, wallT, wallOpts),
      Bodies.rectangle(VBW / 2, VBH + wallT / 2 - 2, VBW, wallT, wallOpts),
      Bodies.rectangle(-wallT / 2 + 2, VBH / 2, wallT, VBH * 3, wallOpts),
      Bodies.rectangle(VBW + wallT / 2 - 2, VBH / 2, wallT, VBH * 3, wallOpts),
    ];
    Composite.add(world, walls);

    // track which bodies are our dynamic balls (for the readout)
    const dynamic: Matter.Body[] = [];

    function makeBall(
      xm: number, ym: number, m: number, color: string, label: string,
    ): Matter.Body {
      const rpx = ballRadius(m) * SCALE;
      const body = Bodies.circle(toPx(xm), toPyUp(ym), rpx, {
        restitution: e === 0 ? 0 : Math.max(0.001, e),
        friction: 0,
        frictionStatic: 0,
        frictionAir: 0, // frictionless table
        inertia: Infinity, // no spin — matches the no-rotation assumption
        // matter-js mass = density × area; set density so mass ≈ m (kg) for a
        // fair momentum/KE comparison with the analytic model.
        density: m / (Math.PI * rpx * rpx),
        label,
        render: { fillStyle: color, strokeStyle: "#06090d", lineWidth: 1.5 },
      });
      dynamic.push(body);
      return body;
    }

    // ---- build the scene to mirror the analytic model ----
    if (scenario === "newtons-cradle") {
      const n = 5;
      const m = 1;
      const rpx = ballRadius(m) * SCALE;
      const gap = rpx * 2;
      const startXpx = toPx(TABLE_W * 0.30);
      const pull = Math.max(1, Math.min(n, Math.round(model.cradlePull.value)));
      const u = model.u1.value;
      for (let i = 0; i < n; i++) {
        const moving = i < pull;
        const body = Bodies.circle(
          startXpx + i * gap - (moving ? rpx * 1.6 * (pull - i) : 0),
          CENTER_Y,
          rpx,
          {
            restitution: 1,
            friction: 0,
            frictionStatic: 0,
            frictionAir: 0,
            inertia: Infinity,
            density: m / (Math.PI * rpx * rpx),
            label: "cradle",
            render: { fillStyle: moving ? ACCENT : CRADLE, strokeStyle: "#06090d", lineWidth: 1.5 },
          },
        );
        dynamic.push(body);
        Composite.add(world, body);
        if (moving) Body.setVelocity(body, { x: u * SCALE * (1 / 60), y: 0 });
      }
    } else if (scenario === "2d-glancing") {
      const m1 = model.m1.value, m2 = model.m2.value;
      const b = Math.min(model.impactParam.value, ballRadius(m1) + ballRadius(m2));
      const a = makeBall(TABLE_W * 0.16, -b, m1, ACCENT, "A");
      const bBody = makeBall(TABLE_W * 0.60, 0, m2, ACCENT_B, "B");
      Composite.add(world, [a, bBody]);
      Body.setVelocity(a, { x: model.u1.value * SCALE * (1 / 60), y: 0 });
      Body.setVelocity(bBody, { x: 0, y: 0 });
    } else {
      // 1-D scenes: A → B
      const m1 = model.m1.value, m2 = model.m2.value;
      const a = makeBall(TABLE_W * 0.22, 0, m1, ACCENT, "A");
      const bBody = makeBall(TABLE_W * 0.62, 0, m2, ACCENT_B, "B");
      Composite.add(world, [a, bBody]);
      Body.setVelocity(a, { x: model.u1.value * SCALE * (1 / 60), y: 0 });
      Body.setVelocity(bBody, { x: model.u2.value * SCALE * (1 / 60), y: 0 });
    }

    // ---- collision flash (throttled per body) ----
    const lastFlash = new Map<number, number>();
    // Track every flash-restore timeout so we can clear any still-pending ones
    // on unmount (otherwise they fire against a torn-down render object).
    const flashTimeouts = new Set<number>();
    function onCollision(evt: Matter.IEventCollision<Matter.Engine>) {
      const now = performance.now();
      for (const pair of evt.pairs) {
        for (const body of [pair.bodyA, pair.bodyB]) {
          if (body.isStatic) continue;
          const t = lastFlash.get(body.id) ?? 0;
          if (now - t < 80) continue;
          lastFlash.set(body.id, now);
          // brief bright flash by lightening the render fill
          const r = body.render;
          const orig = r.fillStyle;
          r.fillStyle = "#eafffb";
          const id = window.setTimeout(() => {
            r.fillStyle = orig;
            flashTimeouts.delete(id);
          }, 90);
          flashTimeouts.add(id);
        }
      }
    }
    Events.on(engine, "collisionStart", onCollision);

    // ---- readout: compute live momentum/KE from the bodies each tick ----
    // velocities in matter-js are px/tick (≈ px/(1/60 s)); convert back to m/s.
    const VEL_TO_MS = 60 / SCALE; // (px/tick) → (m/s)
    function onAfterUpdate() {
      let px = 0, py = 0, ke = 0;
      for (const body of dynamic) {
        const m = body.mass; // ≈ kg (we set density to make this true)
        const vx = body.velocity.x * VEL_TO_MS;
        const vy = -body.velocity.y * VEL_TO_MS; // screen-down → up positive
        px += m * vx;
        py += m * vy;
        ke += 0.5 * m * (vx * vx + vy * vy);
      }
      onReadoutRef.current?.({ px, py, p: Math.hypot(px, py), ke });
    }
    Events.on(engine, "afterUpdate", onAfterUpdate);

    // ---- our own rAF runner so we can honour the parent's running flag ----
    const runner = Runner.create();
    Render.run(render);

    let rafId = 0;
    // A stable, normal-size integration step. Running N of these per frame makes
    // N× genuine (N normal steps per frame) instead of feeding the iterative
    // solver one larger clamped delta — which the old double-clamp (dt=elapsed·spd
    // then Engine.update(min(33,dt))) throttled "2×" back to barely over 1×.
    const STEP_MS = 1000 / 60; // ≈16.7 ms
    const loop = () => {
      if (runningRef.current) {
        const spd = Math.max(0.25, Math.min(2, speedRef.current));
        // N× = N normal sub-steps (each a normal size → no added instability),
        // capped so it stays stable. Under prefers-reduced-motion we hold to a
        // single normal step per frame (no speed-driven sub-stepping). Sub-1×
        // still runs one step (slower playback is not needed for matter-js
        // fidelity; the analytic variant carries that).
        const steps = reduced ? 1 : Math.max(1, Math.min(4, Math.round(spd)));
        for (let s = 0; s < steps; s++) Engine.update(engine, STEP_MS);
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    // ---- crisp re-fit: track the host's CSS width and set matter's pixelRatio
    // so the backing store ≈ measuredWidth × dpr (avoids CSS-upscale blur when
    // the stage grows on lg / in fullscreen). Re-applied on every resize. ----
    const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;
    let lastRatio = 0;
    const refit = () => {
      const w = host.getBoundingClientRect().width;
      if (w <= 0) return;
      const ratio = Math.max(1, Math.min(3, (w / VBW) * dpr));
      if (Math.abs(ratio - lastRatio) < 0.01) return;
      lastRatio = ratio;
      Render.setPixelRatio(render, ratio);
      // setPixelRatio rewrites canvas.style width/height in px; restore the
      // responsive CSS so the canvas keeps filling its column.
      const cv = render.canvas;
      if (cv) {
        cv.style.width = "100%";
        cv.style.height = "auto";
      }
    };
    refit();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(refit);
      ro.observe(host);
    }

    // initial readout so the bars render before play
    onAfterUpdate();

    // -------------------------------- FULL CLEANUP (StrictMode-safe) --------
    return () => {
      cancelAnimationFrame(rafId);
      // clear any pending flash-restore timeouts (they'd fire against a
      // torn-down render object otherwise).
      for (const id of flashTimeouts) window.clearTimeout(id);
      flashTimeouts.clear();
      ro?.disconnect();
      Events.off(engine, "collisionStart", onCollision);
      Events.off(engine, "afterUpdate", onAfterUpdate);
      Render.stop(render);
      Runner.stop(runner);
      Composite.clear(world, false);
      World.clear(world, false);
      Engine.clear(engine);
      render.canvas?.remove();
      // matter-js stashes large refs on the render object; clear the texture
      // cache so the GC can reclaim it on unmount. (canvas/context are removed
      // above; matter's own typings keep them non-null, so we leave them be.)
      render.textures = {};
    };
    // re-run on scenario change / re-arm. `reduced` is read via closure but
    // included so a preference change rebuilds the engine.
  }, [model, armToken, reduced]);

  return (
    <div
      ref={hostRef}
      className="block w-full overflow-hidden [&>canvas]:block [&>canvas]:w-full [&>canvas]:h-auto"
      style={{ aspectRatio: `${VBW} / ${VBH}` }}
      aria-hidden="true"
    />
  );
}
