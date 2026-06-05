// components/laboratoriya/fizika/FizikaLab.tsx
/**
 * FizikaLab — Toʻqnashuvlar laboratoriyasi (Collision Lab).
 *
 * The default-export, fully self-contained physics collision lab for Scorpius.
 * It owns the shared CollisionModel, the single requestAnimationFrame loop that
 * drives model.step(dt), the VARIANT COMPARE TOGGLE (hand-built analytic vs the
 * matter-js engine — and, on lg, BOTH side by side), the scenario picker, the
 * parameter sliders, and the live invariant readouts (momentum bar — constant
 * across every impact — and a KE bar with a red lost-energy wedge).
 *
 * Responsive shape (parent LabShell centres content at max-w-[1240px]):
 *   • <768px  — single column (the original mobile layout, preserved).
 *   • md      — stage full-width on top, controls in a 2-column grid below.
 *   • lg+     — TWO columns: a STICKY left stage column + a scrolling right
 *               column (scenario picker, sliders, story chips, explainer).
 *
 * Architecture (AGENTS.md): the MODEL computes, the VIEW paints. All physics is
 * in CollisionModel (pure TS, Property<T> state). Variant A subscribes and paints
 * from the model. Variant B (matter-js) reads the same scenario inputs but runs
 * its own engine for the apples-to-apples comparison; it reports its drifting
 * momentum/KE back so the readout shows the contrast.
 *
 * The orchestrator renders this inside page chrome that already provides the
 * bottom nav + back link — this component renders NEITHER.
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2, Volume2, VolumeX } from "lucide-react";
import { useProperty } from "@/lib/sim/observable/useProperty";
import {
  CollisionModel,
  type ScenarioId,
} from "@/lib/sims/collision/Model";
import { CollisionHand } from "./CollisionHand";
import { CollisionMatter, type MatterReadout } from "./CollisionMatter";
import {
  prefersReducedMotion,
  readDeepLink,
  useFullscreen,
  useSfx,
  writeDeepLink,
} from "./labHooks";

type Variant = "hand" | "library" | "both";

const VARIANTS: readonly Variant[] = ["hand", "library", "both"];
const SCENARIO_IDS: readonly ScenarioId[] = [
  "equal-mass-stop",
  "newtons-cradle",
  "mass-mismatch",
  "restitution-dial",
  "perfectly-inelastic",
  "2d-glancing",
];

const SCENARIOS: { id: ScenarioId; title: string; sub: string }[] = [
  { id: "equal-mass-stop", title: "Teng massa · toʻxtash", sub: "A uradi, A toʻxtaydi" },
  { id: "newtons-cradle", title: "Nyuton beshigi", sub: "N tortsang — N uchadi" },
  { id: "mass-mismatch", title: "Massa farqi", sub: "ogʻir → yengil 2×" },
  { id: "restitution-dial", title: "Elastiklik diali", sub: "e: 1 → 0" },
  { id: "perfectly-inelastic", title: "Mutlaq noelastik", sub: "yopishib qoladi" },
  { id: "2d-glancing", title: "2D yonlama zarba", sub: "~90° ajraladi" },
];

const SPEEDS = [0.25, 0.5, 1, 2] as const;

export default function FizikaLab() {
  // Construct the model with the deep-linked scenario applied up front (pure,
  // outside React state → no hydration/lint concern; SSR-safe via readDeepLink).
  const model = useMemo(() => {
    const m = new CollisionModel();
    const sc = readDeepLink(
      "scene", "scorpius.lab.fizika.scene", SCENARIO_IDS, "equal-mass-stop",
    ) as ScenarioId;
    if (sc !== m.scenario.value) m.setScenario(sc);
    return m;
  }, []);
  const reduced = useMemo(() => prefersReducedMotion(), []);

  const [variant, setVariant] = useState<Variant>("hand");
  const [speed, setSpeed] = useState<number>(1);
  const [clock, setClock] = useState(0);
  // Bump to force the matter-js engine to rebuild on any scenario/slider change.
  const [armToken, setArmToken] = useState(0);
  const [matterReadout, setMatterReadout] = useState<MatterReadout | null>(null);
  // lg+ gate for the side-by-side "Ikkalasi" option (kept off below lg for
  // space + perf). Tracked via matchMedia so the toggle adapts live.
  const [isLg, setIsLg] = useState(false);

  const sfx = useSfx("scorpius.lab.fizika.sound");
  const { fsRef, isFullscreen, toggleFullscreen } = useFullscreen<HTMLDivElement>();

  const scenario = useProperty(model.scenario);
  const running = useProperty(model.running);
  const e = useProperty(model.e);
  const inv = useProperty(model.invariants);
  const keInit = useProperty(model.keInitial);
  const pInit = useProperty(model.pInitial);
  const m1 = useProperty(model.m1);
  const m2 = useProperty(model.m2);
  const u1 = useProperty(model.u1);
  const u2 = useProperty(model.u2);
  const impactParam = useProperty(model.impactParam);
  const cradlePull = useProperty(model.cradlePull);
  const flashes = useProperty(model.flashes);

  // keep live values in refs for the keyboard handler (no stale closures)
  const runningRef = useRef(running);
  const variantRef = useRef(variant);
  useEffect(() => { runningRef.current = running; }, [running]);
  useEffect(() => { variantRef.current = variant; }, [variant]);

  // ---- single rAF loop — drives the ANALYTIC model + a shared clock.
  // dt is scaled by the speed multiplier (clamped) before model.step.
  const speedRef = useRef(speed);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = ((now - last) / 1000) * Math.max(0.25, Math.min(2, speedRef.current));
      last = now;
      model.step(Math.min(0.05, dt));
      // Only push a React state update (which re-renders the whole lab subtree)
      // while something is actually animating. When idle/paused with no flashes
      // alive, we keep requesting frames but skip setClock → no 60fps churn.
      // Flashes need a few frames to fade out after a step-while-paused, so we
      // gate on running || flashes alive, not just running.
      const active = model.running.value || model.flashes.value.length > 0;
      if (active) setClock(now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [model]);

  useEffect(() => () => model.dispose(), [model]);

  // ---- restore the deep-linked VARIANT after mount (deferred to a rAF so the
  // first client render matches the server's fallback, avoiding any hydration
  // mismatch; the variant gates only view chrome, not the physics). ----
  useEffect(() => {
    const va = readDeepLink("view", "scorpius.lab.fizika.view", VARIANTS, "hand") as Variant;
    if (va === "hand") return;
    const raf = requestAnimationFrame(() => {
      // "both" is an lg-only option — apply it only when wide enough.
      if (va === "both" && !(typeof window !== "undefined" && window.matchMedia?.("(min-width: 1024px)").matches)) {
        return;
      }
      setVariant(va);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // ---- track lg breakpoint for the "Ikkalasi" option ----
  // First render matches the server (isLg=false → 2 toggles). We reconcile the
  // real value in a deferred rAF (avoids both hydration mismatch and a
  // synchronous setState in the effect body).
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => {
      setIsLg(mq.matches);
      // collapse "both" → single when leaving lg so the stage stays usable
      if (!mq.matches) setVariant((v) => (v === "both" ? "hand" : v));
    };
    const raf = requestAnimationFrame(apply);
    mq.addEventListener("change", apply);
    return () => {
      cancelAnimationFrame(raf);
      mq.removeEventListener("change", apply);
    };
  }, []);

  // ---- SFX: play an impact blip whenever a NEW flash is born ----
  // Flash ids are monotonically increasing in the model; track the newest seen.
  const lastFlashIdRef = useRef(0);
  useEffect(() => {
    let newest: (typeof flashes)[number] | null = null;
    for (const f of flashes) {
      if (f.id > lastFlashIdRef.current && (!newest || f.id > newest.id)) newest = f;
    }
    if (newest) {
      lastFlashIdRef.current = newest.id;
      sfx.impact(newest.strength, newest.inelastic);
    }
  }, [flashes, sfx]);

  // (On fullscreen enter/exit the stage element resizes; both child renderers
  // re-measure their own canvases via ResizeObserver — no extra nudge needed.)

  // ---- helpers: re-arm both engines from current inputs ----
  const reArm = useCallback(() => {
    model.armFromInputs();
    setArmToken((t) => t + 1);
  }, [model]);

  function persistScene(id: ScenarioId) {
    writeDeepLink("scene", "scorpius.lab.fizika.scene", id);
  }
  function persistVariant(v: Variant) {
    writeDeepLink("view", "scorpius.lab.fizika.view", v);
  }

  function pickScenario(id: ScenarioId) {
    model.setScenario(id);
    setArmToken((t) => t + 1);
    persistScene(id);
    sfx.click();
  }

  function chooseVariant(v: Variant) {
    setVariant(v);
    persistVariant(v);
    sfx.click();
  }

  // sliders write the model property AND re-arm (live, no Apply button)
  function setNum(p: { set: (v: number) => void }, v: number) {
    p.set(v);
    reArm();
  }

  const onPlay = useCallback(() => {
    if (model.balls.value.length === 0) model.armFromInputs();
    const willRun = !model.running.value;
    model.togglePlay();
    sfx.transport(willRun);
  }, [model, sfx]);

  // track the "nudge the matter engine" pause timeout so we can clear it on unmount
  const stepPauseTimeoutRef = useRef<number | null>(null);
  const onStep = useCallback(() => {
    if (variantRef.current !== "library") {
      model.stepOnce();
      setClock((c) => c + 1);
    }
    if (variantRef.current !== "hand") {
      // nudge the matter engine to run for one frame
      model.run();
      if (stepPauseTimeoutRef.current !== null) window.clearTimeout(stepPauseTimeoutRef.current);
      stepPauseTimeoutRef.current = window.setTimeout(() => {
        model.pause();
        stepPauseTimeoutRef.current = null;
      }, 30);
    }
    sfx.click();
  }, [model, sfx]);
  useEffect(() => () => {
    if (stepPauseTimeoutRef.current !== null) window.clearTimeout(stepPauseTimeoutRef.current);
  }, []);

  const onReset = useCallback(() => {
    reArm();
    sfx.click();
  }, [reArm, sfx]);

  // ---- keyboard shortcuts (ignored while typing in an input/slider) ----
  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable) return;
      if (ev.key === " " || ev.code === "Space") {
        ev.preventDefault();
        onPlay();
      } else if (ev.key === "r" || ev.key === "R") {
        ev.preventDefault();
        onReset();
      } else if (ev.key === "s" || ev.key === "S") {
        ev.preventDefault();
        onStep();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onPlay, onReset, onStep]);

  // --- which readout to show: analytic (hand) vs matter (library) ---
  const showMatterReadout = variant === "library";
  const shown = showMatterReadout
    ? matterReadout ?? { px: 0, py: 0, p: 0, ke: 0 }
    : { px: inv.px, py: inv.py, p: inv.p, ke: inv.ke };

  // KE bar scaling: relative to the armed initial KE (full bar = start energy).
  const keFrac = keInit > 0 ? Math.min(1, shown.ke / keInit) : 0;
  const lostFrac = keInit > 0 ? Math.min(1, Math.max(0, 1 - keFrac)) : 0;
  // momentum bar: relative to the ACTUAL armed |p| (should never shrink for the
  // analytic). The pairwise |m1·u1+m2·u2| guess is wrong for the 5-ball cradle,
  // so we divide by the model's captured initial |p| instead.
  const pFrac = pInit > 0 ? Math.min(1, shown.p / pInit) : 0;

  // cheap pure derivations — recomputed each render off the live inputs.
  const pred = model.predict1D();
  const is1D = scenario !== "2d-glancing" && scenario !== "newtons-cradle";

  return (
    <div className="flex w-full flex-col gap-3 pb-6 lg:grid lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,1fr)] lg:items-start lg:gap-6">
      {/* headline — spans both columns on lg */}
      <header className="lg:col-span-2">
        <h1 className="font-serif text-[26px] font-semibold leading-tight text-void-100 sm:text-[30px]">
          Toʻqnashuvlar laboratoriyasi
        </h1>
        <p className="mt-0.5 text-[13px] text-void-300">
          Massa, tezlik va elastiklikni oʻzgartir — <span className="text-void-200">impuls</span> har doim saqlanishini koʻr.
        </p>
      </header>

      {/* ===== LEFT COLUMN — sticky cinematic stage + transport + readouts ===== */}
      <div className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-4 lg:self-start">
        {/* THE STAGE (cinematic dark panel inside light Scorpius chrome) */}
        <div
          ref={fsRef}
          className={`relative overflow-hidden border border-void-600 bg-[#0b0f14] shadow-[0_10px_40px_-12px_rgba(20,20,15,0.5)] ${
            isFullscreen ? "flex h-screen w-screen flex-col rounded-none" : "rounded-[22px]"
          }`}
        >
          {/* top bar: variant toggle (left) + stage toolbar (right) */}
          <div className="flex flex-col gap-2 border-b border-white/5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex rounded-full bg-white/5 p-1" role="tablist" aria-label="Render variant">
              <ToggleBtn active={variant === "hand"} onClick={() => chooseVariant("hand")}>
                ⚙️ Qoʻlda
              </ToggleBtn>
              <ToggleBtn active={variant === "library"} onClick={() => chooseVariant("library")}>
                📦 Kutubxona
              </ToggleBtn>
              {isLg && (
                <ToggleBtn active={variant === "both"} onClick={() => chooseVariant("both")}>
                  ⚖️ Ikkalasi
                </ToggleBtn>
              )}
            </div>

            <div className="flex items-center gap-2">
              <p className="hidden text-[11px] leading-snug text-slate-400 sm:block">
                {variant === "both"
                  ? "Yonma-yon solishtir — qaysi haqiqiyroq?"
                  : variant === "hand"
                    ? "A = aniq analitik fizika (formula bilan)"
                    : "B = matter-js dvigateli (biroz «suzadi»)"}
              </p>
              <div className="flex items-center gap-1">
                <IconBtn
                  label={sfx.muted ? "Ovozni yoqish" : "Ovozni oʻchirish"}
                  onClick={sfx.toggleMuted}
                >
                  {sfx.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </IconBtn>
                <IconBtn
                  label={isFullscreen ? "Toʻliq ekrandan chiqish" : "Toʻliq ekran"}
                  onClick={toggleFullscreen}
                >
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </IconBtn>
              </div>
            </div>
          </div>

          {/* the stage itself */}
          <div className={`relative ${isFullscreen ? "flex flex-1 items-center justify-center bg-[#0b0f14] p-3" : "lg:min-h-[460px]"}`}>
            {variant === "both" ? (
              <div className="grid w-full grid-cols-2 gap-2 p-2">
                <StageFrame label="⚙️ Qoʻlda qurilgan (aniq)">
                  <CollisionHand model={model} reduced={reduced} clock={clock} />
                </StageFrame>
                <StageFrame label="📦 Kutubxona (matter-js)">
                  <CollisionMatter
                    model={model}
                    running={running}
                    armToken={armToken}
                    reduced={reduced}
                    speed={speed}
                    onReadout={setMatterReadout}
                  />
                </StageFrame>
              </div>
            ) : variant === "hand" ? (
              <div className="flex w-full items-center justify-center lg:min-h-[460px]">
                <div className="w-full">
                  <CollisionHand model={model} reduced={reduced} clock={clock} />
                </div>
              </div>
            ) : (
              <div className="flex w-full items-center justify-center lg:min-h-[460px]">
                <div className="w-full">
                  <CollisionMatter
                    model={model}
                    running={running}
                    armToken={armToken}
                    reduced={reduced}
                    speed={speed}
                    onReadout={setMatterReadout}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ===== live invariant readouts (momentum + KE bars) ===== */}
          <div className="grid grid-cols-1 gap-2 border-t border-white/5 px-3 py-3 sm:grid-cols-2">
            <ReadoutBar
              label="Umumiy impuls  Σp"
              valueText={`${shown.p.toFixed(2)} kg·m/s`}
              frac={pFrac}
              fill="#2dd4bf"
              track="rgba(45,212,191,0.16)"
              note="oʻzgarmaydi — toʻqnashuvdan oldin ham, keyin ham bir xil"
            />
            <ReadoutBar
              label="Kinetik energiya  Σ½mv²"
              valueText={`${shown.ke.toFixed(2)} J`}
              frac={keFrac}
              fill="#34d399"
              track="rgba(248,113,113,0.22)"
              lostFrac={lostFrac}
              note={
                lostFrac > 0.01
                  ? `${(lostFrac * 100).toFixed(0)}% issiqlikka aylandi (e = ${e.toFixed(2)})`
                  : "e = 1 → toʻliq saqlanadi"
              }
            />
          </div>
        </div>

        {/* ===== transport controls + speed ===== */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onPlay}
            className="inline-flex items-center gap-1.5 rounded-full bg-antares-500 px-5 py-2 text-[14px] font-bold text-void-100 shadow-sm transition hover:bg-antares-300 active:scale-95"
          >
            {running ? "⏸ Toʻxtatish" : "▶ Yugurtirish"}
          </button>
          <button
            type="button"
            onClick={onStep}
            className="rounded-full border border-void-600 bg-void-800 px-4 py-2 text-[14px] font-semibold text-void-200 transition hover:border-void-400 active:scale-95"
          >
            Qadam
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded-full border border-void-600 bg-void-800 px-4 py-2 text-[14px] font-semibold text-void-200 transition hover:border-void-400 active:scale-95"
          >
            ↺ Qaytadan
          </button>

          {/* speed segmented control */}
          <div className="inline-flex items-center gap-1 rounded-full border border-void-500 bg-void-700 p-0.5" role="group" aria-label="Tezlik">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { setSpeed(s); sfx.click(); }}
                aria-pressed={speed === s}
                className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold tabular-nums transition ${
                  speed === s ? "bg-antares-500 text-void-100 shadow-sm" : "text-void-300 hover:text-void-100"
                }`}
              >
                {s}×
              </button>
            ))}
          </div>

          {is1D && (
            <span className="ml-auto rounded-full bg-void-700 px-3 py-1.5 font-mono text-[11px] tabular-nums text-void-300">
              bashorat → v₁={pred.v1.toFixed(2)}  v₂={pred.v2.toFixed(2)} m/s
            </span>
          )}
        </div>

        {/* keyboard hint */}
        <p className="text-[10.5px] text-void-300">
          Klaviatura: <kbd className="rounded bg-void-700 px-1 font-mono">Space</kbd> oʻynat/toʻxtat ·{" "}
          <kbd className="rounded bg-void-700 px-1 font-mono">R</kbd> qayta ·{" "}
          <kbd className="rounded bg-void-700 px-1 font-mono">S</kbd> bir qadam
        </p>
      </div>

      {/* ===== RIGHT COLUMN — scenario picker, sliders, chips, explainer ===== */}
      <div className="flex min-w-0 flex-col gap-3">
        {/* scenario picker */}
        <div>
          <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-void-300">Sahna</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
            {SCENARIOS.map((s) => {
              const active = scenario === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickScenario(s.id)}
                  className={`flex flex-col items-start rounded-[14px] border px-3 py-2 text-left transition active:scale-[0.98] ${
                    active
                      ? "border-antares-500 bg-antares-50"
                      : "border-void-500 bg-void-800 hover:border-void-400"
                  }`}
                >
                  <span className={`text-[13px] font-semibold ${active ? "text-antares-700" : "text-void-100"}`}>
                    {s.title}
                  </span>
                  <span className="text-[11px] text-void-300">{s.sub}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* parameter sliders (contextual to the scenario) */}
        <div className="rounded-[18px] border border-void-500 bg-void-800 p-3">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-void-300">Sozlamalar</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {scenario === "newtons-cradle" ? (
              <Slider
                label="Tortilgan sharlar"
                value={cradlePull}
                min={1} max={5} step={1}
                unit=""
                onChange={(v) => setNum(model.cradlePull, v)}
                fmt={(v) => v.toFixed(0)}
              />
            ) : (
              <>
                <Slider
                  label="Massa m₁ (A)"
                  value={m1}
                  min={0.5} max={8} step={0.1}
                  unit="kg"
                  onChange={(v) => setNum(model.m1, v)}
                  disabled={scenario === "restitution-dial"}
                />
                <Slider
                  label="Massa m₂ (B)"
                  value={m2}
                  min={0.5} max={8} step={0.1}
                  unit="kg"
                  onChange={(v) => setNum(model.m2, v)}
                  disabled={scenario === "restitution-dial"}
                />
              </>
            )}

            {scenario !== "newtons-cradle" && (
              <Slider
                label="Tezlik u₁ (A)"
                value={u1}
                min={-6} max={6} step={0.1}
                unit="m/s"
                onChange={(v) => setNum(model.u1, v)}
              />
            )}
            {is1D && (
              <Slider
                label="Tezlik u₂ (B)"
                value={u2}
                min={-6} max={6} step={0.1}
                unit="m/s"
                onChange={(v) => setNum(model.u2, v)}
              />
            )}
            {scenario === "newtons-cradle" && (
              <Slider
                label="Boshlangʻich tezlik"
                value={u1}
                min={1} max={6} step={0.1}
                unit="m/s"
                onChange={(v) => setNum(model.u1, v)}
              />
            )}
            {scenario === "2d-glancing" && (
              <Slider
                label="Zarba parametri b"
                value={impactParam}
                min={0} max={1.0} step={0.02}
                unit="m"
                onChange={(v) => setNum(model.impactParam, v)}
                hint="0 = markazga · katta = yonlama"
              />
            )}

            {/* elasticity dial — always visible (the lab's signature control) */}
            <Slider
              label="Elastiklik e"
              value={e}
              min={0} max={1} step={0.01}
              unit=""
              accent
              onChange={(v) => setNum(model.e, v)}
              hint="1 = elastik (KE saqlanadi) · 0 = yopishadi"
            />
          </div>

          {/* story chips */}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {Math.abs(m1 - m2) < 1e-3 && e === 1 && scenario !== "newtons-cradle" && (
              <Chip tone="teal">teng massa → tezliklar almashinadi</Chip>
            )}
            {e === 1 && <Chip tone="green">e = 1 → KE saqlanadi</Chip>}
            {e === 0 && <Chip tone="red">e = 0 → yopishib qoladi</Chip>}
            {e > 0 && e < 1 && <Chip tone="gold">{(pred.dKE).toFixed(2)} J issiqlikka ketadi</Chip>}
            {m1 > m2 * 1.5 && e === 1 && is1D && <Chip tone="teal">ogʻir → yengil tezlashadi (2× gacha)</Chip>}
            {m2 > m1 * 1.5 && e === 1 && is1D && <Chip tone="gold">yengil → ogʻir: A orqaga qaytadi</Chip>}
          </div>
        </div>

        {/* caption / micro-lesson */}
        <p className="rounded-[14px] border border-void-500 bg-void-800 px-3.5 py-2.5 text-[13px] leading-relaxed text-void-200">
          {variant === "both"
            ? "Yonma-yon: chapda — aniq analitik fizika (formula bilan yechilgan), oʻngda — matter-js dvigateli. Eʼtibor ber, matter-js raqamlari biroz «suzadi» — bu iterativ yechimning kichik xatosi."
            : variant === "hand"
              ? "Teal oʻqlar — har bir sharning impulsi (uzunligi = m·v). Yuqoridagi koʻk oʻq — umumiy impuls: u toʻqnashuvdan oʻtganda uzunligini oʻzgartirmaydi. Binafsha romb — massa markazi — zarbani sezmay, bir tekis suzib oʻtadi."
              : "Xuddi shu sahna, lekin matter-js dvigateli bilan. Eʼtibor ber: yuqoridagi impuls/energiya raqamlari biroz «suzadi» — bu iterativ yechimning kichik xatosi. Qoʻlda qurilgan variant esa formula bilan aniq yechadi."}
        </p>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- subcomponents */
function ToggleBtn({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition ${
        active ? "bg-white text-[#0b0f14] shadow-sm" : "text-slate-300 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function IconBtn({
  label, onClick, children,
}: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-slate-200 transition hover:bg-white/12 hover:text-white active:scale-90"
    >
      {children}
    </button>
  );
}

function StageFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-[14px] border border-white/8 bg-[#0b0f14]">
      <div className="w-full">{children}</div>
      <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-slate-100 backdrop-blur-sm">
        {label}
      </span>
    </div>
  );
}

function ReadoutBar({
  label, valueText, frac, fill, track, note, lostFrac,
}: {
  label: string;
  valueText: string;
  frac: number;
  fill: string;
  track: string;
  note: string;
  lostFrac?: number;
}) {
  return (
    <div className="rounded-[12px] bg-white/[0.03] px-3 py-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
        <span className="font-mono text-[12px] font-semibold tabular-nums text-slate-100">{valueText}</span>
      </div>
      <div className="relative mt-1.5 h-2.5 w-full overflow-hidden rounded-full" style={{ background: track }}>
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-[width] duration-100"
          style={{ width: `${frac * 100}%`, background: fill }}
        />
        {lostFrac !== undefined && lostFrac > 0.005 && (
          <div
            className="absolute top-0 h-full"
            style={{ left: `${frac * 100}%`, width: `${lostFrac * 100}%`, background: "repeating-linear-gradient(45deg,#d8453b,#d8453b 4px,#b5362d 4px,#b5362d 8px)" }}
          />
        )}
      </div>
      <p className="mt-1 text-[10.5px] leading-snug text-slate-400">{note}</p>
    </div>
  );
}

function Slider({
  label, value, min, max, step, unit, onChange, accent, disabled, hint, fmt,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  accent?: boolean;
  disabled?: boolean;
  hint?: string;
  fmt?: (v: number) => string;
}) {
  const display = fmt ? fmt(value) : value.toFixed(unit === "kg" || unit === "m/s" || unit === "m" ? 1 : 2);
  return (
    <div className={`rounded-[12px] border px-3 py-2 ${accent ? "border-antares-300 bg-antares-50" : "border-void-500 bg-void-700"} ${disabled ? "opacity-50" : ""}`}>
      <div className="flex items-baseline justify-between">
        <label className={`text-[12px] font-semibold ${accent ? "text-antares-700" : "text-void-200"}`}>{label}</label>
        <span className="font-mono text-[12px] tabular-nums text-void-100">
          {display}{unit && <span className="ml-0.5 text-[10px] text-void-300">{unit}</span>}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        aria-valuetext={unit ? `${display} ${unit}` : display}
        onChange={(ev) => onChange(Number(ev.target.value))}
        className="mt-1.5 w-full accent-antares-500"
      />
      {hint && <p className="mt-0.5 text-[10px] text-void-300">{hint}</p>}
    </div>
  );
}

function Chip({ tone, children }: { tone: "teal" | "green" | "red" | "gold"; children: React.ReactNode }) {
  const map = {
    teal: "bg-[#0f766e]/12 text-[#0d9488] border-[#2dd4bf]/40",
    green: "bg-[#dcf3e6] text-[#1f8a54] border-[#2fa86a]/40",
    red: "bg-[#fae3e0] text-[#c2392f] border-[#d8453b]/40",
    gold: "bg-antares-50 text-antares-700 border-antares-300",
  } as const;
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${map[tone]}`}>
      {children}
    </span>
  );
}
