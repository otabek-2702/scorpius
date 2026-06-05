// components/laboratoriya/koinot/KoinotLab.tsx
/**
 * KoinotLab — "Quyosh tizimi" interactive 3D solar system (default export,
 * self-contained, no props). The orchestrator wraps this in LabShell, so this
 * file renders ONLY the near-black 3D stage + the light-themed control panel and
 * readouts around it (no nav, no back link).
 *
 * SSR safety (Next 16 App Router): the react-three-fiber <Canvas> is browser-
 * only. This Client Component dynamically imports ./Scene with `ssr: false`, so
 * no three.js code ever executes during prerender/SSR. A static placeholder
 * holds the layout until the scene mounts.
 *
 * Interactivity:
 *  - drag to orbit, scroll/pinch to zoom, two-finger / right-drag to pan
 *    (drei OrbitControls inside the Scene)
 *  - click a planet (or the Sun) → an info card with REAL NASA facts appears
 *  - speed control (Sekin / Oddiy / Tez) scales the orbital + spin rates
 *  - toggles for orbit rings and floating name labels
 *  - a planet picker (chips) mirrors click-to-select for keyboard/touch users
 *
 * prefers-reduced-motion freezes the orbits to a still, correct frame.
 * Accent colour for this lab: indigo #6366f1.
 */
"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { Orbit, Tag, Gauge, Sparkles, RotateCcw } from "lucide-react";
import {
  PLANETS,
  type PlanetFacts,
  yearLabelUz,
  dayLabelUz,
} from "@/lib/sims/koinot/planets";

const ACCENT = "#6366f1";

/** SSR-safe dynamic import: the r3f Canvas never runs on the server. */
const Scene = dynamic(() => import("./Scene"), {
  ssr: false,
  loading: () => <StagePlaceholder />,
});

type SpeedKey = "slow" | "normal" | "fast";
const SPEEDS: Record<SpeedKey, number> = { slow: 0.35, normal: 1, fast: 3 };
const SPEED_LABEL: Record<SpeedKey, string> = {
  slow: "Sekin",
  normal: "Oddiy",
  fast: "Tez",
};

/** The Sun gets its own selectable fact card (not a planet, so kept inline). */
const SUN = {
  id: "quyosh",
  nameUz: "Quyosh",
  blurbUz: "Tizim markazidagi yulduz — butun massaning ~99,8% i shunda.",
  diameterKm: 1392700,
  surfaceK: 5772,
  massNote: "Yer massasidan ~333 000 marta og‘ir",
};

/**
 * Subscribe to prefers-reduced-motion via useSyncExternalStore — SSR-safe
 * (server snapshot = false, matching the initial client paint, so no hydration
 * mismatch) and reactive to OS-level changes, with no setState-in-effect.
 */
function subscribeReducedMotion(cb: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function getReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    () => false, // server snapshot
  );
}

const numberFmt = new Intl.NumberFormat("ru-RU"); // spaced thousands, locale-neutral digits

export default function KoinotLab() {
  const reduced = useReducedMotion();
  const [selectedId, setSelectedId] = useState<string | null>("yer");
  const [speed, setSpeed] = useState<SpeedKey>("normal");
  const [showOrbits, setShowOrbits] = useState(true);
  const [showLabels, setShowLabels] = useState(true);

  const selectedPlanet = useMemo<PlanetFacts | null>(
    () => PLANETS.find((p) => p.id === selectedId) ?? null,
    [selectedId],
  );
  const sunSelected = selectedId === SUN.id;

  return (
    <div className="flex w-full flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.55fr)_minmax(330px,1fr)] lg:items-start lg:gap-6">
      {/* ============================================================
       *  LEFT — the cinematic 3D stage (sticky on lg)
       * ========================================================== */}
      <div className="flex flex-col gap-3 lg:sticky lg:top-4 lg:self-start">
        <div className="relative h-[60dvh] min-h-[360px] w-full overflow-hidden rounded-[18px] border border-void-600 bg-[#05060d] lg:h-[640px]">
          <Scene
            selectedId={selectedId}
            speed={SPEEDS[speed]}
            showOrbits={showOrbits}
            showLabels={showLabels}
            frozen={reduced}
            onSelect={setSelectedId}
          />

          {/* corner hint chip */}
          <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full border border-white/10 bg-black/40 px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-white/70 backdrop-blur-sm">
            koʻrgazmali masshtab
          </div>
          {reduced && (
            <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10.5px] font-semibold text-white/75 backdrop-blur-sm">
              Harakat oʻchirilgan
            </div>
          )}

          {/* gesture hint, bottom */}
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/10 bg-black/35 px-3.5 py-1 text-[11px] text-white/65 backdrop-blur-sm">
            Aylantirish: torting · Yaqinlashtirish: g‘ildirak · Sayyorani bosing
          </div>
        </div>

        {/* speed control — under the stage so it reads as the system's tempo */}
        <div className="rounded-[16px] border border-void-600 bg-void-800 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-void-300">
            <Gauge className="h-3.5 w-3.5" style={{ color: ACCENT }} />
            Orbital tezlik
          </div>
          <div className="flex gap-1.5">
            {(Object.keys(SPEEDS) as SpeedKey[]).map((k) => (
              <button
                key={k}
                type="button"
                disabled={reduced}
                onClick={() => setSpeed(k)}
                aria-pressed={speed === k}
                title={
                  reduced
                    ? "Tezlik reduced-motion rejimida amal qilmaydi"
                    : undefined
                }
                className={`flex-1 rounded-[10px] border px-2 py-2 text-[12.5px] font-semibold transition active:scale-95 ${
                  reduced
                    ? "cursor-not-allowed border-void-500 bg-void-700 text-void-300 opacity-50"
                    : speed === k
                      ? "text-white shadow-sm"
                      : "border-void-500 bg-void-700 text-void-200 hover:border-void-400"
                }`}
                style={
                  !reduced && speed === k
                    ? { background: ACCENT, borderColor: ACCENT }
                    : undefined
                }
              >
                {SPEED_LABEL[k]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-snug text-void-300">
            Ichki sayyoralar tashqilaridan tezroq aylanadi — bu ularning{" "}
            <span className="font-semibold text-void-100">haqiqiy</span> orbital
            davrlari nisbati. Merkuriy bir yilda Quyoshni ~4 marta aylanadi,
            Neptun esa atigi 1/165 marta.
          </p>
        </div>
      </div>

      {/* ============================================================
       *  RIGHT — selection card · toggles · planet picker
       * ========================================================== */}
      <div className="flex flex-col gap-3">
        {/* ---- selected object info card ---- */}
        {sunSelected ? (
          <SunCard />
        ) : selectedPlanet ? (
          <PlanetCard planet={selectedPlanet} />
        ) : (
          <div className="rounded-[16px] border border-void-600 bg-void-800 p-4 text-[13px] leading-relaxed text-void-300">
            Sahnadan biror sayyorani yoki Quyoshni bosing — uning haqiqiy
            o‘lchamlari, masofasi va yo‘ldoshlari shu yerda chiqadi.
          </div>
        )}

        {/* ---- view toggles ---- */}
        <div className="rounded-[16px] border border-void-600 bg-void-800 p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-void-300">
            Ko‘rinish
          </div>
          <div className="flex flex-col gap-2">
            <Toggle
              icon={<Orbit className="h-4 w-4" />}
              label="Orbita halqalari"
              on={showOrbits}
              onClick={() => setShowOrbits((v) => !v)}
            />
            <Toggle
              icon={<Tag className="h-4 w-4" />}
              label="Sayyora nomlari"
              on={showLabels}
              onClick={() => setShowLabels((v) => !v)}
            />
          </div>
        </div>

        {/* ---- planet picker (keyboard / touch friendly mirror of click) ---- */}
        <div className="rounded-[16px] border border-void-600 bg-void-800 p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-void-300">
            Sayyorani tanlang
          </div>
          <div className="flex flex-wrap gap-1.5">
            <PickChip
              active={sunSelected}
              dot="#ffcf57"
              onClick={() => setSelectedId(SUN.id)}
            >
              Quyosh
            </PickChip>
            {PLANETS.map((p) => (
              <PickChip
                key={p.id}
                active={selectedId === p.id}
                dot={p.color}
                onClick={() => setSelectedId(p.id)}
              >
                {p.nameUz}
              </PickChip>
            ))}
          </div>
        </div>

        {/* ---- reset ---- */}
        <div className="flex items-center justify-between text-[12px] text-void-300">
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" style={{ color: ACCENT }} />
            8 sayyora · haqiqiy NASA ma’lumotlari
          </span>
          <button
            type="button"
            onClick={() => {
              setSelectedId("yer");
              setSpeed("normal");
              setShowOrbits(true);
              setShowLabels(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-void-500 bg-void-700 px-3 py-1 font-medium text-void-200 transition hover:border-void-400 active:scale-95"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Qaytadan
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 *  Cards
 * ========================================================== */

function PlanetCard({ planet }: { planet: PlanetFacts }) {
  return (
    <div className="rounded-[18px] border border-void-600 bg-void-800 p-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="h-11 w-11 shrink-0 rounded-full"
          style={{
            background: `radial-gradient(circle at 34% 30%, ${lighten(planet.color, 0.5)}, ${planet.color} 62%, ${planet.nightTint})`,
            boxShadow: `0 2px 10px ${planet.color}55, inset -2px -2px 6px rgba(0,0,0,0.45)`,
          }}
        />
        <div className="min-w-0">
          <h2 className="font-serif text-[1.5rem] font-medium leading-none text-void-100">
            {planet.nameUz}
          </h2>
          <p className="mt-1 text-[12.5px] leading-snug text-void-200">
            {planet.blurbUz}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Fact label="Diametr" value={`${numberFmt.format(planet.diameterKm)} km`} />
        <Fact
          label="Quyoshdan masofa"
          value={`${numberFmt.format(planet.distanceMkm)} mln km`}
        />
        <Fact label="Bir yili" value={yearLabelUz(planet.orbitDays)} />
        <Fact
          label="Bir kuni"
          value={dayLabelUz(planet.rotationHours, planet.retrograde)}
        />
        <Fact
          label="Yo‘ldoshlar"
          value={planet.moons === 0 ? "yo‘q" : numberFmt.format(planet.moons)}
        />
        <Fact label="O‘q qiyaligi" value={`${planet.axialTiltDeg.toFixed(1)}°`} />
      </div>
    </div>
  );
}

function SunCard() {
  return (
    <div className="rounded-[18px] border border-void-600 bg-void-800 p-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="h-11 w-11 shrink-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 38% 32%, #fff6cf, #ffcf57 55%, #f08c1e)",
            boxShadow: "0 0 18px #ffbb3a88, inset -2px -2px 6px rgba(120,60,0,0.4)",
          }}
        />
        <div className="min-w-0">
          <h2 className="font-serif text-[1.5rem] font-medium leading-none text-void-100">
            {SUN.nameUz}
          </h2>
          <p className="mt-1 text-[12.5px] leading-snug text-void-200">
            {SUN.blurbUz}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Fact label="Diametr" value={`${numberFmt.format(SUN.diameterKm)} km`} />
        <Fact label="Sirt harorati" value={`~${numberFmt.format(SUN.surfaceK)} K`} />
        <Fact label="Massa" value={SUN.massNote} wide />
      </div>
    </div>
  );
}

function Fact({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-[12px] border border-void-500 bg-void-700 px-2.5 py-2 ${wide ? "col-span-2" : ""}`}
    >
      <div className="text-[9.5px] font-medium uppercase tracking-wide text-void-300">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-[13.5px] font-semibold tabular-nums text-void-100">
        {value}
      </div>
    </div>
  );
}

/* ============================================================
 *  Controls
 * ========================================================== */

function Toggle({
  icon,
  label,
  on,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="switch"
      aria-checked={on}
      className="flex items-center justify-between rounded-[12px] border border-void-500 bg-void-700 px-3 py-2 text-[13px] font-semibold text-void-200 transition hover:border-void-400 active:scale-[0.98]"
    >
      <span className="flex items-center gap-2">
        <span style={{ color: on ? ACCENT : undefined }}>{icon}</span>
        {label}
      </span>
      <span
        aria-hidden
        className="relative h-5 w-9 rounded-full transition-colors"
        style={{ background: on ? ACCENT : "var(--color-void-500)" }}
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
          style={{ left: on ? "1.125rem" : "0.125rem" }}
        />
      </span>
    </button>
  );
}

function PickChip({
  active,
  dot,
  onClick,
  children,
}: {
  active: boolean;
  dot: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition active:scale-95 ${
        active
          ? "text-white"
          : "border-void-500 bg-void-700 text-void-200 hover:border-void-400"
      }`}
      style={active ? { background: ACCENT, borderColor: ACCENT } : undefined}
    >
      <span
        aria-hidden
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: dot, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.25)" }}
      />
      {children}
    </button>
  );
}

/* ============================================================
 *  Loading placeholder — holds the layout during the ssr:false import.
 * ========================================================== */
function StagePlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#05060d]">
      <div className="flex flex-col items-center gap-3">
        <span className="relative flex h-10 w-10">
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
            style={{ background: ACCENT }}
          />
          <span
            className="relative inline-flex h-10 w-10 rounded-full"
            style={{ background: "radial-gradient(circle at 38% 32%, #fff6cf, #ffcf57 55%, #f08c1e)" }}
          />
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/55">
          Quyosh tizimi yuklanmoqda…
        </span>
      </div>
    </div>
  );
}

/* small colour util (mirrors KimyoLab's tile lighten) */
function lighten(hex: string, amt: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const lr = Math.round(r + (255 - r) * amt);
  const lg = Math.round(g + (255 - g) * amt);
  const lb = Math.round(b + (255 - b) * amt);
  return `rgb(${lr},${lg},${lb})`;
}
