// components/laboratoriya/biologiya/DnaLab.tsx
/**
 * DnaLab — Markaziy dogma laboratoriyasi (DNA → RNK → Oqsil).
 *
 * The default-export, fully self-contained biology lab for Scorpius. It owns the
 * shared DnaModel, the SINGLE requestAnimationFrame loop that drives
 * model.step(dt), and a GUIDED 3-STEP FLOW across the three cinematic stage
 * views:
 *
 *   Step 1 · "DNKni qur"      — BuildStage         (edit the DNA template)
 *   Step 2 · "Transkripsiya"  — TranscriptionStage (RNA polymerase grows mRNA)
 *   Step 3 · "Translatsiya"   — TranslationStage   (ribosome reads codons → oqsil)
 *
 * The modelʻs `stage` property is the single source of truth — it auto-advances
 * transcribe → translate → done — so this component derives the visible STEP
 * (0/1/2) from `stage` and never forks that state. A step indicator + prev/next
 * navigation, play / step / reset controls, and a speed segmented control all
 * wire to the modelʻs REAL methods (startTranscription, startTranslation,
 * backToBuild, togglePlay, stepOnce, setSpeed, reset, loadTemplate).
 *
 * Architecture (AGENTS.md): the MODEL computes, the VIEW paints. ALL biology +
 * timeline state is in DnaModel (pure TS, Property<T>). This component owns the
 * single rAF clock and the three stage views only subscribe + paint. Under
 * prefers-reduced-motion we never loop — entering an animated step calls
 * model.snap() so the learner lands on the final state with no in-between frames.
 *
 * Responsive shape (parent LabShell centres content at max-w-[1240px]):
 *   • base / mobile — single column (stage on top, step-nav + controls below).
 *   • lg+           — TWO columns: a STICKY left cinematic stage (#34d399
 *                     emerald accent) + a scrolling right column (step nav,
 *                     transport, speed, seed picker, micro-lesson).
 *
 * The orchestrator renders this inside LabShell, which already provides the
 * back link + bottom nav — this component renders NEITHER.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useProperty } from "@/lib/sim/observable/useProperty";
import { DnaModel } from "@/lib/sims/biology/dna/Model";
import { SEED_TEMPLATES } from "@/lib/sims/biology/dna/data";
import BuildStage from "./BuildStage";
import TranscriptionStage from "./TranscriptionStage";
import TranslationStage from "./TranslationStage";
import { ACCENT } from "./dnaPrimitives";

/** The three guided steps, in order. Maps onto the modelʻs `stage`. */
type StepId = "build" | "transcribe" | "translate";

const STEPS: { id: StepId; label: string; hint: string }[] = [
  { id: "build", label: "DNKni qur", hint: "Shablon zanjirini tahrirlang" },
  { id: "transcribe", label: "Transkripsiya", hint: "RNK polimeraza mRNKni oʻqiydi" },
  { id: "translate", label: "Translatsiya", hint: "Ribosoma oqsil yigʻadi" },
];

const SPEEDS = [0.5, 1, 2] as const;
const SPEED_LABEL: Record<number, string> = { 0.5: "Sekin", 1: "Oddiy", 2: "Tez" };

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Derive the visible step index (0/1/2) from the modelʻs `stage`. */
function stepIndexFor(stage: string): number {
  if (stage === "build") return 0;
  if (stage === "transcribe") return 1;
  return 2; // translate + done both live under STEP 3
}

export default function DnaLab() {
  const model = useMemo(() => new DnaModel(), []);
  const reduced = useMemo(() => prefersReducedMotion(), []);

  // subscribe to the state the chrome reacts to (stage drives the step flow)
  const stage = useProperty(model.stage);
  const playing = useProperty(model.playing);
  const speed = useProperty(model.speed);
  const template = useProperty(model.template);
  const stoppedAtStop = useProperty(model.stoppedAtStop);

  const [, setClock] = useState(0);

  // ---- single rAF loop — drives model.step(dt) and ticks the view clock.
  // The model itself caps dt at 0.033 and scales by `speed`; we only feed it a
  // monotonic frame delta. Under reduced-motion we never start the loop (the
  // step-entry handlers call model.snap() instead → no in-between frames).
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      model.step(dt);
      // Only churn React while a stage is actually animating (playing). When
      // idle/paused we keep requesting frames but skip setClock → no 60fps
      // re-render of the whole lab while the learner reads.
      if (model.playing.value) setClock(now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [model, reduced]);

  // dispose the model on unmount (frees every Propertyʻs listeners)
  useEffect(() => () => model.dispose(), [model]);

  const stepIndex = stepIndexFor(stage);
  const isAnimatedStage = stage === "transcribe" || stage === "translate";
  const isDone = stage === "done";
  const canGoForward = template.length >= 3 && (stage === "build" ? model.hasStart() : true);

  // ---- step navigation — all via the modelʻs REAL methods --------------------
  function goToStep(target: number) {
    if (target === 0) {
      model.backToBuild();
    } else if (target === 1) {
      // need an editable strand with a start codon to transcribe
      if (template.length < 3) return;
      model.startTranscription();
      if (reduced) model.snap();
    } else if (target === 2) {
      if (!model.hasStart() || model.codons().length < 1) return;
      // make sure the mRNA exists, then jump straight into translation
      model.startTranslation();
      if (reduced) model.snap();
    }
    setClock((c) => c + 1);
  }

  function nextStep() {
    if (stepIndex >= 2) return;
    goToStep(stepIndex + 1);
  }

  function prevStep() {
    if (stepIndex === 0) return;
    // the model only rewinds cleanly to build; translate → build is one hop
    goToStep(stepIndex - 1 === 1 ? 1 : 0);
  }

  // ---- transport (play / step / reset) ---------------------------------------
  function onPlay() {
    if (!isAnimatedStage) return;
    if (reduced) {
      model.snap();
      setClock((c) => c + 1);
      return;
    }
    model.togglePlay();
  }

  function onStep() {
    if (!isAnimatedStage) return;
    model.stepOnce();
    setClock((c) => c + 1);
  }

  function onReset() {
    model.reset();
    setClock((c) => c + 1);
  }

  function onSpeed(v: number) {
    model.setSpeed(v);
    setClock((c) => c + 1);
  }

  function loadSeed(bases: Parameters<DnaModel["loadTemplate"]>[0]) {
    model.loadTemplate(bases);
    setClock((c) => c + 1);
  }

  // which stage view to paint (translate + done share the translation view)
  const StageView =
    stage === "build"
      ? BuildStage
      : stage === "transcribe"
        ? TranscriptionStage
        : TranslationStage;

  const peptideLen = isDone ? model.peptide().length : 0;

  return (
    <div className="flex w-full flex-col gap-3 pb-2 lg:grid lg:grid-cols-[minmax(0,1.55fr)_minmax(330px,1fr)] lg:items-start lg:gap-6">
      {/* ============================================================
       *  LEFT COLUMN — sticky cinematic stage (emerald accent)
       * ========================================================== */}
      <div className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-4 lg:self-start">
        <div
          className="relative flex flex-col overflow-hidden rounded-[22px] border border-void-600 bg-[#0b0f14] shadow-[0_10px_40px_-12px_rgba(15,40,30,0.5)] lg:min-h-[460px]"
          style={{ borderColor: stepIndex > 0 ? `${ACCENT}55` : undefined }}
        >
          {/* stage header — step crumb + live status pill */}
          <div className="flex items-center justify-between gap-2 border-b border-white/5 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold"
                style={{ background: ACCENT, color: "#08130d" }}
              >
                {stepIndex + 1}
              </span>
              <span className="text-[13px] font-semibold text-void-100">
                {STEPS[stepIndex].label}
              </span>
            </div>
            <span
              className="rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold"
              style={{
                borderColor: `${ACCENT}40`,
                background: `${ACCENT}14`,
                color: ACCENT,
              }}
            >
              {stage === "build"
                ? "tahrirlash"
                : stage === "transcribe"
                  ? playing
                    ? "transkripsiya…"
                    : "toʻxtatilgan"
                  : stage === "translate"
                    ? playing
                      ? "translatsiya…"
                      : "toʻxtatilgan"
                    : stoppedAtStop
                      ? "oqsil tayyor ✓"
                      : "tugadi ✓"}
            </span>
          </div>

          {/* the active stage view (each subscribes to the model + paints) */}
          <div className="relative flex flex-1 items-stretch justify-center">
            <StageView model={model} />
          </div>
        </div>

        {/* ===== transport controls (animated steps only) ===== */}
        {isAnimatedStage && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onPlay}
              className="inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-[14px] font-bold text-[#08130d] shadow-sm transition active:scale-95"
              style={{ background: ACCENT }}
            >
              {reduced ? "⏭ Yakuniga oʻt" : playing ? "⏸ Toʻxtatish" : "▶ Yugurtirish"}
            </button>
            <button
              type="button"
              onClick={onStep}
              disabled={reduced}
              title={reduced ? "Reduced-motion rejimida qadamlash oʻchirilgan" : undefined}
              className={`rounded-full border px-4 py-2 text-[14px] font-semibold transition active:scale-95 ${
                reduced
                  ? "cursor-not-allowed border-void-600 bg-void-800 text-void-300 opacity-50"
                  : "border-void-600 bg-void-800 text-void-200 hover:border-void-400"
              }`}
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
            <div
              className="ml-auto inline-flex items-center gap-1 rounded-full border border-void-500 bg-void-700 p-0.5"
              role="group"
              aria-label="Tezlik"
            >
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSpeed(s)}
                  disabled={reduced}
                  aria-pressed={speed === s}
                  title={reduced ? "Tezlik reduced-motion rejimida amal qilmaydi" : undefined}
                  className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold tabular-nums transition ${
                    reduced
                      ? "cursor-not-allowed text-void-400 opacity-60"
                      : speed === s
                        ? "text-[#08130d] shadow-sm"
                        : "text-void-300 hover:text-void-100"
                  }`}
                  style={speed === s && !reduced ? { background: ACCENT } : undefined}
                >
                  {SPEED_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* build step: a single primary affordance to start the timeline */}
        {stage === "build" && (
          <button
            type="button"
            onClick={() => goToStep(1)}
            disabled={!canGoForward}
            className={`w-full rounded-[14px] px-4 py-3 text-[15px] font-bold transition active:scale-[0.98] ${
              canGoForward
                ? "text-[#08130d] shadow-[0_2px_0_#0f7a52]"
                : "cursor-not-allowed bg-void-700 text-void-300"
            }`}
            style={canGoForward ? { background: ACCENT } : undefined}
          >
            {template.length < 3
              ? "Avval shablonni 3+ asosgacha toʻldiring"
              : !model.hasStart()
                ? "AUG start kodoni kerak — shablonni sozlang"
                : "Transkripsiyani boshlash →"}
          </button>
        )}

        {/* done step: a clear restart affordance */}
        {isDone && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => goToStep(0)}
              className="inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-[14px] font-bold text-[#08130d] shadow-sm transition active:scale-95"
              style={{ background: ACCENT }}
            >
              ↺ Yangi DNK quring
            </button>
            <span className="text-[12.5px] text-void-300">
              {peptideLen > 0
                ? `Ushbu DNK ${peptideLen} ta amino kislotali oqsil yasadi.`
                : "Bu shablon oqsil hosil qilmadi — boshqasini sinab koʻring."}
            </span>
          </div>
        )}
      </div>

      {/* ============================================================
       *  RIGHT COLUMN — step nav · seed picker · micro-lesson
       * ========================================================== */}
      <div className="flex min-w-0 flex-col gap-3">
        {/* ===== step indicator / navigation ===== */}
        <div className="rounded-[18px] border border-void-500 bg-void-800 p-3">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-void-300">
            Bosqichlar
          </p>
          <ol className="flex flex-col gap-1.5">
            {STEPS.map((s, i) => {
              const isActive = i === stepIndex;
              const isPast = i < stepIndex;
              // a step is reachable if itʻs the current/previous, or the next
              // one weʻre allowed to advance into (gate on a start codon)
              const reachable =
                i <= stepIndex || (i === stepIndex + 1 && canGoForward) || (i <= 2 && stepIndex === 2);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => reachable && goToStep(i)}
                    disabled={!reachable}
                    aria-current={isActive ? "step" : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-[12px] border px-3 py-2 text-left transition active:scale-[0.99] ${
                      isActive
                        ? "border-emerald-400/60 bg-emerald-400/10"
                        : reachable
                          ? "border-void-500 bg-void-700 hover:border-emerald-400/40"
                          : "cursor-not-allowed border-void-600 bg-void-800 opacity-55"
                    }`}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                      style={{
                        background: isActive || isPast ? ACCENT : "transparent",
                        color: isActive || isPast ? "#08130d" : "#7e8aa0",
                        boxShadow:
                          isActive || isPast ? "none" : "inset 0 0 0 1.5px rgba(255,255,255,0.14)",
                      }}
                    >
                      {isPast ? "✓" : i + 1}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span
                        className={`text-[13px] font-semibold ${
                          isActive ? "text-emerald-200" : "text-void-100"
                        }`}
                      >
                        {s.label}
                      </span>
                      <span className="truncate text-[11px] text-void-300">{s.hint}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {/* prev / next quick nav */}
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={prevStep}
              disabled={stepIndex === 0}
              className={`flex-1 rounded-[10px] border px-3 py-1.5 text-[12.5px] font-semibold transition active:scale-95 ${
                stepIndex === 0
                  ? "cursor-not-allowed border-void-600 bg-void-800 text-void-300 opacity-50"
                  : "border-void-500 bg-void-700 text-void-200 hover:border-void-400"
              }`}
            >
              ← Orqaga
            </button>
            <button
              type="button"
              onClick={nextStep}
              disabled={stepIndex >= 2 || !canGoForward}
              className={`flex-1 rounded-[10px] px-3 py-1.5 text-[12.5px] font-semibold transition active:scale-95 ${
                stepIndex >= 2 || !canGoForward
                  ? "cursor-not-allowed bg-void-700 text-void-300 opacity-60"
                  : "text-[#08130d]"
              }`}
              style={stepIndex < 2 && canGoForward ? { background: ACCENT } : undefined}
            >
              Keyingi →
            </button>
          </div>
        </div>

        {/* ===== seed template picker (only meaningful while building) ===== */}
        <div className="rounded-[18px] border border-void-500 bg-void-800 p-3">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-void-300">
            Tayyor genlar
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SEED_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => loadSeed(t.template)}
                className="rounded-full border border-void-500 bg-void-700 px-3 py-1.5 text-[12px] font-semibold text-void-200 transition hover:border-emerald-400/50 hover:text-void-100 active:scale-95"
              >
                {t.labelUz}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-snug text-void-300">
            Har biri AUG bilan boshlanib STOP bilan tugaydi — toʻliq kichik oqsil hosil boʻladi.
          </p>
        </div>

        {/* ===== micro-lesson caption (contextual to the step) ===== */}
        <p className="rounded-[14px] border border-void-500 bg-void-800 px-3.5 py-2.5 text-[13px] leading-relaxed text-void-200">
          {stage === "build" ? (
            <>
              Asoslar <span className="text-emerald-300">A–T</span> va{" "}
              <span className="text-emerald-300">G–C</span> boʻlib juftlashadi. Shablonni bosib
              oʻzgartiring — komplementar zanjir va mRNK jonli yangilanadi.
            </>
          ) : stage === "transcribe" ? (
            <>
              RNK polimeraza shablonni oʻqiydi va mRNKni juftlanish bilan oʻstiradi:{" "}
              <span className="font-mono text-emerald-300">A→U · T→A · G→C · C→G</span>. RNKda{" "}
              <span className="text-orange-300">U</span> (urasil) T oʻrnini egallaydi.
            </>
          ) : stage === "translate" ? (
            <>
              Ribosoma mRNKni har <span className="text-emerald-300">3 ta asos</span> (kodon) boʻyicha
              oʻqiydi. Har kodonga mos tRNA oʻz amino kislotasini olib keladi — oqsil zanjiri
              AUGʻdan oʻsadi, STOP kodonida toʻxtaydi.
            </>
          ) : (
            <>
              Markaziy dogma tugadi:{" "}
              <span className="font-semibold text-emerald-300">DNK → RNK → Oqsil</span>. Shablonni
              oʻzgartirib boshqa oqsil yasashga harakat qiling.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
