// components/laboratoriya/biologiya/BuildStage.tsx
/**
 * BuildStage — STEP 1 "DNKni o'qing".
 *
 * Renders the editable DNA duplex: the learner's TEMPLATE strand on top and its
 * complementary CODING strand beneath, with the base-pairing rungs (A-T, G-C)
 * drawn between them. Tapping a template base cycles it A→T→G→C; the coding base
 * and rung update live so the pairing rule is felt, not told. A drop zone +
 * palette let the learner extend the strand by drag OR tap (touch-friendly).
 *
 * Pure view: reads model state via useProperty, edits via model methods. No
 * biology here — complement/transcription all live in the model + data.
 */
"use client";

import { useState } from "react";
import { useProperty } from "@/lib/sim/observable/useProperty";
import type { DnaModel } from "@/lib/sims/biology/dna/Model";
import {
  type Base,
  complementDNA,
  DNA_BASES,
  BASE_ORDER,
  START_CODON,
} from "@/lib/sims/biology/dna/data";
import { BaseChip, BackboneRail, ACCENT, lighten } from "./dnaPrimitives";

const CHIP = 30;
const GAP = 5;

export default function BuildStage({ model }: { model: DnaModel }) {
  const template = useProperty(model.template);
  // re-render on edits (interactionCount also bumps); template is the real dep
  useProperty(model.interactionCount);

  const coding = template.map(complementDNA);
  const mrna = model.mrna();
  const startIdx = model.startIndex();
  const hasStart = startIdx >= 0;

  const [dragBase, setDragBase] = useState<Base | null>(null);
  const [hoverDrop, setHoverDrop] = useState(false);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-5 px-4 py-5">
      {/* ---- the duplex ---- */}
      <div className="flex w-full max-w-full flex-col items-center gap-1.5 overflow-x-auto pb-1">
        {/* 5' label + template strand (editable) */}
        <div className="flex items-center gap-2">
          <BackboneRail label="5′" tone="#7dd3c0" />
          <div className="flex" style={{ gap: GAP }}>
            {template.map((b, i) => {
              const inFrame = hasStart && i >= startIdx;
              const isAug = hasStart && i >= startIdx && (i - startIdx) % 3 === 0 && i + 2 < template.length;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => model.setBase(i)}
                  className="rounded-[7px] transition active:scale-90"
                  aria-label={`Shablon ${i + 1}: ${DNA_BASES[b].nameUz} — bosib almashtiring`}
                  style={{
                    outline: isAug ? `1.5px solid ${ACCENT}aa` : "none",
                    outlineOffset: 2,
                    borderRadius: 7,
                  }}
                >
                  <BaseChip base={b} size={CHIP} dim={hasStart && !inFrame} />
                </button>
              );
            })}
          </div>
          <BackboneRail label="3′" tone="#7dd3c0" />
          <span className="ml-1 hidden text-[10px] font-semibold text-void-300 sm:inline">
            shablon (template)
          </span>
        </div>

        {/* pairing rungs */}
        <div className="flex items-center gap-2">
          <span style={{ width: 16 }} />
          <div className="flex" style={{ gap: GAP }}>
            {template.map((b, i) => (
              <span
                key={i}
                className="flex items-center justify-center"
                style={{ width: CHIP, height: 13 }}
              >
                <span
                  className="block rounded-full"
                  style={{
                    width: 2,
                    height: 11,
                    background: `linear-gradient(${DNA_BASES[b].color}, ${DNA_BASES[complementDNA(b)].color})`,
                    opacity: 0.7,
                  }}
                />
              </span>
            ))}
          </div>
          <span style={{ width: 16 }} />
        </div>

        {/* coding strand (read-only, complementary) */}
        <div className="flex items-center gap-2">
          <BackboneRail label="3′" tone="#9aa0b4" />
          <div className="flex" style={{ gap: GAP }}>
            {coding.map((b, i) => (
              <span key={i} style={{ opacity: 0.85 }}>
                <BaseChip base={b} size={CHIP} />
              </span>
            ))}
          </div>
          <BackboneRail label="5′" tone="#9aa0b4" />
          <span className="ml-1 hidden text-[10px] font-semibold text-void-300 sm:inline">
            juftlanish (komplementar)
          </span>
        </div>
      </div>

      {/* pairing rule reminder */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <PairPill a="A" b="T" />
        <PairPill a="G" b="C" />
        <span className="text-[11px] text-void-300">
          har bir asos juftini bosib almashtiring
        </span>
      </div>

      {/* mRNA / protein preview hint */}
      <div className="flex min-h-[26px] flex-wrap items-center justify-center gap-2 text-center">
        {hasStart ? (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11.5px] font-semibold text-emerald-300">
            ✓ AUG topildi — bu DNK oqsil yasaydi. Transkripsiyani boshlang →
          </span>
        ) : (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11.5px] font-semibold text-amber-300">
            Hali AUG (start kodoni) yo'q — mRNK'da {START_CODON} hosil bo'lsin (shablonda T-A-C)
          </span>
        )}
      </div>

      {/* ---- palette + drop zone ---- */}
      <div className="flex w-full max-w-[460px] flex-col items-center gap-2.5">
        <div
          onDragOver={(e) => {
            if (dragBase) {
              e.preventDefault();
              setHoverDrop(true);
            }
          }}
          onDragLeave={() => setHoverDrop(false)}
          onDrop={(e) => {
            e.preventDefault();
            setHoverDrop(false);
            if (dragBase) model.addBase(dragBase);
            setDragBase(null);
          }}
          className="flex w-full items-center justify-center rounded-[12px] border border-dashed px-3 py-2 text-[11px] font-medium transition"
          style={{
            borderColor: hoverDrop ? ACCENT : "rgba(255,255,255,0.16)",
            background: hoverDrop ? `${ACCENT}1a` : "rgba(255,255,255,0.02)",
            color: hoverDrop ? ACCENT : "#7e8aa0",
          }}
        >
          {hoverDrop ? "Shu yerga tashlang" : "asosni shu yerga torting yoki pastdan bosing"}
        </div>

        <div className="flex w-full items-center justify-center gap-2">
          {BASE_ORDER.map((b) => {
            const info = DNA_BASES[b];
            return (
              <button
                key={b}
                type="button"
                draggable
                onDragStart={() => setDragBase(b)}
                onDragEnd={() => setDragBase(null)}
                onClick={() => model.addBase(b)}
                className="flex flex-1 flex-col items-center gap-1 rounded-[12px] border border-white/10 bg-white/[0.03] p-2 transition hover:border-emerald-400/50 hover:bg-white/[0.06] active:scale-95"
                aria-label={`${info.nameUz} (${b}) qo'shish`}
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-[8px] font-mono text-[15px] font-bold"
                  style={{
                    background: `radial-gradient(circle at 34% 28%, ${lighten(info.color, 0.4)}, ${info.color})`,
                    color: "#0b0f14",
                    boxShadow: `inset 0 0 0 1px ${info.stroke}`,
                  }}
                >
                  {b}
                </span>
                <span className="text-[9.5px] font-medium text-void-200">{info.nameUz}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => model.removeLast()}
            className="flex flex-col items-center justify-center gap-1 rounded-[12px] border border-white/10 bg-white/[0.03] px-2.5 py-2 text-void-300 transition hover:border-white/25 hover:text-void-100 active:scale-95"
            aria-label="Oxirgi asosni o'chirish"
            title="Oxirgi asosni o'chirish"
          >
            <span className="text-[16px] leading-none">⌫</span>
            <span className="text-[9px]">o'chir</span>
          </button>
        </div>

        {/* live readout: mRNA preview + protein it would make */}
        <div className="w-full rounded-[10px] border border-white/8 bg-white/[0.02] px-3 py-2 text-center">
          <span className="font-mono text-[11px] tracking-wide text-void-300">
            mRNK →{" "}
            <span className="text-orange-300/90">{mrna.join("")}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function PairPill({ a, b }: { a: Base; b: Base }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1">
      <span
        className="flex h-5 w-5 items-center justify-center rounded-[5px] font-mono text-[11px] font-bold"
        style={{ background: DNA_BASES[a].color, color: "#0b0f14" }}
      >
        {a}
      </span>
      <span className="text-[12px] text-void-300">—</span>
      <span
        className="flex h-5 w-5 items-center justify-center rounded-[5px] font-mono text-[11px] font-bold"
        style={{ background: DNA_BASES[b].color, color: "#0b0f14" }}
      >
        {b}
      </span>
    </span>
  );
}
