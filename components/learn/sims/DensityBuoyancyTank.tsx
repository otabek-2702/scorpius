// components/learn/sims/DensityBuoyancyTank.tsx
/**
 * DensityBuoyancyTank — a physically-real, beautifully-rendered buoyancy lab.
 *
 * The learner picks a material (and a block SIZE), a solid block FALLS from
 * above into a glass tank, SPLASHES through the living water surface, bobs, and
 * settles to true Archimedes equilibrium — floating at exactly ρ_block/ρ_water
 * submerged, or resting on the floor. Oil pours into a floating liquid layer.
 * Force vectors (weight ↓, buoyancy ↑) are drawn to a single true px-per-Newton
 * scale and labelled with their values; the waterline rises by exactly the
 * displaced volume and the rise is reported in cm.
 *
 * Architecture (read AGENTS.md): DensityBuoyancyModel owns all physics + state
 * as Property<T>; this view subscribes via useProperty() and only paints. A
 * single rAF loop drives model.step(dt) on the model clock — no CSS tween
 * pretends to be physics. Reduced-motion → blocks snap to equilibrium.
 *
 * Material realism is faked with SVG: feTurbulence wood grain, layered linear
 * gradients for metallic sheen + specular highlights, translucency + inner
 * refraction band for ice, flat low-key fills for matte rubber. The tank is
 * real glass (thick walls, top ellipse, edge highlights, floor reflection); the
 * water has a meniscus, an animated surface wave, and depth shading.
 *
 * See lib/sims/density-buoyancy/model.md for the equations + integration.
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useProperty } from "@/lib/sim/observable/useProperty";
import {
  DensityBuoyancyModel,
  DEFAULT_MATERIALS,
  SIZE_SIDES,
  TANK_M,
  PHYS,
  type Block,
  type BlockSizePreset,
} from "@/lib/sims/density-buoyancy/Model";
import type { DensityBuoyancyConfig, MaterialBlock } from "@/lib/sim/types";
import type { SimProps } from "./index";

// ---- SVG viewport + metre→pixel mapping ------------------------------------
const VBW = 460;
const VBH = 380;
const PAD_X = 46;
const PAD_TOP = 44;
const PAD_BOTTOM = 26;
const PLOT_W = VBW - PAD_X * 2;
const PLOT_H = VBH - PAD_TOP - PAD_BOTTOM;
const PX_PER_M = Math.min(PLOT_W / TANK_M.width, PLOT_H / (TANK_M.height + 0.16));

const FLOOR_PX = PAD_TOP + PLOT_H; // y of tank floor in SVG (down = +)
const TANK_W_PX = TANK_M.width * PX_PER_M;
const TANK_H_PX = TANK_M.height * PX_PER_M;
const TANK_LEFT = (VBW - TANK_W_PX) / 2;
const TANK_RIGHT = TANK_LEFT + TANK_W_PX;
const TANK_TOP_PX = FLOOR_PX - TANK_H_PX;
const WALL = 7; // glass wall thickness (px)
const RIM_RY = 7; // ellipse half-height for the tank top opening

/** metres-above-floor → SVG y (down positive). */
const toY = (m: number) => FLOOR_PX - m * PX_PER_M;
/** metres-from-left-wall → SVG x. */
const toX = (m: number) => TANK_LEFT + m * PX_PER_M;
/** metres of edge → px. */
const mToPx = (m: number) => m * PX_PER_M;

// True force scale: pick px-per-Newton so a reference 10 cm wood block's weight
// (≈ 4.9 N) reads ~46 px. BOTH arrows use this same scale, so on a floating
// block the weight and buoyancy arrows are visibly equal — matching the readout.
const PX_PER_N = 46 / (0.5 * 1000 * PHYS.blockVolume(0.1) * PHYS.G);
const MAX_ARROW = 96; // clamp so gold's huge weight stays on-canvas (labelled w/ true N)

const COMPLETE_AT = 3;

const SIZE_LABELS: { key: BlockSizePreset; uz: string; cm: string }[] = [
  { key: "small", uz: "Kichik", cm: "6 sm" },
  { key: "medium", uz: "Oʻrtacha", cm: "10 sm" },
  { key: "large", uz: "Katta", cm: "15 sm" },
];

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Visual family for a material (explicit `look`, else inferred from id). */
function lookOf(m: MaterialBlock): NonNullable<MaterialBlock["look"]> {
  if (m.look) return m.look;
  if (m.id === "wood") return "wood";
  if (m.id === "ice") return "ice";
  if (m.id === "gold") return "gold";
  if (m.id === "rubber") return "matte";
  return "metal";
}

export function DensityBuoyancyTank({ config: rawConfig, onComplete }: SimProps) {
  const config = rawConfig as DensityBuoyancyConfig | undefined;
  const model = useMemo(() => new DensityBuoyancyModel(), []);
  const reduced = useMemo(prefersReducedMotion, []);

  const blocks = useProperty(model.blocks);
  const waterHeight = useProperty(model.waterHeight);
  const oilHeight = useProperty(model.oilHeight);
  const splashes = useProperty(model.splashes);
  const interactions = useProperty(model.interactionCount);
  const sizePreset = useProperty(model.sizePreset);

  const [dragMat, setDragMat] = useState<string | null>(null);
  const [hoverDrop, setHoverDrop] = useState(false);
  // A monotonically increasing clock the wave + splashes animate against.
  const [animClock, setAnimClock] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // rAF loop drives model.step(dt) on the model clock. Reduced motion → snap.
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      model.step(dt);
      setAnimClock(now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [model, reduced]);

  useEffect(() => () => model.dispose(), [model]);

  // Report EACH interaction up to the host (ExploreSandboxCard counts these
  // against its own minInteractions). Firing only once at COMPLETE_AT would
  // mean the card never reaches its threshold — the learner would have to drop
  // ~3× as many blocks to advance. One signal per drop keeps the contract sane.
  useEffect(() => {
    if (interactions > 0) onCompleteRef.current?.();
  }, [interactions]);

  const materials: MaterialBlock[] = config?.materials ?? DEFAULT_MATERIALS;

  function spawn(mat: MaterialBlock) {
    model.drop(mat);
    if (reduced) {
      for (let i = 0; i < 800; i++) model.step(1 / 120);
      setAnimClock((c) => c + 1);
    }
  }

  const waterTopPx = toY(waterHeight);
  const oilPx = mToPx(oilHeight);
  const restTopPx = toY(TANK_M.waterRest);
  const riseCm = model.levelRise() * 100;
  const lastBlock = blocks.length ? blocks[blocks.length - 1] : null;

  // Gentle surface wave offset (px) — purely cosmetic, drawn into the path.
  const t = animClock / 1000;

  return (
    <div className="flex w-full flex-col gap-3">
      <div
        className={`overflow-hidden rounded-[18px] border bg-gradient-to-b from-[#f3f8fb] to-[#e9f1f6] transition-colors ${
          hoverDrop ? "border-antares-500 ring-2 ring-antares-300/50" : "border-void-500"
        }`}
        onDragOver={(e) => {
          if (dragMat) {
            e.preventDefault();
            setHoverDrop(true);
          }
        }}
        onDragLeave={() => setHoverDrop(false)}
        onDrop={(e) => {
          e.preventDefault();
          setHoverDrop(false);
          const m = materials.find((x) => x.id === dragMat);
          if (m) spawn(m);
          setDragMat(null);
        }}
      >
        <svg
          viewBox={`0 0 ${VBW} ${VBH}`}
          className="block w-full"
          role="img"
          aria-label="Suzadimi yoki choʻkadimi — sinab koʻradigan laboratoriya"
        >
          <SvgDefs />

          {/* ---- soft floor reflection / shadow under the tank ---- */}
          <ellipse
            cx={(TANK_LEFT + TANK_RIGHT) / 2}
            cy={FLOOR_PX + 12}
            rx={TANK_W_PX / 2 + 8}
            ry={9}
            fill="#1a1813"
            opacity={0.07}
          />

          {/* ---- glass back wall (subtle tint, drawn behind water) ---- */}
          <rect
            x={TANK_LEFT}
            y={TANK_TOP_PX}
            width={TANK_W_PX}
            height={TANK_H_PX}
            rx={6}
            fill="url(#db-glass-body)"
          />

          {/* ================= WATER ================= */}
          <Water waterTopPx={waterTopPx} t={t} reduced={reduced} />

          {/* ---- floating oil layer (immiscible, sits on the surface) ---- */}
          {oilPx > 0.5 && (
            <g>
              <rect
                x={TANK_LEFT + 1}
                y={waterTopPx - oilPx}
                width={TANK_W_PX - 2}
                height={oilPx}
                fill="url(#db-oil)"
                opacity={0.92}
              />
              <line
                x1={TANK_LEFT + 1}
                y1={waterTopPx - oilPx}
                x2={TANK_RIGHT - 1}
                y2={waterTopPx - oilPx}
                stroke="#caa636"
                strokeWidth={1.5}
                opacity={0.8}
              />
              <text
                x={TANK_LEFT + 8}
                y={waterTopPx - oilPx / 2 + 3}
                fontSize={9.5}
                fontWeight={600}
                fill="#7a5e0c"
              >
                moy qatlami
              </text>
            </g>
          )}

          {/* ---- rest-level reference (dashed) — shows how much the level rose ---- */}
          {riseCm > 0.05 && (
            <>
              <line
                x1={TANK_LEFT}
                y1={restTopPx}
                x2={TANK_RIGHT}
                y2={restTopPx}
                stroke="#2f78b8"
                strokeWidth={1}
                strokeDasharray="2 4"
                opacity={0.55}
              />
              <text x={TANK_RIGHT - 4} y={restTopPx - 4} fontSize={8.5} textAnchor="end" fill="#3a6d96">
                avvalgi suv sathi
              </text>
            </>
          )}

          {/* ---- splashes (expanding ripple rings + droplet particles) ---- */}
          {splashes.map((s) => (
            <SplashFx key={s.id} cx={toX(s.x)} surfaceY={waterTopPx} strength={s.strength} age={(t * 1000 - s.bornAt) / 1000} />
          ))}

          {/* ================= BLOCKS ================= */}
          {blocks.map((b) => (
            <BlockGfx key={b.id} b={b} model={model} />
          ))}

          {/* ---- glass FRONT (walls + rim ellipse + highlights, over everything) ---- */}
          <GlassFront />

          {/* ---- ρ scale tag on the waterline (subtle, not over a block) ---- */}
          <text
            x={TANK_LEFT + 6}
            y={Math.max(TANK_TOP_PX + 12, waterTopPx + 13)}
            fontSize={9.5}
            fill="#2c5f86"
            fontWeight={600}
          >
            suv · ρ = 1.0
          </text>

          {/* ---- empty-state hint ---- */}
          {blocks.length === 0 && oilPx < 0.5 && (
            <text
              x={VBW / 2}
              y={TANK_TOP_PX - 14}
              textAnchor="middle"
              fontSize={12.5}
              fontWeight={500}
              fill="#5b7081"
            >
              Pastdan bittasini tanlang — suvga tashlab koʻring ↓
            </text>
          )}
        </svg>
      </div>

      {/* live readout for the most recent block */}
      {lastBlock && <Readout model={model} block={lastBlock} riseCm={riseCm} />}
      {!lastBlock && oilPx > 0.5 && (
        <p className="rounded-[14px] border border-void-500 bg-void-800 px-3 py-2.5 text-[13px] text-void-200">
          Moy suvdan yengil (ρ = 0.92), shuning uchun u suvga aralashmaydi —
          ustiga qalqib chiqib, yupqa{" "}
          <span className="font-semibold text-void-100">qatlam</span> boʻlib qoladi.
        </p>
      )}

      {/* block-size control — proves density is intrinsic, not about size */}
      <div className="flex items-center gap-2 rounded-[14px] border border-void-500 bg-void-800 px-3 py-2">
        <span className="text-[12px] font-medium text-void-200">Boʻlak kattaligi:</span>
        <div className="flex gap-1.5">
          {SIZE_LABELS.map((s) => {
            const active = sizePreset === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => model.sizePreset.set(s.key)}
                className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition active:scale-95 ${
                  active
                    ? "border-antares-500 bg-antares-50 text-antares-700"
                    : "border-void-500 bg-void-700 text-void-200 hover:border-void-400"
                }`}
              >
                {s.uz}
                <span className="ml-1 font-mono text-[10px] text-void-300">{s.cm}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* material palette — click OR drag, with mini material-true swatches */}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {materials.map((m) => (
          <button
            key={m.id}
            type="button"
            draggable
            onDragStart={() => setDragMat(m.id)}
            onDragEnd={() => setDragMat(null)}
            onClick={() => spawn(m)}
            className="group flex flex-col items-center gap-1 rounded-xl border border-void-500 bg-void-800 p-2 text-center transition hover:border-antares-400 hover:bg-void-700 active:scale-95"
            aria-label={`${m.labelUz}, zichligi ${m.density} — suvga tashlash`}
          >
            <MaterialSwatch m={m} />
            <span className="text-[11px] font-medium leading-none text-void-100">{m.labelUz}</span>
            <span className="font-mono text-[10px] leading-none text-void-300">ρ {m.density}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-void-300">
        <span className="font-medium">
          Sinab koʻrilgan: {interactions}
          {interactions < COMPLETE_AT ? ` / ${COMPLETE_AT}` : " ✓"}
        </span>
        <button
          type="button"
          onClick={() => model.reset()}
          className="rounded-full border border-void-500 bg-void-700 px-3.5 py-1 font-medium text-void-200 transition hover:border-void-400 active:scale-95"
        >
          Tozalash
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   SVG <defs> — gradients, filters, markers for every material.
   ============================================================ */
function SvgDefs() {
  return (
    <defs>
      {/* water column: light at the meniscus, deepening toward the floor */}
      <linearGradient id="db-water" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#a6dbf4" stopOpacity="0.62" />
        <stop offset="45%" stopColor="#6cb5e4" stopOpacity="0.72" />
        <stop offset="100%" stopColor="#2f73b4" stopOpacity="0.82" />
      </linearGradient>
      {/* glass body tint */}
      <linearGradient id="db-glass-body" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#dfeef5" stopOpacity="0.55" />
        <stop offset="12%" stopColor="#f4fafd" stopOpacity="0.35" />
        <stop offset="88%" stopColor="#dfeef5" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#cfe2ec" stopOpacity="0.6" />
      </linearGradient>
      {/* oil layer — warm translucent gold with a sheen band */}
      <linearGradient id="db-oil" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#f3da7e" />
        <stop offset="50%" stopColor="#e6c34a" />
        <stop offset="100%" stopColor="#caa636" />
      </linearGradient>

      {/* wood grain: turbulence displaced into a warm brown */}
      <filter id="db-wood-grain" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.012 0.14" numOctaves="3" seed="7" result="n" />
        <feColorMatrix
          in="n"
          type="matrix"
          values="0 0 0 0 0.45  0 0 0 0 0.30  0 0 0 0 0.16  0 0 0 0.5 0"
          result="grain"
        />
        <feComposite in="grain" in2="SourceGraphic" operator="over" />
      </filter>

      {/* wood base fill */}
      <linearGradient id="db-wood-base" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#c89464" />
        <stop offset="100%" stopColor="#9c6a3e" />
      </linearGradient>

      {/* metallic sheen: vertical light → dark with a bright specular band */}
      <linearGradient id="db-metal" x1="0" y1="0" x2="1" y2="0.4">
        <stop offset="0%" stopColor="#eef2f6" />
        <stop offset="28%" stopColor="#c2cad2" />
        <stop offset="52%" stopColor="#f6f9fb" />
        <stop offset="70%" stopColor="#aab4bf" />
        <stop offset="100%" stopColor="#7c8893" />
      </linearGradient>
      <linearGradient id="db-gold" x1="0" y1="0" x2="1" y2="0.4">
        <stop offset="0%" stopColor="#ffe9a8" />
        <stop offset="30%" stopColor="#eebb2e" />
        <stop offset="52%" stopColor="#fff2c4" />
        <stop offset="72%" stopColor="#d99a12" />
        <stop offset="100%" stopColor="#a9760a" />
      </linearGradient>

      {/* ice: translucent blue with an inner refraction sheen */}
      <linearGradient id="db-ice" x1="0" y1="0" x2="0.6" y2="1">
        <stop offset="0%" stopColor="#eaf7fd" stopOpacity="0.95" />
        <stop offset="55%" stopColor="#bfe4f5" stopOpacity="0.88" />
        <stop offset="100%" stopColor="#9fd0ec" stopOpacity="0.9" />
      </linearGradient>

      {/* soft top-light highlight overlay used on every block */}
      <linearGradient id="db-toplight" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
        <stop offset="40%" stopColor="#ffffff" stopOpacity="0.05" />
        <stop offset="100%" stopColor="#000000" stopOpacity="0.18" />
      </linearGradient>

      {/* arrow heads — sized to stroke */}
      <marker id="db-arrow-down" viewBox="0 0 10 10" refX="5" refY="8.5" markerWidth="6.5" markerHeight="6.5" orient="auto">
        <path d="M1,1 L5,9 L9,1" fill="#d8453b" />
      </marker>
      <marker id="db-arrow-up" viewBox="0 0 10 10" refX="5" refY="1.5" markerWidth="6.5" markerHeight="6.5" orient="auto">
        <path d="M1,9 L5,1 L9,9" fill="#2563c9" />
      </marker>
    </defs>
  );
}

/* ============================================================
   Living water: depth-shaded body + meniscus + animated surface wave.
   ============================================================ */
function Water({ waterTopPx, t, reduced }: { waterTopPx: number; t: number; reduced: boolean }) {
  // Build a gentle sine wave for the top edge so the surface feels alive.
  const amp = reduced ? 0 : 1.6;
  const segs = 14;
  let d = `M ${TANK_LEFT} ${FLOOR_PX} L ${TANK_LEFT} ${waterTopPx}`;
  for (let i = 0; i <= segs; i++) {
    const x = TANK_LEFT + (TANK_W_PX * i) / segs;
    const phase = (i / segs) * Math.PI * 2 * 1.5;
    const y = waterTopPx + Math.sin(phase + t * 1.8) * amp;
    d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  d += ` L ${TANK_RIGHT} ${FLOOR_PX} Z`;

  return (
    <g>
      <path d={d} fill="url(#db-water)" />
      {/* meniscus highlight along the surface */}
      <path
        d={(() => {
          let p = "";
          for (let i = 0; i <= segs; i++) {
            const x = TANK_LEFT + (TANK_W_PX * i) / segs;
            const phase = (i / segs) * Math.PI * 2 * 1.5;
            const y = waterTopPx + Math.sin(phase + t * 1.8) * amp;
            p += `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)} `;
          }
          return p;
        })()}
        fill="none"
        stroke="#dff1fb"
        strokeWidth={1.6}
        opacity={0.85}
      />
      {/* faint caustic streak for depth */}
      <ellipse
        cx={TANK_LEFT + TANK_W_PX * 0.62}
        cy={waterTopPx + (FLOOR_PX - waterTopPx) * 0.5}
        rx={TANK_W_PX * 0.26}
        ry={(FLOOR_PX - waterTopPx) * 0.22}
        fill="#ffffff"
        opacity={0.06}
      />
    </g>
  );
}

/* ============================================================
   Splash effect: expanding ripple rings + a few droplet arcs.
   Driven entirely by `age` (seconds) so it's deterministic + perf-safe.
   ============================================================ */
function SplashFx({ cx, surfaceY, strength, age }: { cx: number; surfaceY: number; strength: number; age: number }) {
  if (age < 0 || age > 0.9) return null;
  const k = age / 0.9; // 0..1 progress
  const fade = 1 - k;
  const ringR = (10 + strength * 26) * k;
  const droplets = Math.round(3 + strength * 4);
  return (
    <g pointerEvents="none">
      {/* two expanding ripple rings */}
      <ellipse cx={cx} cy={surfaceY} rx={ringR} ry={ringR * 0.34} fill="none" stroke="#cfeefb" strokeWidth={1.6} opacity={fade * 0.85} />
      <ellipse cx={cx} cy={surfaceY} rx={ringR * 0.55} ry={ringR * 0.55 * 0.34} fill="none" stroke="#ffffff" strokeWidth={1.2} opacity={fade * 0.6} />
      {/* droplet particles arcing up then falling (parabolic) */}
      {Array.from({ length: droplets }).map((_, i) => {
        const spread = (i / (droplets - 1) - 0.5) * (16 + strength * 30);
        const dx = spread;
        const peak = 10 + strength * 18;
        // simple parabola: up then down over the lifetime
        const dy = -peak * 4 * k * (1 - k);
        return <circle key={i} cx={cx + dx} cy={surfaceY + dy} r={1.6 + strength} fill="#bfe4f5" opacity={fade * 0.9} />;
      })}
    </g>
  );
}

/* ============================================================
   A single block: material-true SVG render + true-scale labelled forces.
   ============================================================ */
function BlockGfx({ b, model }: { b: Block; model: DensityBuoyancyModel }) {
  const cx = toX(b.x);
  const cy = toY(b.y);
  const px = mToPx(b.side);
  const half = px / 2;
  const frac = model.fractionOf(b);
  const sinks = b.mat.density > 1.0;
  const look = lookOf(b.mat);

  // True forces in Newtons → one shared px-per-Newton scale.
  const V = PHYS.blockVolume(b.side);
  const m = b.mat.density * 1000 * V;
  const fW = m * PHYS.G;
  const fB = PHYS.RHO_WATER * PHYS.G * frac * V;
  const wPx = Math.min(MAX_ARROW, fW * PX_PER_N);
  const bPx = Math.min(MAX_ARROW, fB * PX_PER_N);
  const clampedW = fW * PX_PER_N > MAX_ARROW;

  const showVectors = b.settled || Math.abs(b.vy) < 0.08;
  const pct = Math.round(frac * 100);

  const fillId =
    look === "wood" ? "url(#db-wood-base)" : look === "ice" ? "url(#db-ice)" : look === "gold" ? "url(#db-gold)" : look === "metal" ? "url(#db-metal)" : b.mat.color;

  const labelDark = look === "ice" || look === "metal" || look === "gold";

  return (
    <g>
      {/* drop shadow under a settled sinker for grounding */}
      {b.settled && sinks && (
        <ellipse cx={cx} cy={cy + half + 2} rx={half * 0.9} ry={3} fill="#0c2a44" opacity={0.18} />
      )}

      {/* base material body */}
      <rect x={cx - half} y={cy - half} width={px} height={px} rx={3} fill={fillId} stroke="#1a1813" strokeOpacity={0.32} strokeWidth={1} />

      {/* wood grain overlay (turbulence) */}
      {look === "wood" && (
        <rect x={cx - half} y={cy - half} width={px} height={px} rx={3} fill="#9c6a3e" filter="url(#db-wood-grain)" opacity={0.55} />
      )}

      {/* matte: flat low-key, just a faint top sheen */}
      {look === "matte" && (
        <rect x={cx - half} y={cy - half} width={px} height={px} rx={3} fill={b.mat.color} />
      )}

      {/* ice inner refraction band */}
      {look === "ice" && (
        <>
          <rect x={cx - half + 2.5} y={cy - half + 2.5} width={px - 5} height={px - 5} rx={2} fill="#ffffff" opacity={0.18} />
          <line x1={cx - half + 3} y1={cy + half - 4} x2={cx + half - 4} y2={cy - half + 3} stroke="#ffffff" strokeWidth={1.4} opacity={0.5} />
        </>
      )}

      {/* universal top-light + corner specular highlight */}
      <rect x={cx - half} y={cy - half} width={px} height={px} rx={3} fill="url(#db-toplight)" />
      {(look === "metal" || look === "gold") && (
        <rect x={cx - half + 2} y={cy - half + 2} width={px * 0.32} height={px * 0.14} rx={2} fill="#ffffff" opacity={0.7} />
      )}
      {/* crisp body outline on top */}
      <rect x={cx - half} y={cy - half} width={px} height={px} rx={3} fill="none" stroke="#13110d" strokeOpacity={0.4} strokeWidth={1.1} />

      {/* density label on the block */}
      <text
        x={cx}
        y={cy + 3.5}
        textAnchor="middle"
        fontSize={Math.max(9, Math.min(12, px * 0.22))}
        fontWeight={700}
        fill={labelDark ? "#16324a" : "#fbf6ea"}
        style={{ paintOrder: "stroke" }}
        stroke={labelDark ? "#ffffff" : "#1a1813"}
        strokeWidth={0.7}
        strokeOpacity={0.35}
      >
        ρ {b.mat.density}
      </text>

      {/* submerged-% chip on a floater while settled */}
      {b.settled && !sinks && frac < 0.999 && (
        <text x={cx} y={cy + half + 12} textAnchor="middle" fontSize={9} fontWeight={600} fill="#1d5a8c">
          {pct}% suvda
        </text>
      )}

      {/* force vectors — true-scale, labelled, drawn once roughly settled */}
      {showVectors && (
        <>
          {/* weight (down, red) — anchored at block centre, offset left */}
          <line x1={cx - 8} y1={cy} x2={cx - 8} y2={cy + wPx} stroke="#d8453b" strokeWidth={2.6} markerEnd="url(#db-arrow-down)" />
          <text x={cx - 12} y={cy + wPx + 4} textAnchor="end" fontSize={9} fontWeight={700} fill="#b5362d">
            {fW.toFixed(1)} N{clampedW ? " ↧" : ""}
          </text>
          {/* buoyancy (up, blue) — offset right */}
          {bPx > 3 && (
            <>
              <line x1={cx + 8} y1={cy} x2={cx + 8} y2={cy - bPx} stroke="#2563c9" strokeWidth={2.6} markerEnd="url(#db-arrow-up)" />
              <text x={cx + 12} y={cy - bPx - 3} textAnchor="start" fontSize={9} fontWeight={700} fill="#1f56b0">
                {fB.toFixed(1)} N
              </text>
            </>
          )}
        </>
      )}

      {/* verdict tag once settled — placed above the block, clear of labels */}
      {b.settled && (
        <text x={cx} y={cy - half - 7} textAnchor="middle" fontSize={11} fontWeight={700} fill={sinks ? "#c2392f" : "#1f8a54"}>
          {sinks ? "choʻkdi" : "suzdi"}
        </text>
      )}
    </g>
  );
}

/* ============================================================
   Glass front overlay: walls, rim ellipse, and edge highlights.
   Drawn last so the glass reads as being in front of water + blocks.
   ============================================================ */
function GlassFront() {
  return (
    <g pointerEvents="none">
      {/* left + right thick glass walls */}
      <rect x={TANK_LEFT - WALL} y={TANK_TOP_PX - RIM_RY} width={WALL} height={TANK_H_PX + RIM_RY} rx={3} fill="#d7e6ee" opacity={0.7} />
      <rect x={TANK_RIGHT} y={TANK_TOP_PX - RIM_RY} width={WALL} height={TANK_H_PX + RIM_RY} rx={3} fill="#c3d8e2" opacity={0.7} />
      {/* inner wall highlights */}
      <line x1={TANK_LEFT + 1.5} y1={TANK_TOP_PX} x2={TANK_LEFT + 1.5} y2={FLOOR_PX} stroke="#ffffff" strokeWidth={1.4} opacity={0.6} />
      <line x1={TANK_RIGHT - 1.5} y1={TANK_TOP_PX} x2={TANK_RIGHT - 1.5} y2={FLOOR_PX} stroke="#ffffff" strokeWidth={1} opacity={0.3} />

      {/* floor slab */}
      <rect x={TANK_LEFT - WALL} y={FLOOR_PX} width={TANK_W_PX + WALL * 2} height={WALL + 2} rx={3} fill="#b9cdd8" />
      <line x1={TANK_LEFT - WALL} y1={FLOOR_PX + 0.6} x2={TANK_RIGHT + WALL} y2={FLOOR_PX + 0.6} stroke="#ffffff" strokeWidth={1} opacity={0.5} />

      {/* tank top opening rim (ellipse front + back) */}
      <ellipse cx={(TANK_LEFT + TANK_RIGHT) / 2} cy={TANK_TOP_PX} rx={TANK_W_PX / 2 + 1} ry={RIM_RY} fill="none" stroke="#aac4d2" strokeWidth={2} />
      <ellipse cx={(TANK_LEFT + TANK_RIGHT) / 2} cy={TANK_TOP_PX} rx={TANK_W_PX / 2 + 1} ry={RIM_RY} fill="#ffffff" opacity={0.12} />

      {/* big diagonal glass glare across the front */}
      <path
        d={`M ${TANK_LEFT + 8} ${TANK_TOP_PX + 6} L ${TANK_LEFT + TANK_W_PX * 0.34} ${TANK_TOP_PX + 6} L ${TANK_LEFT + 10} ${FLOOR_PX - 8} L ${TANK_LEFT + 4} ${FLOOR_PX - 8} Z`}
        fill="#ffffff"
        opacity={0.1}
      />
    </g>
  );
}

/* ============================================================
   Mini material-true swatch for the palette chips.
   ============================================================ */
function MaterialSwatch({ m }: { m: MaterialBlock }) {
  const look = lookOf(m);
  const fill =
    look === "wood" ? "url(#sw-wood)" : look === "ice" ? "url(#sw-ice)" : look === "gold" ? "url(#sw-gold)" : look === "metal" ? "url(#sw-metal)" : m.color;
  return (
    <svg width={26} height={26} viewBox="0 0 26 26" aria-hidden="true">
      <defs>
        <linearGradient id="sw-wood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c89464" />
          <stop offset="100%" stopColor="#8c5d34" />
        </linearGradient>
        <linearGradient id="sw-metal" x1="0" y1="0" x2="1" y2="0.6">
          <stop offset="0%" stopColor="#eef2f6" />
          <stop offset="50%" stopColor="#c2cad2" />
          <stop offset="100%" stopColor="#828a95" />
        </linearGradient>
        <linearGradient id="sw-gold" x1="0" y1="0" x2="1" y2="0.6">
          <stop offset="0%" stopColor="#ffe9a8" />
          <stop offset="50%" stopColor="#eebb2e" />
          <stop offset="100%" stopColor="#a9760a" />
        </linearGradient>
        <linearGradient id="sw-ice" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#eaf7fd" />
          <stop offset="100%" stopColor="#9fd0ec" />
        </linearGradient>
      </defs>
      <rect x={1} y={1} width={24} height={24} rx={5} fill={fill} stroke="rgba(0,0,0,0.22)" />
      <rect x={3} y={3} width={11} height={5} rx={2} fill="#ffffff" opacity={look === "matte" ? 0.12 : 0.45} />
      {m.phase === "liquid" && (
        <path d="M13 4 C 9 11, 9 18, 13 21 C 17 18, 17 11, 13 4 Z" fill="#fff" opacity={0.35} />
      )}
    </svg>
  );
}

/* ============================================================
   Instrument readout — elegant panel with a weight↔buoyancy bar.
   ============================================================ */
function Readout({ model, block, riseCm }: { model: DensityBuoyancyModel; block: Block; riseCm: number }) {
  const V = PHYS.blockVolume(block.side);
  const m = block.mat.density * 1000 * V; // kg
  const frac = model.fractionOf(block);
  const fW = m * PHYS.G; // N
  const fB = PHYS.RHO_WATER * PHYS.G * frac * V; // N
  const sinks = block.mat.density > 1.0;
  const pct = Math.round(frac * 100);
  const sideCm = Math.round(block.side * 100);

  // Bar: how buoyancy compares to weight (capped at 100% of weight visually).
  const buoyPct = fW > 0 ? Math.min(100, (fB / fW) * 100) : 0;

  return (
    <div className="rounded-[16px] border border-void-500 bg-void-800 p-3">
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-[14px] font-semibold text-void-100">{block.mat.labelUz}</span>
          <span className="font-mono text-[12px] text-void-300">{sideCm}×{sideCm}×{sideCm} sm</span>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
            sinks ? "bg-[#fae3e0] text-[#c2392f]" : "bg-[#dcf3e6] text-[#1f8a54]"
          }`}
        >
          {sinks ? "choʻkadi" : "suzadi"}
        </span>
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-2 sm:grid-cols-6">
        <Metric label="zichlik ρ" value={`${block.mat.density}`} unit="g/sm³" accent />
        <Metric label="massa m" value={`${(m * 1000).toFixed(0)}`} unit="g" />
        <Metric label="hajm V" value={`${(V * 1e6).toFixed(0)}`} unit="sm³" />
        <Metric label="suvda" value={`${pct}`} unit="%" />
        <Metric label="ogʻirlik" value={`${fW.toFixed(1)}`} unit="N" tone="sink" />
        <Metric label="koʻtarish" value={`${fB.toFixed(1)}`} unit="N" tone="float" />
      </div>

      {/* weight ↔ buoyancy comparison bar */}
      <div className="mt-2.5">
        <div className="mb-1 flex justify-between text-[10px] font-medium text-void-300">
          <span className="text-[#c2392f]">ogʻirlik (pastga)</span>
          <span className="text-[#1f8a54]">koʻtarish kuchi (yuqoriga)</span>
        </div>
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-[#fae3e0]">
          <div
            className="h-full rounded-full bg-[#2fa86a] transition-[width] duration-150"
            style={{ width: `${buoyPct}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-void-300">
          {sinks
            ? "Koʻtarish kuchi ogʻirlikdan kuchsiz qoldi — shuning uchun tubga ketdi."
            : "Koʻtarish kuchi ogʻirlikka teng keldi — shuning uchun shu joyda muvozanatda suzib turibdi."}
        </p>
      </div>

      {riseCm > 0.05 && (
        <p className="mt-2 rounded-[10px] bg-[#e8f1f8] px-2.5 py-1.5 text-[11.5px] text-[#1d5a8c]">
          💧 Suv sathi <span className="font-semibold">{riseCm.toFixed(1)} sm</span> koʻtarildi — jism
          oʻrnini boʻshatish uchun aynan shuncha suvni surib chiqardi (Arximed siri).
        </p>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  unit,
  accent,
  tone,
}: {
  label: string;
  value: string;
  unit: string;
  accent?: boolean;
  tone?: "float" | "sink";
}) {
  const valueColor = tone === "sink" ? "text-[#c2392f]" : tone === "float" ? "text-[#1f8a54]" : "text-void-100";
  return (
    <div className={`rounded-[10px] px-2 py-1.5 ${accent ? "bg-antares-50" : "bg-void-700"}`}>
      <div className="text-[9.5px] uppercase tracking-wide text-void-300">{label}</div>
      <div className={`font-mono text-[14px] font-semibold tabular-nums leading-tight ${valueColor}`}>
        {value}
        <span className="ml-0.5 text-[9px] font-normal text-void-300">{unit}</span>
      </div>
    </div>
  );
}
