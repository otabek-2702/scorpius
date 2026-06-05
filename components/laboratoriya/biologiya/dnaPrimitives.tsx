// components/laboratoriya/biologiya/dnaPrimitives.tsx
/**
 * Shared SVG/DOM primitives for the Markaziy dogma (DNA → RNA → Protein) lab.
 *
 * Pure presentation — these read NO model state and compute NO biology. They
 * just paint a base chip, an amino-acid bead, etc. from props the stage views
 * pass down. Keeping them here keeps DnaLab + the stage views readable and lets
 * the build / transcription / translation views share one visual language.
 */
"use client";

import type { Base, RnaBase } from "@/lib/sims/biology/dna/data";
import { DNA_BASES, RNA_BASES, AMINO_ACIDS } from "@/lib/sims/biology/dna/data";

export const ACCENT = "#34d399"; // emerald — the biology lab accent

/* ---------------------------------------------------------------- base chip */

interface BaseChipProps {
  base: Base | RnaBase;
  /** RNA chips use the RNA palette (U is orange). */
  rna?: boolean;
  /** px size of the square chip. */
  size?: number;
  /** dim a chip that is not yet "active" (e.g. UTR / not-yet-transcribed). */
  dim?: boolean;
  /** glow ring (currently-read base / codon). */
  active?: boolean;
}

/** A single nucleotide chip — a rounded square with the base letter. */
export function BaseChip({ base, rna, size = 30, dim, active }: BaseChipProps) {
  const info = (rna ? RNA_BASES : DNA_BASES)[base as keyof typeof DNA_BASES];
  const color = info?.color ?? "#888";
  const stroke = info?.stroke ?? "#555";
  return (
    <span
      className="inline-flex items-center justify-center rounded-[7px] font-mono font-bold leading-none transition-[opacity,box-shadow,transform] duration-150"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.5),
        color: "#0b0f14",
        background: `radial-gradient(circle at 34% 28%, ${lighten(color, 0.4)}, ${color})`,
        boxShadow: active
          ? `0 0 0 2px ${ACCENT}, 0 0 14px ${ACCENT}88`
          : `inset 0 0 0 1px ${stroke}`,
        opacity: dim ? 0.32 : 1,
        transform: active ? "translateY(-1px) scale(1.06)" : "none",
      }}
      aria-label={info?.nameUz ?? String(base)}
    >
      {base}
    </span>
  );
}

/* ------------------------------------------------------------- amino bead */

interface AminoBeadProps {
  /** Amino-acid abbreviation key, e.g. "Met". */
  aa: string;
  size?: number;
  active?: boolean;
  /** entrance scale 0→1 (the newest bead pops in). */
  enter?: number;
}

/** A polypeptide bead — a coloured circle with the 3-letter abbreviation. */
export function AminoBead({ aa, size = 44, active, enter = 1 }: AminoBeadProps) {
  const info = AMINO_ACIDS[aa];
  const color = info?.color ?? "#9ca3af";
  const e = Math.max(0, Math.min(1, enter));
  return (
    <span
      className="inline-flex flex-col items-center justify-center rounded-full font-semibold leading-none"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 36% 30%, ${lighten(color, 0.4)}, ${color})`,
        color: "#0b0f14",
        boxShadow: active
          ? `0 0 0 2px #fff, 0 0 16px ${color}cc`
          : `inset 0 0 0 1px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.35)`,
        transform: `scale(${0.4 + 0.6 * e})`,
        opacity: e,
      }}
      title={info?.name}
    >
      <span style={{ fontSize: Math.round(size * 0.28) }}>{info?.abbr3 ?? aa}</span>
    </span>
  );
}

/* ----------------------------------------------------------- backbone line */

/** A subtle sugar-phosphate backbone rail behind a strand row. */
export function BackboneRail({
  label,
  tone = "#7dd3c0",
}: {
  label: string;
  tone?: string;
}) {
  return (
    <span
      className="select-none font-mono text-[10px] font-semibold uppercase tracking-[0.14em]"
      style={{ color: tone }}
    >
      {label}
    </span>
  );
}

/* --------------------------------------------------------------- utilities */

/** Lighten a hex toward white by `amt` (0..1). Mirrors the chemistry lab util. */
export function lighten(hex: string, amt: number): string {
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

/** Smoothstep ease (0→1). */
export function smooth(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}
