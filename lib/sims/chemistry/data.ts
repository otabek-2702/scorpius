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
};

/** Palette order shown in the element tray (draggable tiles). */
export const PALETTE: string[] = ["H", "O", "N", "C", "S", "Cl", "Na", "Mg", "Fe"];

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

export interface Reaction {
  id: string;
  /** Pretty balanced equation for the readout (with subscripts + arrow). */
  equation: string;
  /** Left-hand species (reactants). */
  reactants: SpeciesCount[];
  /** Right-hand species (products). */
  products: SpeciesCount[];
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
   * molecule or one formula unit of the ionic lattice).
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

// Ammonia NH₃ — trigonal pyramidal, H-N-H 107.3°, N-H 1.01 Å
const AMMONIA: ProductStructure = {
  atoms: [
    { el: "N", x: 0, y: 0, z: 0 },
    { el: "H", x: 0.94, y: -0.33, z: 0 },
    { el: "H", x: -0.47, y: -0.33, z: 0.814 },
    { el: "H", x: -0.47, y: -0.33, z: -0.814 },
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
    kind: "covalent",
    dH: -393.5,
    flash: 0.7,
    exo: true,
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
    kind: "covalent",
    dH: -296.8,
    flash: 0.65,
    exo: true,
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
];

export const REACTION_BY_ID: Record<string, Reaction> = Object.fromEntries(
  REACTIONS.map((r) => [r.id, r]),
);

/**
 * Try to match a multiset of gathered atoms to a known reaction. Returns the
 * reaction whose required atom multiset EXACTLY equals the gathered set, else
 * null. (Exact match teaches conservation: leftovers don't react.)
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

/** Atom-count balance check for the live conservation readout (left vs right). */
export function balanceOf(r: Reaction): { el: string; left: number; right: number }[] {
  const left = totalAtoms(r.reactants);
  const right = totalAtoms(r.products);
  const els = Array.from(new Set([...Object.keys(left), ...Object.keys(right)]));
  return els.map((el) => ({ el, left: left[el] ?? 0, right: right[el] ?? 0 }));
}
