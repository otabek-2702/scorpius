// components/laboratoriya/biologiya/TranslationStage.tsx
/**
 * TranslationStage — STEP 3 "Translatsiya".
 *
 * The ribosome slides along the mRNA reading frame (from the first AUG), one
 * codon at a time. For each codon a tRNA carrying the matching amino acid docks
 * (its arrival eased by the model's `tRNAArrival` 0→1); when it seats, the amino
 * acid is added to the growing polypeptide. Start = AUG (Met), stop at
 * UAA/UAG/UGA. All counters advance only in model.step on the parent rAF loop.
 *
 * Pure view: the genetic code lives in the model/data; this only paints.
 */
"use client";

import { useProperty } from "@/lib/sim/observable/useProperty";
import type { DnaModel } from "@/lib/sims/biology/dna/Model";
import { AMINO_ACIDS, STOP } from "@/lib/sims/biology/dna/data";
import { rnaComplement } from "@/lib/sims/biology/dna/data";
import { BaseChip, AminoBead, ACCENT, smooth } from "./dnaPrimitives";

const CHIP = 26;
const GAP = 4;
const CODON_W = CHIP * 3 + GAP * 2;
const CODON_GAP = 10;
const STRIDE = CODON_W + CODON_GAP;

export default function TranslationStage({ model }: { model: DnaModel }) {
  const ribosome = useProperty(model.ribosome);
  const arrival = useProperty(model.tRNAArrival);
  const stoppedAtStop = useProperty(model.stoppedAtStop);
  const stage = useProperty(model.stage);

  const codons = model.codons();
  const done = Math.floor(ribosome); // codons fully read
  const reading = done < codons.length ? codons[done] : null; // codon being read now
  const peptide = model.peptide();
  const e = smooth(arrival); // tRNA dock ease for the current codon

  return (
    <div className="flex h-full w-full flex-col items-center justify-between gap-3 px-3 py-4">
      {/* ---- mRNA track + ribosome ---- */}
      <div className="relative w-full max-w-full overflow-x-auto pb-1">
        <div
          className="relative mx-auto"
          style={{ width: 8 + codons.length * STRIDE + 8, minHeight: 96 }}
        >
          {/* ribosome — a rounded shell over the current codon */}
          {reading && (
            <span
              className="pointer-events-none absolute z-0 rounded-[16px] transition-[left] duration-150"
              aria-hidden
              style={{
                left: 8 + done * STRIDE - 8,
                top: 22,
                width: CODON_W + 16,
                height: CHIP + 22,
                background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(52,211,153,0.10))",
                boxShadow: `0 0 0 1.5px ${ACCENT}55, 0 8px 22px rgba(0,0,0,0.4)`,
              }}
            />
          )}

          {/* codon row */}
          <div className="absolute left-0 flex" style={{ top: 28, gap: CODON_GAP, paddingLeft: 8 }}>
            {codons.map((c, ci) => {
              const isPast = ci < done;
              const isReading = ci === done;
              return (
                <div key={ci} className="flex flex-col items-center" style={{ width: CODON_W }}>
                  <div className="flex" style={{ gap: GAP }}>
                    {c.bases.map((b, bi) => (
                      <BaseChip
                        key={bi}
                        base={b}
                        rna
                        size={CHIP}
                        dim={!isPast && !isReading}
                        active={isReading}
                      />
                    ))}
                  </div>
                  {/* codon → amino label under each */}
                  <span
                    className="mt-1 font-mono text-[9.5px] font-semibold"
                    style={{
                      color:
                        c.aa === STOP
                          ? "#f87171"
                          : c.kind === "start"
                            ? ACCENT
                            : isPast
                              ? "#cbd5e1"
                              : "#5b647a",
                    }}
                  >
                    {c.aa === STOP ? "STOP" : c.aa ?? "—"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* docking tRNA for the codon being read (anticodon + cargo bead) */}
          {reading && reading.aa && reading.aa !== STOP && !stoppedAtStop && (
            <DockingTRna codon={reading} x={8 + done * STRIDE} ease={e} />
          )}
          {reading && reading.aa === STOP && (
            <span
              className="absolute z-20 -translate-x-1/2 rounded-full border border-red-500/40 bg-red-500/15 px-2.5 py-1 text-[11px] font-bold text-red-300"
              style={{ left: 8 + done * STRIDE + CODON_W / 2, top: 0 }}
            >
              STOP — chiqarish
            </span>
          )}
        </div>
      </div>

      {/* ---- growing polypeptide chain ---- */}
      <div className="flex w-full flex-col items-center gap-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-void-300">
          Polipeptid (oqsil zanjiri) · {peptide.length} amino kislota
        </div>
        <div className="flex min-h-[52px] w-full max-w-full flex-wrap items-center justify-center gap-1.5 overflow-x-auto px-2">
          {peptide.length === 0 && (
            <span className="text-[12px] text-void-300">ribosoma AUGʻdan boshlaydi…</span>
          )}
          {peptide.map((res, i) => {
            const isNewest = i === peptide.length - 1;
            return (
              <div key={i} className="flex items-center">
                {i > 0 && <span className="mx-0.5 h-[2px] w-3 rounded bg-white/20" />}
                <AminoBead aa={res.aa} size={40} active={isNewest && stage === "translate"} />
              </div>
            );
          })}
          {/* incoming bead preview while a tRNA docks */}
          {reading && reading.aa && reading.aa !== STOP && stage === "translate" && (
            <div className="flex items-center" style={{ opacity: 0.35 + 0.5 * e }}>
              {peptide.length > 0 && <span className="mx-0.5 h-[2px] w-3 rounded bg-white/15" />}
              <AminoBead aa={reading.aa} size={40} enter={e} />
            </div>
          )}
        </div>
      </div>

      {/* current codon → amino readout */}
      <div className="flex w-full max-w-[520px] flex-wrap items-center justify-center gap-2 rounded-[12px] border border-white/8 bg-white/[0.02] px-3 py-2">
        {reading ? (
          <>
            <span className="text-[11px] text-void-300">Joriy kodon:</span>
            <span className="font-mono text-[14px] font-bold tracking-[0.1em] text-orange-200">
              {reading.codon}
            </span>
            <span className="text-void-400">→</span>
            {reading.aa === STOP ? (
              <span className="font-mono text-[13px] font-bold text-red-300">STOP kodon</span>
            ) : reading.aa ? (
              <span className="font-mono text-[13px] font-bold" style={{ color: AMINO_ACIDS[reading.aa]?.color }}>
                {AMINO_ACIDS[reading.aa]?.abbr3} · {AMINO_ACIDS[reading.aa]?.nameUz}
              </span>
            ) : (
              <span className="text-void-300">toʻliqsiz</span>
            )}
            {reading.kind === "start" && (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                START
              </span>
            )}
          </>
        ) : (
          <span className="text-[12px] font-semibold text-emerald-300">
            {stoppedAtStop ? "Oqsil tayyor — STOP kodonda toʻxtadi ✓" : "Oqsil tayyor ✓"}
          </span>
        )}
      </div>
    </div>
  );
}

/** A tRNA that floats down to the ribosome carrying its amino acid. */
function DockingTRna({
  codon,
  x,
  ease,
}: {
  codon: { codon: string; bases: string[]; aa?: string };
  x: number;
  ease: number;
}) {
  const dropY = -64 + ease * 64; // floats from above down onto the codon
  const anticodon = codon.bases.map((b) => rnaComplement(b as never)).join("");
  return (
    <span
      className="pointer-events-none absolute z-20 flex flex-col items-center"
      aria-hidden
      style={{
        left: x + CODON_W / 2,
        top: 30,
        transform: `translate(-50%, ${dropY}px)`,
        opacity: 0.55 + 0.45 * ease,
      }}
    >
      {codon.aa && <AminoBead aa={codon.aa} size={34} enter={Math.min(1, ease + 0.3)} />}
      <span className="my-0.5 h-3 w-[2px] rounded bg-white/30" />
      <span className="rounded-[6px] bg-black/40 px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-emerald-200">
        {anticodon}
      </span>
    </span>
  );
}
