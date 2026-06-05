// components/laboratoriya/biologiya/TranscriptionStage.tsx
/**
 * TranscriptionStage — STEP 2 "Transkripsiya".
 *
 * The DNA unzips and RNA polymerase walks the template strand left→right,
 * building an mRNA strand by complementary pairing (DNA A→U, T→A, G→C, C→G).
 * The mRNA grows base-by-base, driven by the model's `transcribed` counter
 * (advanced only in model.step on the parent's single rAF loop). The newest
 * base eases in by the fractional part of that counter — real timeline motion,
 * no CSS keyframes.
 *
 * Pure view: all pairing is in the model/data; this only paints.
 */
"use client";

import { useProperty } from "@/lib/sim/observable/useProperty";
import type { DnaModel } from "@/lib/sims/biology/dna/Model";
import { complementDNA } from "@/lib/sims/biology/dna/data";
import { BaseChip, BackboneRail, ACCENT, smooth } from "./dnaPrimitives";

const CHIP = 28;
const GAP = 5;
const STRIDE = CHIP + GAP;

export default function TranscriptionStage({ model }: { model: DnaModel }) {
  const template = useProperty(model.template);
  const transcribed = useProperty(model.transcribed);

  const mrna = model.mrna();
  const n = mrna.length;
  const done = Math.floor(transcribed); // fully placed mRNA bases
  const frac = transcribed - done; // ease of the newest base
  const polyPos = Math.min(transcribed, n); // polymerase head, in base units

  // unzip: bases ahead of the polymerase are still paired (closed); bases the
  // polymerase has passed are open (template exposed). We nudge the coding
  // strand up where it's been read, suggesting the bubble.
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-3 py-5">
      <div className="relative w-full max-w-full overflow-x-auto pb-1">
        <div
          className="relative mx-auto flex flex-col items-center gap-1"
          style={{ width: 18 + n * STRIDE + 18 }}
        >
          {/* coding (sense) strand — lifts away as the bubble opens */}
          <div className="flex items-center gap-1.5 self-center">
            <BackboneRail label="3′" tone="#9aa0b4" />
            <div className="flex" style={{ gap: GAP }}>
              {template.map((b, i) => {
                const open = i < polyPos; // already transcribed → strand opened
                return (
                  <span
                    key={i}
                    className="transition-transform duration-150"
                    style={{ transform: open ? "translateY(-7px)" : "none", opacity: open ? 0.65 : 0.85 }}
                  >
                    <BaseChip base={complementDNA(b)} size={CHIP} />
                  </span>
                );
              })}
            </div>
            <BackboneRail label="5′" tone="#9aa0b4" />
          </div>

          {/* growing mRNA — sits between the strands, newest base eases in */}
          <div className="relative flex items-center gap-1.5 self-center" style={{ minHeight: CHIP + 6 }}>
            <span style={{ width: 14 }} />
            <div className="relative flex" style={{ gap: GAP, height: CHIP }}>
              {mrna.map((rb, i) => {
                if (i > done) return <span key={i} style={{ width: CHIP }} />;
                const isNewest = i === done && frac > 0 && frac < 1;
                const e = isNewest ? smooth(frac) : 1;
                return (
                  <span
                    key={i}
                    style={{
                      transform: isNewest ? `translateY(${(1 - e) * -18}px) scale(${0.7 + 0.3 * e})` : "none",
                      opacity: isNewest ? e : 1,
                    }}
                  >
                    <BaseChip base={rb} rna size={CHIP} active={i === done - 1 || isNewest} />
                  </span>
                );
              })}
            </div>
            <span style={{ width: 14 }} />

            {/* RNA polymerase head — a translucent emerald cursor on the template */}
            <Polymerase x={14 + polyPos * STRIDE} />
          </div>

          {/* template strand (read 3'→5' by polymerase; shown L→R) */}
          <div className="flex items-center gap-1.5 self-center">
            <BackboneRail label="5′" tone="#7dd3c0" />
            <div className="flex" style={{ gap: GAP }}>
              {template.map((b, i) => (
                <BaseChip key={i} base={b} size={CHIP} active={i === Math.floor(polyPos) && polyPos < n} />
              ))}
            </div>
            <BackboneRail label="3′" tone="#7dd3c0" />
          </div>
        </div>
      </div>

      {/* legend / pairing being applied right now */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-void-300">
        <span className="font-semibold text-emerald-300">RNK polimeraza</span>
        <span>shablonni oʻqiydi · mRNK juftlanish bilan oʻsadi</span>
        <span className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-[10.5px]">
          A→<span className="text-orange-300">U</span> · T→A · G→C · C→G
        </span>
      </div>

      {/* the mRNA so far, big + legible */}
      <div className="w-full max-w-[520px] rounded-[12px] border border-white/8 bg-white/[0.02] px-3 py-2 text-center">
        <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-void-300">
          mRNK ({done}/{n})
        </div>
        <div className="font-mono text-[15px] tracking-[0.12em] text-orange-200">
          {mrna.slice(0, done).join("")}
          <span className="text-void-400">{mrna.slice(done).map(() => "·").join("")}</span>
        </div>
      </div>
    </div>
  );
}

/** A soft emerald polymerase cursor that rides the strand. */
function Polymerase({ x }: { x: number }) {
  return (
    <span
      className="pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 transition-[left] duration-100"
      style={{ left: x - CHIP / 2 - 4, width: CHIP + 8, height: CHIP + 22 }}
      aria-hidden
    >
      <span
        className="block h-full w-full rounded-[10px]"
        style={{
          background: `radial-gradient(circle, ${ACCENT}33, ${ACCENT}10 60%, transparent 72%)`,
          boxShadow: `0 0 18px ${ACCENT}55`,
        }}
      />
    </span>
  );
}
