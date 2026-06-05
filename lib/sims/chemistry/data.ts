// lib/sims/chemistry/data.ts
/**
 * Shared chemistry dataset for the Kimyo laboratoriyasi — consumed by BOTH the
 * hand-built Variant A (ChemistryHand, SVG + canvas) and the library Variant B
 * (ChemistryLib, 3Dmol.js). PURE DATA + TYPES, zero React, zero side effects.
 *
 * Everything here is sourced from real chemistry:
 *   - CPK / Jmol element colors + covalent radii (relative, H = 1.00).
 *   - Balanced equations with standard enthalpies of reaction ΔH (kJ per the
 *     written equation, 298 K) — see model.md for the per-source ΔHf table.
 *   - Real 3D product geometries in ångström: VSEPR angles + bond lengths.
 *
 * Coordinate convention: Å, right-handed, molecule centred near origin. The
 * View(s) scale Å → px (Variant A) or feed Å straight to 3Dmol (Variant B).
 */

import {
  PT_BY_SYM,
  approxNeutrons,
  shellsFromZ,
  type PTElement,
} from "./periodic";

// ---------------------------------------------------------------------------
// ELEMENTS
// ---------------------------------------------------------------------------

export interface AtomInfo {
  /** Element symbol, e.g. "O". */
  sym: string;
  /** Uzbek name (latin). */
  nameUz: string;
  /** CPK / Jmol hex color. */
  color: string;
  /** Stroke color so the sphere reads on a dark stage (white atoms need it). */
  stroke: string;
  /** Relative display radius (H = 1.00). Not the real vdW radius — tuned for legibility. */
  r: number;
  /** Typical bonding valence (electrons it shares / charge magnitude for ions). */
  valence: number;
  /** Ionic charge sign when this element appears in an ionic product (else 0). */
  ionCharge?: number;
}

/** Master element table — keyed by symbol. */
export const ATOMS: Record<string, AtomInfo> = {
  H: { sym: "H", nameUz: "Vodorod", color: "#FFFFFF", stroke: "#B0B0B0", r: 1.0, valence: 1 },
  C: { sym: "C", nameUz: "Uglerod", color: "#909090", stroke: "#5a5a5a", r: 2.45, valence: 4 },
  N: { sym: "N", nameUz: "Azot", color: "#3050F8", stroke: "#1f37b8", r: 2.29, valence: 3 },
  O: { sym: "O", nameUz: "Kislorod", color: "#FF0D0D", stroke: "#b00808", r: 2.13, valence: 2 },
  F: { sym: "F", nameUz: "Ftor", color: "#90E050", stroke: "#5da32f", r: 1.84, valence: 1 },
  Na: { sym: "Na", nameUz: "Natriy", color: "#AB5CF2", stroke: "#7a36c2", r: 5.35, valence: 1, ionCharge: 1 },
  Mg: { sym: "Mg", nameUz: "Magniy", color: "#8AFF00", stroke: "#5fb000", r: 4.55, valence: 2, ionCharge: 2 },
  S: { sym: "S", nameUz: "Oltingugurt", color: "#FFFF30", stroke: "#bfbf1a", r: 3.39, valence: 2 },
  Cl: { sym: "Cl", nameUz: "Xlor", color: "#1FF01F", stroke: "#14a814", r: 3.29, valence: 1, ionCharge: -1 },
  Fe: { sym: "Fe", nameUz: "Temir", color: "#E06633", stroke: "#a8401a", r: 4.26, valence: 3, ionCharge: 3 },
  Cu: { sym: "Cu", nameUz: "Mis", color: "#C88033", stroke: "#94581f", r: 4.26, valence: 2, ionCharge: 2 },
  // ── elements added to support the new reaction types ─────────────────────
  Ca: { sym: "Ca", nameUz: "Kalsiy", color: "#3DFF00", stroke: "#27a800", r: 5.55, valence: 2, ionCharge: 2 },
  K: { sym: "K", nameUz: "Kaliy", color: "#8F40D4", stroke: "#5f1f9e", r: 6.0, valence: 1, ionCharge: 1 },
  Zn: { sym: "Zn", nameUz: "Rux", color: "#7D80B0", stroke: "#4f5280", r: 4.2, valence: 2, ionCharge: 2 },
  Ag: { sym: "Ag", nameUz: "Kumush", color: "#C0C0C0", stroke: "#808080", r: 4.4, valence: 1, ionCharge: 1 },
  Ba: { sym: "Ba", nameUz: "Bariy", color: "#00C900", stroke: "#008a00", r: 6.3, valence: 2, ionCharge: 2 },
  Hg: { sym: "Hg", nameUz: "Simob", color: "#B8B8D0", stroke: "#7a7a96", r: 4.4, valence: 2, ionCharge: 2 },
};

/** Palette order shown in the element tray (draggable tiles). */
export const PALETTE: string[] = [
  "H", "O", "N", "C", "S", "Cl",
  "Na", "Mg", "Ca", "K", "Fe", "Cu",
  "Zn", "Ag", "Ba", "Hg",
];

// ---------------------------------------------------------------------------
// ATOMIC STRUCTURE — protons (Z), neutrons (most-common isotope), e⁻ shells
// ---------------------------------------------------------------------------

/**
 * Curated atomic structure for the lab elements (EXACT values, not Bohr-rule
 * approximations). protons = Z, neutrons = (mass number of the most common
 * isotope) − Z, shells = real ground-state shell occupancies (e.g. Fe is
 * [2,8,14,2] — the 3d/4s split, NOT the naive 2,8,8,18 Bohr filling).
 *
 * Source: standard isotope/electron-configuration data; Z+neutrons reproduces
 * the most-common-isotope mass number (¹H=1, ⁴He=4, ¹²C=12, ⁵⁶Fe=56, ⁶³Cu wait
 * → Cu uses 35 → ⁶⁴, the prompt's curated choice, noted in model.md).
 */
export interface AtomStructure {
  sym: string;
  /** Atomic number Z = proton count. */
  protons: number;
  /** Neutrons in the curated (most-common) isotope. */
  neutrons: number;
  /** Electron-shell occupancies, innermost first. */
  shells: number[];
  /** True if the shells are the exact curated values (vs the Bohr rule). */
  exact: boolean;
}

const CURATED_STRUCTURE: Record<string, { protons: number; neutrons: number; shells: number[] }> = {
  H: { protons: 1, neutrons: 0, shells: [1] },
  He: { protons: 2, neutrons: 2, shells: [2] },
  C: { protons: 6, neutrons: 6, shells: [2, 4] },
  N: { protons: 7, neutrons: 7, shells: [2, 5] },
  O: { protons: 8, neutrons: 8, shells: [2, 6] },
  F: { protons: 9, neutrons: 10, shells: [2, 7] },
  Ne: { protons: 10, neutrons: 10, shells: [2, 8] },
  Na: { protons: 11, neutrons: 12, shells: [2, 8, 1] },
  Mg: { protons: 12, neutrons: 12, shells: [2, 8, 2] },
  Al: { protons: 13, neutrons: 14, shells: [2, 8, 3] },
  Si: { protons: 14, neutrons: 14, shells: [2, 8, 4] },
  P: { protons: 15, neutrons: 16, shells: [2, 8, 5] },
  S: { protons: 16, neutrons: 16, shells: [2, 8, 6] },
  Cl: { protons: 17, neutrons: 18, shells: [2, 8, 7] },
  Ar: { protons: 18, neutrons: 22, shells: [2, 8, 8] },
  K: { protons: 19, neutrons: 20, shells: [2, 8, 8, 1] },
  Ca: { protons: 20, neutrons: 20, shells: [2, 8, 8, 2] },
  Fe: { protons: 26, neutrons: 30, shells: [2, 8, 14, 2] },
  Cu: { protons: 29, neutrons: 35, shells: [2, 8, 18, 1] },
};

/** Symbols that have EXACT curated atomic structure (the lab core). */
export const CURATED_ATOMS: string[] = Object.keys(CURATED_STRUCTURE);

/**
 * Resolve the atomic structure of ANY element by symbol: curated EXACT values
 * for the lab core, else the simple Bohr filling (2,8,8,18…) from Z with an
 * APPROXIMATE neutron count = round(atomic weight) − Z. Returns null if the
 * symbol is unknown (not in the periodic table). `exact` flags which path ran
 * so the UI can label "Bor modeli (taxminiy)" for the computed ones.
 */
export function atomStructure(sym: string): AtomStructure | null {
  const curated = CURATED_STRUCTURE[sym];
  const pt: PTElement | undefined = PT_BY_SYM[sym];
  if (curated) {
    return {
      sym,
      protons: curated.protons,
      neutrons: curated.neutrons,
      shells: curated.shells,
      exact: true,
    };
  }
  if (!pt) return null;
  return {
    sym,
    protons: pt.z,
    neutrons: approxNeutrons(pt.z, pt.weight),
    shells: shellsFromZ(pt.z),
    exact: false,
  };
}

/** Mass number A = protons + neutrons. */
export function massNumber(s: AtomStructure): number {
  return s.protons + s.neutrons;
}

/** Electron-configuration caption, e.g. "2, 8, 1". */
export function shellConfig(s: AtomStructure): string {
  return s.shells.join(", ");
}

// ---------------------------------------------------------------------------
// GEOMETRY — product atoms (Å) + bonds
// ---------------------------------------------------------------------------

export interface ProductAtom {
  /** Element symbol. */
  el: string;
  /** Position in ångström (molecule frame). */
  x: number;
  y: number;
  z: number;
}

export interface ProductBond {
  /** Indices into the product's `atoms` array. */
  a: number;
  b: number;
  /** Bond order: 1 single, 2 double, 3 triple. */
  order: number;
}

/**
 * A single product molecule's 3D structure. For ionic products we still list
 * "atoms" (the ions of one formula unit + a few neighbours to suggest the
 * lattice) but mark `ionic` so the View animates a lattice, not a molecule.
 */
export interface ProductStructure {
  atoms: ProductAtom[];
  bonds: ProductBond[];
  /** How many of THIS molecule the balanced equation produces (the coefficient). */
  count: number;
}

// ---------------------------------------------------------------------------
// REACTIONS
// ---------------------------------------------------------------------------

export interface SpeciesCount {
  /** Formula label, e.g. "H₂", "O₂", "H₂O". */
  formula: string;
  /** Stoichiometric coefficient. */
  n: number;
  /** Element composition of ONE molecule of this species (symbol → count). */
  atoms: Record<string, number>;
}

export type ReactionKind = "covalent" | "ionic";

/**
 * Pedagogical reaction TYPE — drives the type-specific assembly animation in the
 * views AND the picker's type filter. `kind` (covalent/ionic) stays the render
 * path (ball-and-stick vs lattice); `type` is the chemistry classification.
 *
 *  synthesis      A + B → AB           atoms fly together (the original set)
 *  decomposition  AB → A + B           one molecule SPLITS into many
 *  single-displ.  A + BC → AC + B      A kicks B out, takes its place
 *  double-displ.  AB + CD → AD + CB    partners SWAP; often a precipitate falls
 *  combustion     CₓHᵧ + O₂ → CO₂+H₂O  hydrocarbon burns with a flame
 *  neutralization acid + base → salt+H₂O  H⁺ + OH⁻ → water
 */
export type ReactionType =
  | "synthesis"
  | "decomposition"
  | "single-displacement"
  | "double-displacement"
  | "combustion"
  | "neutralization";

/** Uzbek labels + short glyph for each reaction type (picker filter + badge). */
export const REACTION_TYPE_UZ: Record<ReactionType, { label: string; glyph: string; blurb: string }> = {
  synthesis: { label: "Birikish", glyph: "A+B→AB", blurb: "Ikki modda birlashib bittasini hosil qiladi" },
  decomposition: { label: "Parchalanish", glyph: "AB→A+B", blurb: "Bitta modda bir nechtasiga ajraladi" },
  "single-displacement": { label: "Oʻrin olish", glyph: "A+BC→AC+B", blurb: "Bitta element boshqasini siqib chiqaradi" },
  "double-displacement": { label: "Almashinish", glyph: "AB+CD→AD+CB", blurb: "Juftliklar almashadi — koʻpincha choʻkma tushadi" },
  combustion: { label: "Yonish", glyph: "CₓHᵧ+O₂", blurb: "Yoqilgʻi kislorodda yonadi — alanga" },
  neutralization: { label: "Neytrallanish", glyph: "kislota+ishqor", blurb: "Kislota + ishqor → tuz + suv" },
};

export interface Reaction {
  id: string;
  /** Pretty balanced equation for the readout (with subscripts + arrow). */
  equation: string;
  /** Left-hand species (reactants). */
  reactants: SpeciesCount[];
  /** Right-hand species (products). */
  products: SpeciesCount[];
  /** Pedagogical classification — drives the type-specific animation + filter. */
  reactionType: ReactionType;
  /** covalent = molecule (fly-together + bonds); ionic = electron jump + lattice. */
  kind: ReactionKind;
  /** ΔH of reaction, kJ (negative = exothermic). */
  dH: number;
  /** Flash intensity 0..1 — scales the energy bloom. Slow oxidation ≈ 0. */
  flash: number;
  /** Reaction is exothermic (warm bloom) vs endothermic (cool chill). */
  exo: boolean;
  /** Slow reactions (rust) spread warmth without a flash. */
  slow?: boolean;
  /** Triggered by light (HCl) — drives a light-pulse cue. */
  photo?: boolean;
  /** Combustion: render an animated flame around the forming molecule. */
  flame?: boolean;
  /**
   * Double-displacement: this reaction drops a SOLID precipitate. The view
   * sinks the assembled product to the floor of the chamber. Names the
   * precipitate formula for the caption (e.g. "AgCl").
   */
  precipitate?: string;
  /** Short Uzbek classification, e.g. "Birikish · yonish". */
  typeUz: string;
  /** Geometry caption, e.g. "Bukik · 104.5°". */
  geometryUz: string;
  /** One-line real-world hook (Uzbek). */
  hookUz: string;
  /** Accent color for this reaction's flash bloom. */
  flashColor: string;
  /**
   * The product geometry to assemble (the FIRST/representative product
   * molecule or one formula unit of the ionic lattice). For decomposition the
   * model animates the REACTANT splitting, so this is the reactant geometry.
   */
  structure: ProductStructure;
  /** Total atoms the user must gather (summed over reactant molecules). */
  requiredAtoms: Record<string, number>;
}

// --- helper to total atoms across reactant species --------------------------
function totalAtoms(species: SpeciesCount[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of species) {
    for (const [el, c] of Object.entries(s.atoms)) {
      out[el] = (out[el] ?? 0) + c * s.n;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// PRODUCT GEOMETRIES (Å) — real VSEPR + bond lengths
// ---------------------------------------------------------------------------

// Water H₂O — bent, H-O-H 104.5°, O-H 0.96 Å
const WATER: ProductStructure = {
  atoms: [
    { el: "O", x: 0, y: 0, z: 0 },
    { el: "H", x: 0.758, y: 0.587, z: 0 },
    { el: "H", x: -0.758, y: 0.587, z: 0 },
  ],
  bonds: [
    { a: 0, b: 1, order: 1 },
    { a: 0, b: 2, order: 1 },
  ],
  count: 2,
};

// Ammonia NH₃ — trigonal pyramidal, H-N-H 107.3°, N-H 1.01 Å.
// H positions derived from the real bond angle (NOT a perfect 109.5° tetrahedron):
// each N-H makes the angle θ with the C₃ (−y) axis such that the H-N-H angle is
// exactly 107.3° at length 1.01 Å. (The old 0.94/-0.33/0.814 layout was a
// tetrahedral 109.6°, contradicting the geometryUz caption.)
const AMMONIA: ProductStructure = {
  atoms: [
    { el: "N", x: 0, y: 0, z: 0 },
    { el: "H", x: 0.939, y: -0.371, z: 0 },
    { el: "H", x: -0.47, y: -0.371, z: 0.813 },
    { el: "H", x: -0.47, y: -0.371, z: -0.813 },
  ],
  bonds: [
    { a: 0, b: 1, order: 1 },
    { a: 0, b: 2, order: 1 },
    { a: 0, b: 3, order: 1 },
  ],
  count: 2,
};

// Carbon dioxide CO₂ — LINEAR, O=C=O 180°, C=O 1.16 Å
const CARBON_DIOXIDE: ProductStructure = {
  atoms: [
    { el: "C", x: 0, y: 0, z: 0 },
    { el: "O", x: 1.16, y: 0, z: 0 },
    { el: "O", x: -1.16, y: 0, z: 0 },
  ],
  bonds: [
    { a: 0, b: 1, order: 2 },
    { a: 0, b: 2, order: 2 },
  ],
  count: 1,
};

// Sulfur dioxide SO₂ — bent, O-S-O 119°, S-O 1.43 Å
const SULFUR_DIOXIDE: ProductStructure = {
  atoms: [
    { el: "S", x: 0, y: 0, z: 0 },
    { el: "O", x: 1.232, y: 0.728, z: 0 },
    { el: "O", x: -1.232, y: 0.728, z: 0 },
  ],
  bonds: [
    { a: 0, b: 1, order: 2 },
    { a: 0, b: 2, order: 2 },
  ],
  count: 1,
};

// Hydrogen chloride HCl — diatomic, H-Cl 1.27 Å, single bond
const HYDROGEN_CHLORIDE: ProductStructure = {
  atoms: [
    { el: "Cl", x: 0, y: 0, z: 0 },
    { el: "H", x: 1.27, y: 0, z: 0 },
  ],
  bonds: [{ a: 0, b: 1, order: 1 }],
  count: 2,
};

// Dihydrogen H₂ — diatomic, H–H 0.74 Å, single bond
const HYDROGEN: ProductStructure = {
  atoms: [
    { el: "H", x: -0.37, y: 0, z: 0 },
    { el: "H", x: 0.37, y: 0, z: 0 },
  ],
  bonds: [{ a: 0, b: 1, order: 1 }],
  count: 1,
};

// Dioxygen O₂ — diatomic, O=O 1.21 Å, double bond
const OXYGEN: ProductStructure = {
  atoms: [
    { el: "O", x: -0.605, y: 0, z: 0 },
    { el: "O", x: 0.605, y: 0, z: 0 },
  ],
  bonds: [{ a: 0, b: 1, order: 2 }],
  count: 1,
};

// Mercury vapour Hg — monatomic (HgO decomposition product); a lone sphere
const MERCURY: ProductStructure = {
  atoms: [{ el: "Hg", x: 0, y: 0, z: 0 }],
  bonds: [],
  count: 2,
};

// Methane CH₄ — tetrahedral, H-C-H 109.5°, C-H 1.09 Å
const METHANE: ProductStructure = {
  atoms: [
    { el: "C", x: 0, y: 0, z: 0 },
    { el: "H", x: 0.629, y: 0.629, z: 0.629 },
    { el: "H", x: -0.629, y: -0.629, z: 0.629 },
    { el: "H", x: -0.629, y: 0.629, z: -0.629 },
    { el: "H", x: 0.629, y: -0.629, z: -0.629 },
  ],
  bonds: [
    { a: 0, b: 1, order: 1 },
    { a: 0, b: 2, order: 1 },
    { a: 0, b: 3, order: 1 },
    { a: 0, b: 4, order: 1 },
  ],
  count: 1,
};

// Zinc chloride ZnCl₂ — linear in the gas phase, Cl-Zn-Cl 180°, Zn-Cl ≈ 2.07 Å.
// (Ionic in the solid; we render the molecular gas-phase geometry as a covalent
// stick model so the "kick-out" displacement reads clearly.)
const ZINC_CHLORIDE: ProductStructure = {
  atoms: [
    { el: "Zn", x: 0, y: 0, z: 0 },
    { el: "Cl", x: 2.07, y: 0, z: 0 },
    { el: "Cl", x: -2.07, y: 0, z: 0 },
  ],
  bonds: [
    { a: 0, b: 1, order: 1 },
    { a: 0, b: 2, order: 1 },
  ],
  count: 1,
};

// Silver chloride AgCl — rock-salt precipitate, Ag⁺–Cl⁻ ≈ 2.77 Å
const SILVER_CHLORIDE = cubicLattice("Ag", "Cl", 2.77);
// Barium sulfate BaSO₄ — render as a Ba²⁺ + SO₄²⁻ ion pair suggestion (a white
// precipitate); use a small Ba/O cubic suggestion at the Ba–O ≈ 2.8 Å scale.
const BARIUM_SULFATE = cubicLattice("Ba", "O", 2.8);
// Copper metal Cu — single atom deposited (single-displacement product)
const COPPER_METAL: ProductStructure = {
  atoms: [{ el: "Cu", x: 0, y: 0, z: 0 }],
  bonds: [],
  count: 1,
};
// Sodium hydroxide NaOH unit — Na⁺ ··· O–H, Na–O ≈ 2.0 Å, O–H 0.96 Å
const SODIUM_HYDROXIDE: ProductStructure = {
  atoms: [
    { el: "Na", x: -1.4, y: 0, z: 0 },
    { el: "O", x: 0.6, y: 0, z: 0 },
    { el: "H", x: 1.35, y: 0.55, z: 0 },
  ],
  bonds: [{ a: 1, b: 2, order: 1 }],
  count: 2,
};

/**
 * Build a small rock-salt cubic lattice (NaCl-type) of alternating ±ions.
 * 2×2×2 of the unit cube, spacing `d` Å. cation/anion symbols passed in.
 * Bonds left empty — ionic lattices render as a packed lattice, not sticks.
 */
function cubicLattice(cation: string, anion: string, d: number): ProductStructure {
  const atoms: ProductAtom[] = [];
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      for (let k = 0; k < 2; k++) {
        const even = (i + j + k) % 2 === 0;
        atoms.push({
          el: even ? cation : anion,
          x: (i - 0.5) * d,
          y: (j - 0.5) * d,
          z: (k - 0.5) * d,
        });
      }
    }
  }
  return { atoms, bonds: [], count: 2 };
}

// NaCl rock-salt, Na⁺–Cl⁻ ≈ 2.82 Å
const SODIUM_CHLORIDE = cubicLattice("Na", "Cl", 2.82);
// MgO rock-salt, Mg²⁺–O²⁻ ≈ 2.11 Å
const MAGNESIUM_OXIDE = cubicLattice("Mg", "O", 2.11);
// Fe₂O₃ — corundum-ish; approximate with a denser cubic suggestion, Fe–O ≈ 2.0 Å
const IRON_OXIDE = cubicLattice("Fe", "O", 2.0);

// ---------------------------------------------------------------------------
// THE REACTION SET (balanced, verified)
// ---------------------------------------------------------------------------

function makeReaction(
  partial: Omit<Reaction, "requiredAtoms">,
): Reaction {
  return { ...partial, requiredAtoms: totalAtoms(partial.reactants) };
}

export const REACTIONS: Reaction[] = [
  makeReaction({
    id: "water",
    equation: "2H₂ + O₂ → 2H₂O",
    reactants: [
      { formula: "H₂", n: 2, atoms: { H: 2 } },
      { formula: "O₂", n: 1, atoms: { O: 2 } },
    ],
    products: [{ formula: "H₂O", n: 2, atoms: { H: 2, O: 1 } }],
    reactionType: "synthesis",
    kind: "covalent",
    dH: -571.6,
    flash: 1.0,
    exo: true,
    typeUz: "Birikish · yonish",
    geometryUz: "Bukik · H–O–H 104.5°",
    hookUz: "Vodorod portlashi — raketa dvigatelidagi alanga shu.",
    flashColor: "#ffd27a",
    structure: WATER,
  }),
  makeReaction({
    id: "ammonia",
    equation: "N₂ + 3H₂ → 2NH₃",
    reactants: [
      { formula: "N₂", n: 1, atoms: { N: 2 } },
      { formula: "H₂", n: 3, atoms: { H: 2 } },
    ],
    products: [{ formula: "NH₃", n: 2, atoms: { N: 1, H: 3 } }],
    reactionType: "synthesis",
    kind: "covalent",
    dH: -91.8,
    flash: 0.45,
    exo: true,
    typeUz: "Birikish · Haber-Bosch",
    geometryUz: "Trigonal piramida · 107.3°",
    hookUz: "Yer yuzining yarmini boqadigan oʻgʻit — mustahkam N≡N uziladi.",
    flashColor: "#ffcaa0",
    structure: AMMONIA,
  }),
  makeReaction({
    id: "co2",
    equation: "C + O₂ → CO₂",
    reactants: [
      { formula: "C", n: 1, atoms: { C: 1 } },
      { formula: "O₂", n: 1, atoms: { O: 2 } },
    ],
    products: [{ formula: "CO₂", n: 1, atoms: { C: 1, O: 2 } }],
    reactionType: "combustion",
    kind: "covalent",
    dH: -393.5,
    flash: 0.7,
    exo: true,
    flame: true,
    typeUz: "Yonish",
    geometryUz: "Chiziqli · O=C=O 180°",
    hookUz: "Koʻmir yonadi — suvga qarama-qarshi, mutlaqo TOʻGʻRI chiziq.",
    flashColor: "#ffb066",
    structure: CARBON_DIOXIDE,
  }),
  makeReaction({
    id: "so2",
    equation: "S + O₂ → SO₂",
    reactants: [
      { formula: "S", n: 1, atoms: { S: 1 } },
      { formula: "O₂", n: 1, atoms: { O: 2 } },
    ],
    products: [{ formula: "SO₂", n: 1, atoms: { S: 1, O: 2 } }],
    reactionType: "combustion",
    kind: "covalent",
    dH: -296.8,
    flash: 0.65,
    exo: true,
    flame: true,
    typeUz: "Yonish",
    geometryUz: "Bukik · O–S–O 119°",
    hookUz: "Gugurt hidi — suvdan kengroq burchak, kislotali yomgʻir manbai.",
    flashColor: "#9ec5ff",
    structure: SULFUR_DIOXIDE,
  }),
  makeReaction({
    id: "hcl",
    equation: "H₂ + Cl₂ → 2HCl",
    reactants: [
      { formula: "H₂", n: 1, atoms: { H: 2 } },
      { formula: "Cl₂", n: 1, atoms: { Cl: 2 } },
    ],
    products: [{ formula: "HCl", n: 2, atoms: { H: 1, Cl: 1 } }],
    reactionType: "synthesis",
    kind: "covalent",
    dH: -184.6,
    flash: 0.8,
    exo: true,
    photo: true,
    typeUz: "Fotokimyoviy",
    geometryUz: "Chiziqli · yakka bogʻ",
    hookUz: "Qorongʻida tinch — yorugʻlikda portlaydi; oshqozon kislotasiga eriydi.",
    flashColor: "#fff0a0",
    structure: HYDROGEN_CHLORIDE,
  }),
  makeReaction({
    id: "nacl",
    equation: "2Na + Cl₂ → 2NaCl",
    reactants: [
      { formula: "Na", n: 2, atoms: { Na: 1 } },
      { formula: "Cl₂", n: 1, atoms: { Cl: 2 } },
    ],
    products: [{ formula: "NaCl", n: 2, atoms: { Na: 1, Cl: 1 } }],
    reactionType: "synthesis",
    kind: "ionic",
    dH: -822,
    flash: 1.0,
    exo: true,
    typeUz: "Ion · oksidlanish-qaytarilish",
    geometryUz: "Tosh-tuz kubik panjarasi",
    hookUz: "Yumshoq metall + zaharli gaz → osh tuzi.",
    flashColor: "#fff4d0",
    structure: SODIUM_CHLORIDE,
  }),
  makeReaction({
    id: "mgo",
    equation: "2Mg + O₂ → 2MgO",
    reactants: [
      { formula: "Mg", n: 2, atoms: { Mg: 1 } },
      { formula: "O₂", n: 1, atoms: { O: 2 } },
    ],
    products: [{ formula: "MgO", n: 2, atoms: { Mg: 1, O: 1 } }],
    reactionType: "synthesis",
    kind: "ionic",
    dH: -1202,
    flash: 1.0,
    exo: true,
    typeUz: "Yonish · ion",
    geometryUz: "Kubik ion panjara",
    hookUz: "Magniy lentasi koʻzni qamashtirib oq nur sochib yonadi.",
    flashColor: "#ffffff",
    structure: MAGNESIUM_OXIDE,
  }),
  makeReaction({
    id: "rust",
    equation: "4Fe + 3O₂ → 2Fe₂O₃",
    reactants: [
      { formula: "Fe", n: 4, atoms: { Fe: 1 } },
      { formula: "O₂", n: 3, atoms: { O: 2 } },
    ],
    products: [{ formula: "Fe₂O₃", n: 2, atoms: { Fe: 2, O: 3 } }],
    reactionType: "synthesis",
    kind: "ionic",
    dH: -1648,
    flash: 0.0,
    exo: true,
    slow: true,
    typeUz: "Sekin oksidlanish",
    geometryUz: "Korund ion panjarasi",
    hookUz: "Zang — temirning yonishining sekin koʻrinishi (alangasiz).",
    flashColor: "#d98a4a",
    structure: IRON_OXIDE,
  }),

  // ===== DECOMPOSITION — one molecule SPLITS into many =====================
  makeReaction({
    id: "water-split",
    equation: "2H₂O → 2H₂ + O₂",
    reactants: [{ formula: "H₂O", n: 2, atoms: { H: 2, O: 1 } }],
    products: [
      { formula: "H₂", n: 2, atoms: { H: 2 } },
      { formula: "O₂", n: 1, atoms: { O: 2 } },
    ],
    reactionType: "decomposition",
    kind: "covalent",
    dH: 571.6, // reverse of water formation → endothermic
    flash: 0.4, // a COOL chill (energy absorbed), not a warm bloom
    exo: false,
    typeUz: "Parchalanish · elektroliz",
    geometryUz: "Suv ajraladi → H₂ + O₂",
    hookUz: "Suvga tok berilsa — vodorod va kislorodga ajraladi (elektroliz).",
    flashColor: "#7db8ff",
    structure: WATER, // the molecule that splits
  }),
  makeReaction({
    id: "limestone",
    equation: "CaCO₃ → CaO + CO₂",
    reactants: [{ formula: "CaCO₃", n: 1, atoms: { Ca: 1, C: 1, O: 3 } }],
    products: [
      { formula: "CaO", n: 1, atoms: { Ca: 1, O: 1 } },
      { formula: "CO₂", n: 1, atoms: { C: 1, O: 2 } },
    ],
    reactionType: "decomposition",
    kind: "covalent",
    dH: 178, // calcination, strongly endothermic
    flash: 0.35,
    exo: false,
    typeUz: "Parchalanish · termik",
    geometryUz: "Ohaktosh → ohak + CO₂",
    hookUz: "Ohaktosh qizdiriladi → soʻndirilmagan ohak + gaz; sement asosi.",
    flashColor: "#ffd27a",
    structure: CARBON_DIOXIDE, // CO₂ flies off as the gas
  }),
  makeReaction({
    id: "mercury-oxide",
    equation: "2HgO → 2Hg + O₂",
    reactants: [{ formula: "HgO", n: 2, atoms: { Hg: 1, O: 1 } }],
    products: [
      { formula: "Hg", n: 2, atoms: { Hg: 1 } },
      { formula: "O₂", n: 1, atoms: { O: 2 } },
    ],
    reactionType: "decomposition",
    kind: "covalent",
    dH: 181.6, // 2×90.8, endothermic
    flash: 0.35,
    exo: false,
    typeUz: "Parchalanish · termik",
    geometryUz: "Qizil HgO → simob + kislorod",
    hookUz: "Priestli shu tajriba bilan kislorodni kashf etgan (1774).",
    flashColor: "#ffb066",
    structure: MERCURY, // metallic mercury beads out
  }),

  // ===== SINGLE DISPLACEMENT — one element kicks out another ================
  makeReaction({
    id: "zinc-acid",
    equation: "Zn + 2HCl → ZnCl₂ + H₂",
    reactants: [
      { formula: "Zn", n: 1, atoms: { Zn: 1 } },
      { formula: "HCl", n: 2, atoms: { H: 1, Cl: 1 } },
    ],
    products: [
      { formula: "ZnCl₂", n: 1, atoms: { Zn: 1, Cl: 2 } },
      { formula: "H₂", n: 1, atoms: { H: 2 } },
    ],
    reactionType: "single-displacement",
    kind: "covalent",
    dH: -153.9,
    flash: 0.35,
    exo: true,
    typeUz: "Oʻrin olish · metall+kislota",
    geometryUz: "Zn H ni siqib chiqaradi → H₂ koʻpiradi",
    hookUz: "Sink kislotaga tashlansa — vodorod pufakchalari chiqadi.",
    flashColor: "#bfe0ff",
    structure: ZINC_CHLORIDE,
  }),
  makeReaction({
    id: "iron-copper",
    equation: "Fe + CuSO₄ → FeSO₄ + Cu",
    reactants: [
      { formula: "Fe", n: 1, atoms: { Fe: 1 } },
      { formula: "CuSO₄", n: 1, atoms: { Cu: 1, S: 1, O: 4 } },
    ],
    products: [
      { formula: "FeSO₄", n: 1, atoms: { Fe: 1, S: 1, O: 4 } },
      { formula: "Cu", n: 1, atoms: { Cu: 1 } },
    ],
    reactionType: "single-displacement",
    kind: "covalent",
    dH: -149,
    flash: 0.2,
    exo: true,
    typeUz: "Oʻrin olish · faollik qatori",
    geometryUz: "Temir misni eritmadan siqib chiqaradi",
    hookUz: "Temir mixni mis kuporosiga botir — ustiga mis qatlami oʻtiradi.",
    flashColor: "#e8a24a",
    structure: COPPER_METAL, // copper plates out as a metal
  }),
  makeReaction({
    id: "sodium-water",
    equation: "2Na + 2H₂O → 2NaOH + H₂",
    reactants: [
      { formula: "Na", n: 2, atoms: { Na: 1 } },
      { formula: "H₂O", n: 2, atoms: { H: 2, O: 1 } },
    ],
    products: [
      { formula: "NaOH", n: 2, atoms: { Na: 1, O: 1, H: 1 } },
      { formula: "H₂", n: 1, atoms: { H: 2 } },
    ],
    reactionType: "single-displacement",
    kind: "covalent",
    dH: -368,
    flash: 0.85,
    exo: true,
    typeUz: "Oʻrin olish · shiddatli",
    geometryUz: "Natriy suvdan H ni siqib chiqaradi",
    hookUz: "Bir boʻlak natriy suvda chirsillab uchadi — H₂ yonadi.",
    flashColor: "#ffe08a",
    structure: SODIUM_HYDROXIDE,
  }),

  // ===== DOUBLE DISPLACEMENT / PRECIPITATION — partners SWAP, solid falls ===
  makeReaction({
    id: "silver-chloride",
    equation: "AgNO₃ + NaCl → AgCl↓ + NaNO₃",
    reactants: [
      { formula: "AgNO₃", n: 1, atoms: { Ag: 1, N: 1, O: 3 } },
      { formula: "NaCl", n: 1, atoms: { Na: 1, Cl: 1 } },
    ],
    products: [
      { formula: "AgCl", n: 1, atoms: { Ag: 1, Cl: 1 } },
      { formula: "NaNO₃", n: 1, atoms: { Na: 1, N: 1, O: 3 } },
    ],
    reactionType: "double-displacement",
    kind: "ionic",
    dH: -65.7,
    flash: 0.0,
    exo: true,
    precipitate: "AgCl",
    typeUz: "Almashinish · choʻkma",
    geometryUz: "Oq AgCl choʻkmasi tushadi",
    hookUz: "Ikki tiniq eritma qoʻshilsa — oppoq AgCl loyqasi choʻkadi.",
    flashColor: "#e6ecf2",
    structure: SILVER_CHLORIDE,
  }),
  makeReaction({
    id: "barium-sulfate",
    equation: "BaCl₂ + Na₂SO₄ → BaSO₄↓ + 2NaCl",
    reactants: [
      { formula: "BaCl₂", n: 1, atoms: { Ba: 1, Cl: 2 } },
      { formula: "Na₂SO₄", n: 1, atoms: { Na: 2, S: 1, O: 4 } },
    ],
    products: [
      { formula: "BaSO₄", n: 1, atoms: { Ba: 1, S: 1, O: 4 } },
      { formula: "NaCl", n: 2, atoms: { Na: 1, Cl: 1 } },
    ],
    reactionType: "double-displacement",
    kind: "ionic",
    dH: -25,
    flash: 0.0,
    exo: true,
    precipitate: "BaSO₄",
    typeUz: "Almashinish · choʻkma",
    geometryUz: "Oq BaSO₄ choʻkmasi tushadi",
    hookUz: "BaSO₄ — rentgenda ichakni koʻrsatadigan «bariy boʻtqasi».",
    flashColor: "#eef2f6",
    structure: BARIUM_SULFATE,
  }),

  // ===== COMBUSTION — hydrocarbon + O₂ → CO₂ + H₂O, flame ===================
  makeReaction({
    id: "methane-burn",
    equation: "CH₄ + 2O₂ → CO₂ + 2H₂O",
    reactants: [
      { formula: "CH₄", n: 1, atoms: { C: 1, H: 4 } },
      { formula: "O₂", n: 2, atoms: { O: 2 } },
    ],
    products: [
      { formula: "CO₂", n: 1, atoms: { C: 1, O: 2 } },
      { formula: "H₂O", n: 2, atoms: { H: 2, O: 1 } },
    ],
    reactionType: "combustion",
    kind: "covalent",
    dH: -890.3,
    flash: 0.95,
    exo: true,
    flame: true,
    typeUz: "Yonish · uglevodorod",
    geometryUz: "Tabiiy gaz yonadi → CO₂ + suv",
    hookUz: "Gaz plitasidagi koʻk alanga — metan yonishi shu.",
    flashColor: "#ff9e4a",
    structure: CARBON_DIOXIDE,
  }),

  // ===== ACID–BASE NEUTRALIZATION — H⁺ + OH⁻ → water =======================
  makeReaction({
    id: "neutralize-hcl",
    equation: "HCl + NaOH → NaCl + H₂O",
    reactants: [
      { formula: "HCl", n: 1, atoms: { H: 1, Cl: 1 } },
      { formula: "NaOH", n: 1, atoms: { Na: 1, O: 1, H: 1 } },
    ],
    products: [
      { formula: "NaCl", n: 1, atoms: { Na: 1, Cl: 1 } },
      { formula: "H₂O", n: 1, atoms: { H: 2, O: 1 } },
    ],
    reactionType: "neutralization",
    kind: "covalent",
    dH: -57.3,
    flash: 0.3,
    exo: true,
    typeUz: "Neytrallanish · kislota+ishqor",
    geometryUz: "H⁺ + OH⁻ → suv, qolgani tuz",
    hookUz: "Oshqozon kislotasini soda neytrallaydi — natijada tuz va suv.",
    flashColor: "#ffd27a",
    structure: WATER, // water is the signature product
  }),
  makeReaction({
    id: "neutralize-h2so4",
    equation: "H₂SO₄ + 2NaOH → Na₂SO₄ + 2H₂O",
    reactants: [
      { formula: "H₂SO₄", n: 1, atoms: { H: 2, S: 1, O: 4 } },
      { formula: "NaOH", n: 2, atoms: { Na: 1, O: 1, H: 1 } },
    ],
    products: [
      { formula: "Na₂SO₄", n: 1, atoms: { Na: 2, S: 1, O: 4 } },
      { formula: "H₂O", n: 2, atoms: { H: 2, O: 1 } },
    ],
    reactionType: "neutralization",
    kind: "covalent",
    dH: -114.6,
    flash: 0.4,
    exo: true,
    typeUz: "Neytrallanish · kuchli kislota",
    geometryUz: "Ikki OH⁻ → ikki suv molekulasi",
    hookUz: "Kuchli kislota + ishqor — har H⁺ bitta OH⁻ bilan suv beradi.",
    flashColor: "#ffd27a",
    structure: WATER,
  }),
];

export const REACTION_BY_ID: Record<string, Reaction> = Object.fromEntries(
  REACTIONS.map((r) => [r.id, r]),
);

/**
 * Try to match a multiset of gathered atoms to a known reaction. Returns the
 * reaction whose required atom multiset EXACTLY equals the gathered set, else
 * null. (Exact match teaches conservation: leftovers don't react.)
 *
 * NOTE: a few reactions share the same reactant atom multiset (e.g. synthesis
 * `2H₂+O₂→2H₂O` vs decomposition `2H₂O→2H₂+O₂` both total H₄O₂). Free-drag
 * discovery returns the FIRST match in array order (deterministic), so the
 * synthesis wins; the alternative is explored explicitly via the picker
 * (`REACTION_BY_ID`/`loadReaction`). This is intentional — the type filter is
 * the right tool to surface the others.
 */
export function matchReaction(gathered: Record<string, number>): Reaction | null {
  for (const r of REACTIONS) {
    const need = r.requiredAtoms;
    const needKeys = Object.keys(need);
    const haveKeys = Object.keys(gathered).filter((k) => gathered[k] > 0);
    if (needKeys.length !== haveKeys.length) continue;
    let ok = true;
    for (const k of needKeys) {
      if (gathered[k] !== need[k]) {
        ok = false;
        break;
      }
    }
    if (ok) return r;
  }
  return null;
}

/** Reactions of a given pedagogical type (for the picker's type filter). */
export function reactionsOfType(type: ReactionType): Reaction[] {
  return REACTIONS.filter((r) => r.reactionType === type);
}

/** The distinct reaction types present in the dataset, in teaching order. */
export const REACTION_TYPE_ORDER: ReactionType[] = [
  "synthesis",
  "decomposition",
  "single-displacement",
  "double-displacement",
  "combustion",
  "neutralization",
];

/** Atom-count balance check for the live conservation readout (left vs right). */
export function balanceOf(r: Reaction): { el: string; left: number; right: number }[] {
  const left = totalAtoms(r.reactants);
  const right = totalAtoms(r.products);
  const els = Array.from(new Set([...Object.keys(left), ...Object.keys(right)]));
  return els.map((el) => ({ el, left: left[el] ?? 0, right: right[el] ?? 0 }));
}
