// lib/sims/biology/dna/data.ts
/**
 * Shared biology dataset for the Markaziy dogma laboratoriyasi (DNA → RNA →
 * Protein). PURE DATA + TYPES, zero React, zero side effects (apart from a
 * dev-only self-test that throws if the genetic code is ever corrupted).
 *
 * Everything here is the REAL biology:
 *   - Watson–Crick base pairing (A–T, G–C) for DNA.
 *   - Transcription pairing (DNA A→U, T→A, G→C, C→G) — RNA uses U, not T.
 *   - The STANDARD genetic code (NCBI Translation Table 1): all 64 codons →
 *     20 amino acids + 3 stop codons; AUG = Met = start.
 *
 * The codon table was cross-checked against the Wikipedia "DNA and RNA codon
 * tables" standard table and NCBI Translation Table 1. See model.md §1.3.
 */

// ---------------------------------------------------------------------------
// BASES
// ---------------------------------------------------------------------------

/** A DNA base. */
export type Base = "A" | "T" | "G" | "C";
/** An RNA base (U replaces T). */
export type RnaBase = "A" | "U" | "G" | "C";

export interface BaseInfo {
  /** Symbol. */
  sym: string;
  /** Full Uzbek name. */
  nameUz: string;
  /** Saturated accent for the base chip (kept distinct + colour-blind-safe-ish). */
  color: string;
  /** A darker rim so the chip reads on the near-black stage. */
  stroke: string;
}

/** DNA bases — the editable palette in STEP 1. */
export const DNA_BASES: Record<Base, BaseInfo> = {
  A: { sym: "A", nameUz: "Adenin", color: "#34d399", stroke: "#0f9b6c" },
  T: { sym: "T", nameUz: "Timin", color: "#f4b63e", stroke: "#b07d12" },
  G: { sym: "G", nameUz: "Guanin", color: "#60a5fa", stroke: "#2563c9" },
  C: { sym: "C", nameUz: "Sitozin", color: "#f472b6", stroke: "#be3a7e" },
};

/** RNA bases — for rendering the mRNA strand (U swaps in for T). */
export const RNA_BASES: Record<RnaBase, BaseInfo> = {
  A: DNA_BASES.A,
  U: { sym: "U", nameUz: "Urasil", color: "#fb923c", stroke: "#c25410" },
  G: DNA_BASES.G,
  C: DNA_BASES.C,
};

/** Palette order shown to the learner. */
export const BASE_ORDER: Base[] = ["A", "T", "G", "C"];

// ---------------------------------------------------------------------------
// PAIRING — exact, Watson–Crick + transcription
// ---------------------------------------------------------------------------

/** DNA ↔ DNA complement (Watson–Crick): A-T, G-C. */
export function complementDNA(b: Base): Base {
  switch (b) {
    case "A": return "T";
    case "T": return "A";
    case "G": return "C";
    case "C": return "G";
  }
}

/**
 * Transcription: DNA template base → mRNA base. Identical to DNA complement but
 * adenine on the template pairs with URACIL (U) in RNA — RNA has no thymine.
 *   A → U,  T → A,  G → C,  C → G
 */
export function transcribeBase(b: Base): RnaBase {
  switch (b) {
    case "A": return "U";
    case "T": return "A";
    case "G": return "C";
    case "C": return "G";
  }
}

/** The mRNA codon that an mRNA base pairs with on the tRNA anticodon (display aid). */
export function rnaComplement(b: RnaBase): RnaBase {
  switch (b) {
    case "A": return "U";
    case "U": return "A";
    case "G": return "C";
    case "C": return "G";
  }
}

// ---------------------------------------------------------------------------
// AMINO ACIDS
// ---------------------------------------------------------------------------

export interface AminoAcid {
  /** 3-letter abbreviation, e.g. "Met". */
  abbr3: string;
  /** 1-letter code, e.g. "M". */
  code1: string;
  /** Full name (international, latinised). */
  name: string;
  /** Uzbek name. */
  nameUz: string;
  /** A bead colour for the polypeptide chain (grouped by chemistry family). */
  color: string;
}

/**
 * The 20 standard amino acids + a STOP sentinel. Colours grouped roughly by
 * side-chain chemistry (nonpolar greys/greens, polar teals, acidic reds, basic
 * blues, aromatic violets) so the chain reads as more than random confetti.
 */
export const AMINO_ACIDS: Record<string, AminoAcid> = {
  Ala: { abbr3: "Ala", code1: "A", name: "Alanine", nameUz: "Alanin", color: "#9ca3af" },
  Arg: { abbr3: "Arg", code1: "R", name: "Arginine", nameUz: "Arginin", color: "#3b82f6" },
  Asn: { abbr3: "Asn", code1: "N", name: "Asparagine", nameUz: "Asparagin", color: "#2dd4bf" },
  Asp: { abbr3: "Asp", code1: "D", name: "Aspartic acid", nameUz: "Asparagin kislotasi", color: "#ef4444" },
  Cys: { abbr3: "Cys", code1: "C", name: "Cysteine", nameUz: "Sistein", color: "#eab308" },
  Gln: { abbr3: "Gln", code1: "Q", name: "Glutamine", nameUz: "Glutamin", color: "#2dd4bf" },
  Glu: { abbr3: "Glu", code1: "E", name: "Glutamic acid", nameUz: "Glutamin kislotasi", color: "#dc2626" },
  Gly: { abbr3: "Gly", code1: "G", name: "Glycine", nameUz: "Glitsin", color: "#9ca3af" },
  His: { abbr3: "His", code1: "H", name: "Histidine", nameUz: "Gistidin", color: "#6366f1" },
  Ile: { abbr3: "Ile", code1: "I", name: "Isoleucine", nameUz: "Izoleysin", color: "#a3a380" },
  Leu: { abbr3: "Leu", code1: "L", name: "Leucine", nameUz: "Leysin", color: "#a3a380" },
  Lys: { abbr3: "Lys", code1: "K", name: "Lysine", nameUz: "Lizin", color: "#3b82f6" },
  Met: { abbr3: "Met", code1: "M", name: "Methionine", nameUz: "Metionin", color: "#34d399" },
  Phe: { abbr3: "Phe", code1: "F", name: "Phenylalanine", nameUz: "Fenilalanin", color: "#a78bfa" },
  Pro: { abbr3: "Pro", code1: "P", name: "Proline", nameUz: "Prolin", color: "#84cc16" },
  Ser: { abbr3: "Ser", code1: "S", name: "Serine", nameUz: "Serin", color: "#5eead4" },
  Thr: { abbr3: "Thr", code1: "T", name: "Threonine", nameUz: "Treonin", color: "#5eead4" },
  Trp: { abbr3: "Trp", code1: "W", name: "Tryptophan", nameUz: "Triptofan", color: "#c084fc" },
  Tyr: { abbr3: "Tyr", code1: "Y", name: "Tyrosine", nameUz: "Tirozin", color: "#a78bfa" },
  Val: { abbr3: "Val", code1: "V", name: "Valine", nameUz: "Valin", color: "#a3a380" },
};

/** Sentinel returned by the codon table for the 3 stop codons. */
export const STOP = "Stop" as const;

// ---------------------------------------------------------------------------
// THE STANDARD GENETIC CODE — NCBI Translation Table 1 (all 64 codons)
// ---------------------------------------------------------------------------

/**
 * mRNA codon (5′→3′, bases A/U/G/C) → amino-acid abbreviation, or STOP.
 * AUG additionally serves as the START codon (Met). Verified against the
 * Wikipedia standard RNA codon table + NCBI table 1 — see model.md §1.3.
 */
export const CODON_TABLE: Record<string, string> = {
  // U _ _
  UUU: "Phe", UUC: "Phe", UUA: "Leu", UUG: "Leu",
  UCU: "Ser", UCC: "Ser", UCA: "Ser", UCG: "Ser",
  UAU: "Tyr", UAC: "Tyr", UAA: STOP, UAG: STOP,
  UGU: "Cys", UGC: "Cys", UGA: STOP, UGG: "Trp",
  // C _ _
  CUU: "Leu", CUC: "Leu", CUA: "Leu", CUG: "Leu",
  CCU: "Pro", CCC: "Pro", CCA: "Pro", CCG: "Pro",
  CAU: "His", CAC: "His", CAA: "Gln", CAG: "Gln",
  CGU: "Arg", CGC: "Arg", CGA: "Arg", CGG: "Arg",
  // A _ _
  AUU: "Ile", AUC: "Ile", AUA: "Ile", AUG: "Met",
  ACU: "Thr", ACC: "Thr", ACA: "Thr", ACG: "Thr",
  AAU: "Asn", AAC: "Asn", AAA: "Lys", AAG: "Lys",
  AGU: "Ser", AGC: "Ser", AGA: "Arg", AGG: "Arg",
  // G _ _
  GUU: "Val", GUC: "Val", GUA: "Val", GUG: "Val",
  GCU: "Ala", GCC: "Ala", GCA: "Ala", GCG: "Ala",
  GAU: "Asp", GAC: "Asp", GAA: "Glu", GAG: "Glu",
  GGU: "Gly", GGC: "Gly", GGA: "Gly", GGG: "Gly",
};

export const START_CODON = "AUG";
export const STOP_CODONS: ReadonlyArray<string> = ["UAA", "UAG", "UGA"];

/** Look up a codon. Returns the amino-acid abbr, STOP, or undefined (partial). */
export function translateCodon(codon: string): string | undefined {
  return CODON_TABLE[codon];
}

/** Is this codon a stop codon? */
export function isStopCodon(codon: string): boolean {
  return CODON_TABLE[codon] === STOP;
}

// ---------------------------------------------------------------------------
// SEED TEMPLATES — short, codon-length, and biologically meaningful
// ---------------------------------------------------------------------------
//
// These are DNA TEMPLATE strands. Reading them left→right, transcription gives
// mRNA = transcribeBase(each base), which (by construction) starts with AUG and
// ends with a stop codon, so the learner always sees a complete little protein.
//
// Worked example for the default below:
//   template  3'..  T A C  G G A  T A C  A C T  ..5'  (shown 5'→3' L→R here)
//   mRNA          A U G  C C U  A U G  U G A
//   codons        AUG=Met  CCU=Pro  AUG=Met  UGA=Stop
// (kept simple + correct; verified by assertCodonTableValid spot checks.)

export interface SeedTemplate {
  id: string;
  /** Short Uzbek label. */
  labelUz: string;
  /** DNA template bases (left→right = 5′→3′ in our display frame). */
  template: Base[];
}

/**
 * Build a DNA template whose mRNA = the given codons. Since
 * transcribeBase is an involution-like map (A↔U via complement, T↔A, G↔C, C↔G),
 * the template base for a desired mRNA base `m` is the DNA base whose
 * transcription gives `m`. We invert the map here.
 */
function templateForMrna(mrna: RnaBase[]): Base[] {
  const inv: Record<RnaBase, Base> = { U: "A", A: "T", C: "G", G: "C" };
  return mrna.map((m) => inv[m]);
}

export const SEED_TEMPLATES: SeedTemplate[] = [
  {
    id: "met-phe-gly",
    labelUz: "Met · Phe · Gly",
    template: templateForMrna(["A", "U", "G", "U", "U", "U", "G", "G", "A", "U", "A", "A"]),
  },
  {
    id: "met-ser-lys",
    labelUz: "Met · Ser · Lys",
    template: templateForMrna(["A", "U", "G", "U", "C", "U", "A", "A", "A", "U", "A", "G"]),
  },
  {
    id: "met-leu-pro-stop",
    labelUz: "Met · Leu · Pro",
    template: templateForMrna(["A", "U", "G", "C", "U", "G", "C", "C", "C", "U", "G", "A"]),
  },
];

/** The default template the lab opens with. */
export const DEFAULT_TEMPLATE: Base[] = SEED_TEMPLATES[0].template;

// ---------------------------------------------------------------------------
// SELF-TEST — guards the genetic code in development (throws if corrupted)
// ---------------------------------------------------------------------------

/**
 * Verify the codon table is the complete, correct standard genetic code.
 * Called once at module load in non-production builds. Throwing here turns a
 * silent data error (wrong protein = failed lesson) into a loud build/dev error.
 */
export function assertCodonTableValid(): void {
  const entries = Object.entries(CODON_TABLE);
  // 1) exactly 64 codons
  if (entries.length !== 64) {
    throw new Error(`CODON_TABLE: expected 64 codons, got ${entries.length}`);
  }
  // 2) every codon is a valid RNA triplet + every key unique (Record guarantees)
  const bases = new Set(["A", "U", "G", "C"]);
  for (const [codon, aa] of entries) {
    if (codon.length !== 3 || [...codon].some((c) => !bases.has(c))) {
      throw new Error(`CODON_TABLE: invalid codon "${codon}"`);
    }
    if (aa !== STOP && !AMINO_ACIDS[aa]) {
      throw new Error(`CODON_TABLE: "${codon}" maps to unknown amino acid "${aa}"`);
    }
  }
  // 3) exactly 3 stops, and they are the canonical three
  const stops = entries.filter(([, aa]) => aa === STOP).map(([c]) => c).sort();
  if (stops.join(",") !== "UAA,UAG,UGA") {
    throw new Error(`CODON_TABLE: stop codons wrong — got ${stops.join(",")}`);
  }
  // 4) all 20 standard amino acids are represented
  const used = new Set(entries.map(([, aa]) => aa).filter((aa) => aa !== STOP));
  if (used.size !== 20) {
    throw new Error(`CODON_TABLE: expected 20 amino acids, found ${used.size}`);
  }
  for (const aa of Object.keys(AMINO_ACIDS)) {
    if (!used.has(aa)) throw new Error(`CODON_TABLE: amino acid "${aa}" never encoded`);
  }
  // 5) hard spot checks against the primary source
  const spot: Record<string, string> = {
    AUG: "Met", UUU: "Phe", GGA: "Gly", UAA: STOP, UGG: "Trp", AUA: "Ile", UGA: STOP,
  };
  for (const [codon, expected] of Object.entries(spot)) {
    if (CODON_TABLE[codon] !== expected) {
      throw new Error(`CODON_TABLE: ${codon} should be ${expected}, got ${CODON_TABLE[codon]}`);
    }
  }
}

if (process.env.NODE_ENV !== "production") {
  assertCodonTableValid();
}
