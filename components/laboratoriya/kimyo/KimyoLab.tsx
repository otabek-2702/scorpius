// components/laboratoriya/kimyo/KimyoLab.tsx
/**
 * KimyoLab — Kimyo laboratoriyasi (default export, self-contained, no props).
 *
 * The learner drags element tiles into a reaction chamber (or taps a featured
 * reaction chip). When the gathered atoms equal a known balanced reaction the
 * "Reaksiya" affordance lights up; running it plays the assembly animation —
 * atoms fly together into the real molecular geometry, bonds form, and an
 * energy flash fires scaled by ΔH. A live left = right atom-balance ledger
 * teaches conservation of mass (PhET "Reactants, Products and Leftovers").
 *
 * Headline feature: a VARIANT COMPARE TOGGLE swaps the SAME phenomenon between
 *   A "⚙️ Qoʻlda qurilgan" — hand-built analytic SVG + canvas (ChemistryHand)
 *   B "📦 Kutubxona"       — 3Dmol.js WebGL ball-and-stick (ChemistryLib)
 *   C "🔬 Ikkalasi" (lg+)  — both side by side for a direct realism compare.
 *
 * Layout: mobile = single column (preserved). md = full-width stage + 2-col
 * controls. lg = TWO columns — a STICKY left column (cinematic chamber +
 * transport + balance/energy readout) and a scrolling right column (variant,
 * featured chips, palette, VSEPR readout, real-world hook).
 *
 * Toolbar (inside the stage): FULLSCREEN (Fullscreen API on the stage, re-fits
 * both views) + SOUND mute toggle (Web Audio SFX synthesised on the fly, no
 * asset files, lazily created on first gesture, persisted to localStorage).
 *
 * State persists to the URL query + localStorage (reaction + variant + speed),
 * restored on mount — implemented without useSearchParams (no Suspense).
 *
 * Architecture (AGENTS.md): ChemistryModel owns the state machine + eased poses
 * as Property<T>; this component owns the SINGLE requestAnimationFrame loop that
 * calls model.step(dt) and feeds both views a monotonic clock. The views only
 * paint. prefers-reduced-motion → model.snap() (jump to product, no animation).
 */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Gauge,
} from "lucide-react";
import { useProperty } from "@/lib/sim/observable/useProperty";
import { ChemistryModel, FEATURED } from "@/lib/sims/chemistry/Model";
import { ATOMS, PALETTE, balanceOf } from "@/lib/sims/chemistry/data";
import ChemistryHand from "./ChemistryHand";
import ChemistryLib from "./ChemistryLib";

/** Variant A (hand), B (3Dmol), or both side-by-side (lg+ only). */
type Variant = "hand" | "lib" | "both";
type SpeedKey = "slow" | "normal" | "fast";

const SPEEDS: Record<SpeedKey, number> = { slow: 0.5, normal: 1, fast: 2 };
const SPEED_LABEL: Record<SpeedKey, string> = {
  slow: "Sekin",
  normal: "Oddiy",
  fast: "Tez",
};

const LS_KEY = "scorpius.kimyo.v2";
const VALID_VARIANTS: Variant[] = ["hand", "lib", "both"];
const VALID_SPEEDS: SpeedKey[] = ["slow", "normal", "fast"];

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ============================================================
 * Web Audio SFX — synthesised, no asset files. Lazily created on
 * the first user gesture (autoplay policy). Low volumes. Mute is
 * persisted; reduced-motion defaults to muted.
 * ========================================================== */
type Sfx = "tick" | "react" | "bloom" | "clear" | "ui";

function readInitialMuted(reduced: boolean): boolean {
  // default: muted if reduced-motion, else unmuted — persisted value overrides
  if (typeof window === "undefined") return true;
  let initial = !reduced;
  try {
    const raw = window.localStorage.getItem(`${LS_KEY}.muted`);
    if (raw === "1") initial = true;
    else if (raw === "0") initial = false;
  } catch {
    /* storage blocked */
  }
  return initial;
}

function useLabAudio(reduced: boolean) {
  const [muted, setMuted] = useState<boolean>(() => readInitialMuted(reduced));
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const mutedRef = useRef<boolean>(muted);

  const ensureCtx = useCallback(() => {
    if (ctxRef.current) return ctxRef.current;
    if (typeof window === "undefined") return null;
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    ctxRef.current = ctx;
    masterRef.current = master;
    return ctx;
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      mutedRef.current = next;
      try {
        window.localStorage.setItem(`${LS_KEY}.muted`, next ? "1" : "0");
      } catch {
        /* storage blocked */
      }
      // creating the context on this gesture satisfies autoplay policy
      if (!next) {
        const ctx = ensureCtx();
        if (ctx && ctx.state === "suspended") void ctx.resume();
      }
      return next;
    });
  }, [ensureCtx]);

  const play = useCallback(
    (kind: Sfx) => {
      if (mutedRef.current) return;
      const ctx = ensureCtx();
      const master = masterRef.current;
      if (!ctx || !master) return;
      if (ctx.state === "suspended") void ctx.resume();
      const t0 = ctx.currentTime;

      const blip = (
        freq: number,
        dur: number,
        type: OscillatorType,
        gain: number,
        slideTo?: number,
        delay = 0,
      ) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0 + delay);
        if (slideTo)
          osc.frequency.exponentialRampToValueAtTime(
            Math.max(1, slideTo),
            t0 + delay + dur,
          );
        g.gain.setValueAtTime(0.0001, t0 + delay);
        g.gain.exponentialRampToValueAtTime(gain, t0 + delay + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + dur);
        osc.connect(g);
        g.connect(master);
        osc.start(t0 + delay);
        osc.stop(t0 + delay + dur + 0.02);
      };

      switch (kind) {
        case "tick":
          blip(420, 0.07, "triangle", 0.05);
          break;
        case "ui":
          blip(660, 0.05, "sine", 0.035);
          break;
        case "react":
          // rising swell — atoms gathering momentum
          blip(180, 0.5, "sawtooth", 0.04, 520);
          blip(360, 0.5, "sine", 0.025, 880, 0.04);
          break;
        case "bloom": {
          // bright energy release: a warm noise burst + chime
          const buf = ctx.createBuffer(
            1,
            ctx.sampleRate * 0.35,
            ctx.sampleRate,
          );
          const data = buf.getChannelData(0);
          for (let i = 0; i < data.length; i++) {
            const env = Math.pow(1 - i / data.length, 2.4);
            data[i] = (Math.random() * 2 - 1) * env;
          }
          const noise = ctx.createBufferSource();
          noise.buffer = buf;
          const bp = ctx.createBiquadFilter();
          bp.type = "bandpass";
          bp.frequency.value = 1400;
          bp.Q.value = 0.7;
          const ng = ctx.createGain();
          ng.gain.value = 0.12;
          noise.connect(bp);
          bp.connect(ng);
          ng.connect(master);
          noise.start(t0);
          blip(880, 0.4, "sine", 0.05, 1320, 0.02);
          break;
        }
        case "clear":
          blip(300, 0.18, "sine", 0.04, 140);
          break;
      }
    },
    [ensureCtx],
  );

  // tear down on unmount
  useEffect(() => {
    return () => {
      const ctx = ctxRef.current;
      if (ctx && ctx.state !== "closed") void ctx.close();
      ctxRef.current = null;
      masterRef.current = null;
    };
  }, []);

  return { muted, toggleMute, play };
}

/* ============================================================
 * Fullscreen on a target element. Tracks the active state and
 * re-fires a callback on enter/exit/Esc so views can re-measure.
 * ========================================================== */
function useFullscreen(
  ref: React.RefObject<HTMLElement | null>,
  onChange?: (active: boolean) => void,
) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const handler = () => {
      const fsEl = document.fullscreenElement;
      const isActive = !!fsEl && fsEl === ref.current;
      setActive(isActive);
      onChange?.(isActive);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, [ref, onChange]);

  const toggle = useCallback(() => {
    const el = ref.current;
    if (typeof document === "undefined" || !el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen?.();
    } else {
      void el.requestFullscreen?.();
    }
  }, [ref]);

  return { active, toggle };
}

/* ============================================================
 * Persistence + deep-link (no useSearchParams → no Suspense).
 * Reads new URLSearchParams(window.location.search) on mount,
 * falls back to localStorage; writes both on change.
 * ========================================================== */
interface PersistedState {
  reaction: string | null;
  variant: Variant;
  speed: SpeedKey;
}

function readInitialState(): PersistedState {
  const fallback: PersistedState = {
    reaction: null,
    variant: "hand",
    speed: "normal",
  };
  if (typeof window === "undefined") return fallback;

  let variant: Variant = fallback.variant;
  let speed: SpeedKey = fallback.speed;
  let reaction: string | null = null;

  // localStorage first (durable), then URL (shareable) overrides
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (raw) {
      const j = JSON.parse(raw) as Partial<PersistedState>;
      if (j.variant && VALID_VARIANTS.includes(j.variant)) variant = j.variant;
      if (j.speed && VALID_SPEEDS.includes(j.speed)) speed = j.speed;
      if (typeof j.reaction === "string") reaction = j.reaction;
    }
  } catch {
    /* ignore */
  }

  try {
    const q = new URLSearchParams(window.location.search);
    const qv = q.get("variant");
    const qs = q.get("speed");
    const qr = q.get("r");
    if (qv && VALID_VARIANTS.includes(qv as Variant)) variant = qv as Variant;
    if (qs && VALID_SPEEDS.includes(qs as SpeedKey)) speed = qs as SpeedKey;
    if (qr) reaction = qr;
  } catch {
    /* ignore */
  }

  // "both" only makes sense on lg+; collapse to hand below the breakpoint
  if (variant === "both" && window.innerWidth < 1024) variant = "hand";
  // validate reaction id against the known set
  if (reaction && !FEATURED.some((r) => r.id === reaction)) reaction = null;

  return { reaction, variant, speed };
}

/* ============================================================ */

export default function KimyoLab() {
  const model = useMemo(() => new ChemistryModel(), []);
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const initial = useMemo(() => readInitialState(), []);

  const [variant, setVariant] = useState<Variant>(initial.variant);
  const [speed, setSpeed] = useState<SpeedKey>(initial.speed);
  const [clock, setClock] = useState(0);
  const [dragEl, setDragEl] = useState<string | null>(null);
  const [hoverChamber, setHoverChamber] = useState(false);
  const [canBoth, setCanBoth] = useState(false); // lg+ gate for compare mode

  const stageRef = useRef<HTMLDivElement | null>(null);
  const { muted, toggleMute, play } = useLabAudio(reduced);

  const phase = useProperty(model.phase);
  const matched = useProperty(model.matched);
  const activeId = useProperty(model.activeId);
  const tray = useProperty(model.tray);
  const progress = useProperty(model.progress);
  const flash = useProperty(model.flash);
  const interactions = useProperty(model.interactionCount);

  // ---- fullscreen on the stage; re-fit handled by views via ResizeObserver --
  const onFsChange = useCallback(() => {
    // nudge a clock tick so views re-measure promptly after the layout settles
    requestAnimationFrame(() => setClock((c) => c + 1));
  }, []);
  const { active: isFs, toggle: toggleFs } = useFullscreen(stageRef, onFsChange);

  // ---- apply assembly speed to the model -----------------------------------
  useEffect(() => {
    model.setAssemblySpeed(SPEEDS[speed]);
  }, [model, speed]);

  // ---- single rAF loop drives model.step(dt) + feeds both views the clock ---
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      model.step(dt);
      setClock(now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [model, reduced]);

  useEffect(() => () => model.dispose(), [model]);

  // ---- track lg breakpoint to gate the "Ikkalasi" compare option -----------
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => {
      setCanBoth(mq.matches);
      // if we drop below lg while in compare mode, fall back to hand
      if (!mq.matches) setVariant((v) => (v === "both" ? "hand" : v));
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // ---- restore the deep-linked reaction once, after mount ------------------
  useEffect(() => {
    if (initial.reaction) model.loadReaction(initial.reaction);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  // ---- persist variant + speed + reaction to URL + localStorage ------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    const state: PersistedState = {
      reaction: activeId ?? null,
      variant,
      speed,
    };
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("variant", variant);
      url.searchParams.set("speed", speed);
      if (activeId) url.searchParams.set("r", activeId);
      else url.searchParams.delete("r");
      window.history.replaceState(null, "", url.toString());
    } catch {
      /* ignore */
    }
  }, [variant, speed, activeId]);

  // ---- SFX wiring: watch model transitions via prev-value refs -------------
  const prevPhase = useRef(phase);
  const prevInteractions = useRef(interactions);
  const bloomFired = useRef(false);

  useEffect(() => {
    // a new interaction while gathering = a soft tick (add/remove atom)
    if (
      interactions !== prevInteractions.current &&
      (phase === "idle" || phase === "armed")
    ) {
      play("tick");
    }
    prevInteractions.current = interactions;
  }, [interactions, phase, play]);

  useEffect(() => {
    if (phase !== prevPhase.current) {
      if (phase === "assembling") {
        play("react");
        bloomFired.current = false;
      } else if (phase === "idle" && prevPhase.current === "product") {
        play("clear");
      }
      prevPhase.current = phase;
    }
  }, [phase, play]);

  useEffect(() => {
    // fire the bloom SFX once when the energy flash crosses its threshold
    if (!bloomFired.current && flash > 0.12 && matched && phase === "assembling") {
      bloomFired.current = true;
      play(matched.slow ? "react" : "bloom");
    }
  }, [flash, matched, phase, play]);

  function runReaction() {
    if (reduced) {
      model.snap();
      if (matched) play(matched.slow ? "react" : "bloom");
      setClock((c) => c + 1);
      return;
    }
    model.react();
  }

  // gathered atom counts for the chamber-contents readout
  const gathered = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of tray) c[a.el] = (c[a.el] ?? 0) + 1;
    return c;
  }, [tray]);

  const balance = matched ? balanceOf(matched) : null;
  const balanced = true; // every dataset reaction is balanced by construction
  const energyNow = matched
    ? Math.round((phase === "product" ? 1 : progress) * Math.abs(matched.dH))
    : 0;
  const energyFrac = phase === "product" ? 1 : progress;

  return (
    <div className="flex w-full flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,1fr)] lg:items-start lg:gap-6">
      {/* ============================================================
       *  LEFT COLUMN — sticky cinematic chamber + transport + readout
       * ========================================================== */}
      <div className="flex flex-col gap-3 lg:sticky lg:top-4 lg:self-start">
        {/* ===== STAGE ===== */}
        <div
          ref={stageRef}
          className={`relative flex flex-col overflow-hidden border bg-[#0b0f14] transition-colors lg:min-h-[460px] ${
            isFs ? "justify-center rounded-none" : "rounded-[18px]"
          } ${
            hoverChamber
              ? "border-antares-500 ring-2 ring-antares-300/40"
              : "border-void-600"
          }`}
          onDragOver={(e) => {
            if (dragEl) {
              e.preventDefault();
              setHoverChamber(true);
            }
          }}
          onDragLeave={() => setHoverChamber(false)}
          onDrop={(e) => {
            e.preventDefault();
            setHoverChamber(false);
            if (dragEl) model.addAtom(dragEl);
            setDragEl(null);
          }}
        >
          {/* ---- stage toolbar (fullscreen + sound) ---- */}
          <div className="pointer-events-none absolute right-2 top-2 z-20 flex gap-1.5">
            <StageBtn
              onClick={toggleMute}
              label={muted ? "Ovozni yoqish" : "Ovozni oʻchirish"}
            >
              {muted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </StageBtn>
            <StageBtn
              onClick={toggleFs}
              label={isFs ? "Toʻliq ekrandan chiqish" : "Toʻliq ekran"}
            >
              {isFs ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </StageBtn>
          </div>

          {/* ---- the render surface(s) ----
              The 3Dmol viewer leaks its WebGL context + global listeners on
              teardown (no dispose()), so we construct it AT MOST ONCE per visit:
              the ChemistryLib instance stays MOUNTED across hand⇄lib⇄both and is
              only visually hidden when the active variant excludes the library
              view (`hidden` class). To keep its WebGL context alive across
              toggles the element must hold a STABLE position in the tree, so we
              always render the same wrapper chain (a relative cell with an
              optional label overlay) regardless of variant — never re-parenting
              it. The hand SVG/canvas is cheap, so it mounts conditionally.
              Exactly ONE ChemistryLib element exists at all times, incl. "Ikkalasi". */}
          {(() => {
            const both = variant === "both" && canBoth;
            const showLib = variant === "lib" || both;
            const showHand = variant === "hand" || both;
            return (
              <div className={both ? "grid w-full grid-cols-2 gap-px bg-white/5" : "w-full"}>
                {/* hand cell — cheap to mount/unmount, so only when shown.
                    Stable key so React never confuses it with the lib cell. */}
                {showHand && (
                  <SurfaceCell key="hand" label={both ? "⚙️ Qoʻlda qurilgan" : undefined}>
                    <ChemistryHand model={model} clock={clock} />
                  </SurfaceCell>
                )}

                {/* lib cell — ALWAYS mounted (single 3Dmol viewer); only the
                    visibility + label change, so the viewer is never re-parented.
                    A stable key pins its identity across variant changes. */}
                <SurfaceCell
                  key="lib"
                  label={both ? "📦 3Dmol kutubxona" : undefined}
                  hidden={!showLib}
                >
                  <ChemistryLib model={model} clock={clock} />
                </SurfaceCell>
              </div>
            );
          })()}

          {/* drop hint while dragging */}
          {hoverChamber && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <span className="rounded-full bg-antares-500/90 px-4 py-1.5 text-[13px] font-semibold text-void-950">
                Shu yerga tashlang
              </span>
            </div>
          )}
        </div>

        {/* ===== transport controls (run / clear) ===== */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={phase !== "armed"}
            onClick={runReaction}
            className={`flex-1 rounded-[14px] px-4 py-3 text-[15px] font-bold transition active:scale-[0.98] ${
              phase === "armed"
                ? "bg-antares-500 text-void-950 shadow-[0_2px_0_#b87d10] hover:bg-antares-300"
                : "cursor-not-allowed bg-void-700 text-void-300"
            }`}
          >
            {phase === "assembling"
              ? "Yigʻilmoqda…"
              : phase === "product"
                ? "Reaksiya tugadi ✓"
                : phase === "armed"
                  ? "⚡ Reaksiyani boshlash"
                  : "Reaksiya — avval atomlarni jamlang"}
          </button>
          <button
            type="button"
            onClick={() => {
              model.clearChamber();
              play("clear");
            }}
            className="rounded-[14px] border border-void-500 bg-void-800 px-4 py-3 text-[14px] font-semibold text-void-200 transition hover:border-void-400 active:scale-95"
          >
            Tozalash
          </button>
        </div>

        {/* ===== equation + energy + conservation readout strip ===== */}
        {matched ? (
          <div className="rounded-[16px] border border-void-500 bg-void-800 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-mono text-[18px] font-semibold tabular-nums text-void-100">
                {matched.equation}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    matched.exo
                      ? "bg-[#fdecc8] text-[#b5651a]"
                      : "bg-[#dbe9ff] text-[#2563c9]"
                  }`}
                >
                  {matched.exo ? "EKZOTERMIK" : "ENDOTERMIK"}
                </span>
                <span className="font-mono text-[14px] font-bold tabular-nums text-void-100">
                  ΔH = {matched.dH > 0 ? "+" : ""}
                  {matched.dH} kJ
                </span>
              </div>
            </div>

            {/* energy bar */}
            <div className="mt-2.5">
              <div className="mb-1 flex justify-between text-[10px] font-medium text-void-300">
                <span>chiqarilgan energiya</span>
                <span className="font-mono tabular-nums">
                  {energyNow} / {Math.abs(matched.dH)} kJ
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-void-700">
                <div
                  className="h-full rounded-full transition-[width] duration-100"
                  style={{
                    width: `${energyFrac * 100}%`,
                    background: matched.exo
                      ? "linear-gradient(to right, #f59e0b, #fbbf24)"
                      : "linear-gradient(to right, #2563eb, #60a5fa)",
                  }}
                />
              </div>
            </div>

            {/* conservation ledger: atom balance left = right */}
            {balance && (
              <div className="mt-2.5">
                <div className="mb-1 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-wide text-void-300">
                  massa saqlanishi · atomlar soni
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9.5px] ${
                      balanced
                        ? "bg-[#dcf3e6] text-[#1f8a54]"
                        : "bg-[#fae3e0] text-[#c2392f]"
                    }`}
                  >
                    {balanced ? "muvozanatda ✓" : "muvozanatsiz"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {balance.map((b) => (
                    <div
                      key={b.el}
                      className="flex items-center gap-1 rounded-[8px] border border-void-500 bg-void-700 px-2 py-1"
                    >
                      <AtomDot el={b.el} />
                      <span className="font-mono text-[11px] tabular-nums text-void-100">
                        {b.left}
                        <span className="mx-0.5 text-void-300">=</span>
                        {b.right}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <ChamberContents gathered={gathered} />
        )}
      </div>

      {/* ============================================================
       *  RIGHT COLUMN — variant · speed · chips · palette · VSEPR · hook
       * ========================================================== */}
      <div className="flex flex-col gap-3">
        {/* ===== variant compare control ===== */}
        <div className="rounded-[16px] border border-void-600 bg-void-800 p-3">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-void-300">
            Koʻrinish — qaysi biri haqiqiyroq?
          </div>
          <div className="flex flex-wrap gap-1.5 rounded-full border border-void-600 bg-void-700 p-0.5">
            <ToggleBtn active={variant === "hand"} onClick={() => setVariant("hand")}>
              ⚙️ Qoʻlda
            </ToggleBtn>
            <ToggleBtn active={variant === "lib"} onClick={() => setVariant("lib")}>
              📦 Kutubxona
            </ToggleBtn>
            {canBoth && (
              <ToggleBtn active={variant === "both"} onClick={() => setVariant("both")}>
                🔬 Ikkalasi
              </ToggleBtn>
            )}
          </div>
          <span className="mt-1.5 block text-[10.5px] leading-snug text-void-300">
            A = aniq analitik kimyo/animatsiya · B = 3Dmol WebGL dvigateli
            {canBoth && " · C = yonma-yon solishtiring"}
          </span>
        </div>

        {/* ===== assembly speed control ===== */}
        <div className="rounded-[16px] border border-void-600 bg-void-800 p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-void-300">
            <Gauge className="h-3.5 w-3.5" />
            Yigʻilish tezligi
          </div>
          <div className="flex gap-1.5">
            {(Object.keys(SPEEDS) as SpeedKey[]).map((k) => (
              <button
                key={k}
                type="button"
                disabled={reduced}
                title={
                  reduced
                    ? "Animatsiya tezligi reduced-motion rejimida amal qilmaydi"
                    : undefined
                }
                onClick={() => {
                  setSpeed(k);
                  play("ui");
                }}
                className={`flex-1 rounded-[10px] border px-2 py-1.5 text-[12px] font-semibold transition active:scale-95 ${
                  reduced
                    ? "cursor-not-allowed border-void-600 bg-void-700 text-void-300 opacity-50"
                    : speed === k
                      ? "border-antares-500 bg-antares-50 text-antares-700"
                      : "border-void-500 bg-void-700 text-void-200 hover:border-antares-400"
                }`}
              >
                {SPEED_LABEL[k]}
              </button>
            ))}
          </div>
          {reduced && (
            <p className="mt-1.5 text-[10.5px] leading-snug text-void-300">
              Animatsiya tezligi reduced-motion rejimida amal qilmaydi.
            </p>
          )}
        </div>

        {/* ===== featured reaction picker (chips) ===== */}
        <div className="rounded-[16px] border border-void-600 bg-void-800 p-3">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-void-300">
            Tayyor reaksiyalar
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FEATURED.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  model.loadReaction(r.id);
                  play("ui");
                }}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition active:scale-95 ${
                  activeId === r.id
                    ? "border-antares-500 bg-antares-50 text-antares-700"
                    : "border-void-500 bg-void-700 text-void-200 hover:border-antares-400 hover:bg-void-800"
                }`}
              >
                <span className="font-mono">{r.equation.split("→")[0].trim()}</span>
                <span className="mx-1 text-void-300">→</span>
                <span className="font-mono">{r.equation.split("→")[1].trim()}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ===== VSEPR shape + bond-angle readout ===== */}
        {matched && (
          <div className="rounded-[16px] border border-void-600 bg-void-800 p-3">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-void-300">
              Molekula geometriyasi · VSEPR
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
              <span className="text-void-200">
                <span className="text-void-300">Shakl:</span>{" "}
                <span className="font-semibold text-void-100">{matched.geometryUz}</span>
              </span>
              <span className="text-void-200">
                <span className="text-void-300">Tur:</span>{" "}
                <span className="font-semibold text-void-100">{matched.typeUz}</span>
              </span>
            </div>
          </div>
        )}

        {/* ===== real-world hook card ===== */}
        {matched && (
          <div className="rounded-[16px] border border-antares-300 bg-antares-50 p-3">
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-antares-700/80">
              Hayotdan
            </div>
            <p className="text-[13px] leading-relaxed text-antares-700">{matched.hookUz}</p>
          </div>
        )}

        {/* ===== element palette (drag OR click) ===== */}
        <div className="rounded-[16px] border border-void-600 bg-void-800 p-3">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-void-300">
            Elementlar — kameraga torting yoki bosing
          </div>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-9 lg:grid-cols-5">
            {PALETTE.map((el) => (
              <ElementTile
                key={el}
                el={el}
                onDragStart={() => setDragEl(el)}
                onDragEnd={() => setDragEl(null)}
                onClick={() => model.addAtom(el)}
              />
            ))}
          </div>
        </div>

        {/* footer counter + reset */}
        <div className="flex items-center justify-between text-xs text-void-300">
          <span className="font-medium">Amallar: {interactions}</span>
          <button
            type="button"
            onClick={() => {
              model.reset();
              play("clear");
            }}
            className="rounded-full border border-void-500 bg-void-700 px-3.5 py-1 font-medium text-void-200 transition hover:border-void-400 active:scale-95"
          >
            Qaytadan
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ */

function StageBtn({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/80 backdrop-blur-sm transition hover:bg-black/60 hover:text-white active:scale-90"
    >
      {children}
    </button>
  );
}

/**
 * A render-surface cell. Holds one variant view (hand or lib). When `hidden`
 * the cell is removed from layout via the `hidden` class but stays MOUNTED —
 * this is what lets the single 3Dmol viewer survive variant toggles without a
 * costly construct/destroy (which leaks a WebGL context). `label` shows the
 * compare-mode caption only in "Ikkalasi".
 */
function SurfaceCell({
  label,
  hidden = false,
  children,
}: {
  label?: string;
  hidden?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`relative bg-[#0b0f14] ${hidden ? "hidden" : ""}`}>
      {label && (
        <span className="pointer-events-none absolute left-2 top-2 z-10 rounded-full bg-black/45 px-2 py-0.5 text-[10.5px] font-semibold text-white/80 backdrop-blur-sm">
          {label}
        </span>
      )}
      {children}
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-[12px] font-semibold transition ${
        active ? "bg-void-900 text-void-100 shadow-sm" : "text-void-300 hover:text-void-200"
      }`}
    >
      {children}
    </button>
  );
}

function ChamberContents({ gathered }: { gathered: Record<string, number> }) {
  const els = Object.keys(gathered).filter((k) => gathered[k] > 0);
  return (
    <div className="rounded-[16px] border border-void-500 bg-void-800 p-3">
      {els.length === 0 ? (
        <p className="text-[13px] text-void-300">
          Kamera boʻsh. Pastdagi elementlardan tortib jamlang — masalan{" "}
          <span className="font-mono font-semibold text-void-100">4 H</span> +{" "}
          <span className="font-mono font-semibold text-void-100">2 O</span> → suv.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-medium text-void-200">Kamerada:</span>
          {els.map((el) => (
            <div
              key={el}
              className="flex items-center gap-1 rounded-[8px] border border-void-500 bg-void-700 px-2 py-1"
            >
              <AtomDot el={el} />
              <span className="font-mono text-[12px] font-semibold tabular-nums text-void-100">
                {gathered[el]} {el}
              </span>
            </div>
          ))}
          <span className="text-[11px] text-void-300">— hali tanish reaksiya yoʻq</span>
        </div>
      )}
    </div>
  );
}

function AtomDot({ el }: { el: string }) {
  const info = ATOMS[el];
  return (
    <span
      className="inline-block h-3 w-3 rounded-full"
      style={{
        background: info?.color ?? "#ccc",
        boxShadow: `inset 0 0 0 1px ${info?.stroke ?? "#888"}`,
      }}
    />
  );
}

function ElementTile({
  el,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  el: string;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  const info = ATOMS[el];
  const isWhite = el === "H";
  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className="group flex flex-col items-center gap-1 rounded-xl border border-void-500 bg-void-800 p-2 text-center transition hover:border-antares-400 hover:bg-void-700 active:scale-95"
      aria-label={`${info?.nameUz ?? el} (${el}) — kameraga qoʻshish`}
    >
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold"
        style={{
          background: `radial-gradient(circle at 35% 30%, ${lighten(info?.color ?? "#ccc", 0.45)}, ${info?.color ?? "#ccc"})`,
          color: isWhite ? "#2a2a2a" : "#0c0f13",
          boxShadow: `inset 0 0 0 1px ${info?.stroke ?? "#888"}`,
        }}
      >
        {el}
      </span>
      <span className="text-[10px] font-medium leading-none text-void-100">{info?.nameUz ?? el}</span>
    </button>
  );
}

// small color util mirrored from ChemistryHand (kept local — tiles only)
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
