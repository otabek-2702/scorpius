// lib/sims/chemistry/periodic.ts
/**
 * Full periodic table dataset for the Kimyo laboratoriyasi — the "Davriy jadval"
 * picker + the "Atomlar" Bohr-model viewer. PURE DATA + helpers, zero React.
 *
 * Each element carries its symbol, atomic number Z, standard (conventional)
 * atomic weight, CPK/Jmol display colour, and its position on the STANDARD
 * 18-column periodic-table grid (period 1..7 row, group 1..18 column). The
 * lanthanides + actinides are laid out on the conventional two extra rows
 * (rows 8 + 9 in grid space) under the main block.
 *
 * Atomic weights are IUPAC conventional values (CIAAW 2021), rounded for the
 * approximate neutron count of NON-curated elements: neutrons ≈ round(A) − Z.
 * The 19 LAB elements carry EXACT curated proton/neutron/shell values from
 * data.ts (this file's `shellsFromZ` Bohr filling is used only for the rest).
 *
 * Sources: CIAAW standard atomic weights (ciaaw.org), IUPAC periodic table.
 */

export interface PTElement {
  /** Atomic number Z. */
  z: number;
  /** Element symbol. */
  sym: string;
  /** Uzbek name (latin, proper okina U+02BB where needed). */
  nameUz: string;
  /** Standard / conventional atomic weight (u). */
  weight: number;
  /** CPK / Jmol hex colour for the tile. */
  color: string;
  /** Grid row (period for the main block; 8/9 for La/Ac series). */
  row: number;
  /** Grid column 1..18. */
  col: number;
  /** Category key → cell tint + legend. */
  cat: Category;
}

export type Category =
  | "alkali"
  | "alkaline"
  | "transition"
  | "post-transition"
  | "metalloid"
  | "nonmetal"
  | "halogen"
  | "noble"
  | "lanthanide"
  | "actinide";

/** Uzbek category labels for the legend. */
export const CATEGORY_UZ: Record<Category, string> = {
  alkali: "Ishqoriy metall",
  alkaline: "Ishqoriy-yer metall",
  transition: "Oʻtish metali",
  "post-transition": "Oʻtishdan keyingi metall",
  metalloid: "Metalloid",
  nonmetal: "Nometall",
  halogen: "Galogen",
  noble: "Inert gaz",
  lanthanide: "Lantanoid",
  actinide: "Aktinoid",
};

/** Soft category tints (cell background) — readable on the dark stage. */
export const CATEGORY_TINT: Record<Category, string> = {
  alkali: "#b6532f",
  alkaline: "#c6862b",
  transition: "#3d6d8c",
  "post-transition": "#4d6a78",
  metalloid: "#5a7d5a",
  nonmetal: "#2f7d54",
  halogen: "#2f8a8a",
  noble: "#6b4f9e",
  lanthanide: "#8a4d7a",
  actinide: "#a34d5a",
};

/**
 * Bohr-model electron-shell filling by the simple 2, 8, 8, 18, 18, 32, 32 rule.
 * This is the SIMPLE Bohr filling (NOT the Aufbau/Madelung order) — it is
 * intentionally labelled "Bor modeli" in the UI for the non-curated elements.
 * The 19 lab elements override this with their exact curated shells.
 */
export function shellsFromZ(z: number): number[] {
  const caps = [2, 8, 8, 18, 18, 32, 32];
  const shells: number[] = [];
  let remaining = z;
  for (const cap of caps) {
    if (remaining <= 0) break;
    const put = Math.min(cap, remaining);
    shells.push(put);
    remaining -= put;
  }
  if (remaining > 0) shells.push(remaining); // safety (never hit for Z ≤ 118)
  return shells;
}

/** Approximate neutron count for a non-curated element. */
export function approxNeutrons(z: number, weight: number): number {
  return Math.max(0, Math.round(weight) - z);
}

/**
 * The full 118-element table. row/col give the standard grid placement.
 * La (57) and Ac (89) sit in the main block (group 3); the rest of the
 * lanthanides/actinides occupy the two detached rows (row 8 col 4..17 and
 * row 9 col 4..17), the conventional textbook layout.
 */
export const PERIODIC: PTElement[] = [
  { z: 1, sym: "H", nameUz: "Vodorod", weight: 1.008, color: "#FFFFFF", row: 1, col: 1, cat: "nonmetal" },
  { z: 2, sym: "He", nameUz: "Geliy", weight: 4.0026, color: "#D9FFFF", row: 1, col: 18, cat: "noble" },

  { z: 3, sym: "Li", nameUz: "Litiy", weight: 6.94, color: "#CC80FF", row: 2, col: 1, cat: "alkali" },
  { z: 4, sym: "Be", nameUz: "Berilliy", weight: 9.0122, color: "#C2FF00", row: 2, col: 2, cat: "alkaline" },
  { z: 5, sym: "B", nameUz: "Bor", weight: 10.81, color: "#FFB5B5", row: 2, col: 13, cat: "metalloid" },
  { z: 6, sym: "C", nameUz: "Uglerod", weight: 12.011, color: "#909090", row: 2, col: 14, cat: "nonmetal" },
  { z: 7, sym: "N", nameUz: "Azot", weight: 14.007, color: "#3050F8", row: 2, col: 15, cat: "nonmetal" },
  { z: 8, sym: "O", nameUz: "Kislorod", weight: 15.999, color: "#FF0D0D", row: 2, col: 16, cat: "nonmetal" },
  { z: 9, sym: "F", nameUz: "Ftor", weight: 18.998, color: "#90E050", row: 2, col: 17, cat: "halogen" },
  { z: 10, sym: "Ne", nameUz: "Neon", weight: 20.180, color: "#B3E3F5", row: 2, col: 18, cat: "noble" },

  { z: 11, sym: "Na", nameUz: "Natriy", weight: 22.990, color: "#AB5CF2", row: 3, col: 1, cat: "alkali" },
  { z: 12, sym: "Mg", nameUz: "Magniy", weight: 24.305, color: "#8AFF00", row: 3, col: 2, cat: "alkaline" },
  { z: 13, sym: "Al", nameUz: "Alyuminiy", weight: 26.982, color: "#BFA6A6", row: 3, col: 13, cat: "post-transition" },
  { z: 14, sym: "Si", nameUz: "Kremniy", weight: 28.085, color: "#F0C8A0", row: 3, col: 14, cat: "metalloid" },
  { z: 15, sym: "P", nameUz: "Fosfor", weight: 30.974, color: "#FF8000", row: 3, col: 15, cat: "nonmetal" },
  { z: 16, sym: "S", nameUz: "Oltingugurt", weight: 32.06, color: "#FFFF30", row: 3, col: 16, cat: "nonmetal" },
  { z: 17, sym: "Cl", nameUz: "Xlor", weight: 35.45, color: "#1FF01F", row: 3, col: 17, cat: "halogen" },
  { z: 18, sym: "Ar", nameUz: "Argon", weight: 39.95, color: "#80D1E3", row: 3, col: 18, cat: "noble" },

  { z: 19, sym: "K", nameUz: "Kaliy", weight: 39.098, color: "#8F40D4", row: 4, col: 1, cat: "alkali" },
  { z: 20, sym: "Ca", nameUz: "Kalsiy", weight: 40.078, color: "#3DFF00", row: 4, col: 2, cat: "alkaline" },
  { z: 21, sym: "Sc", nameUz: "Skandiy", weight: 44.956, color: "#E6E6E6", row: 4, col: 3, cat: "transition" },
  { z: 22, sym: "Ti", nameUz: "Titan", weight: 47.867, color: "#BFC2C7", row: 4, col: 4, cat: "transition" },
  { z: 23, sym: "V", nameUz: "Vanadiy", weight: 50.942, color: "#A6A6AB", row: 4, col: 5, cat: "transition" },
  { z: 24, sym: "Cr", nameUz: "Xrom", weight: 51.996, color: "#8A99C7", row: 4, col: 6, cat: "transition" },
  { z: 25, sym: "Mn", nameUz: "Marganes", weight: 54.938, color: "#9C7AC7", row: 4, col: 7, cat: "transition" },
  { z: 26, sym: "Fe", nameUz: "Temir", weight: 55.845, color: "#E06633", row: 4, col: 8, cat: "transition" },
  { z: 27, sym: "Co", nameUz: "Kobalt", weight: 58.933, color: "#F090A0", row: 4, col: 9, cat: "transition" },
  { z: 28, sym: "Ni", nameUz: "Nikel", weight: 58.693, color: "#50D050", row: 4, col: 10, cat: "transition" },
  { z: 29, sym: "Cu", nameUz: "Mis", weight: 63.546, color: "#C88033", row: 4, col: 11, cat: "transition" },
  { z: 30, sym: "Zn", nameUz: "Rux", weight: 65.38, color: "#7D80B0", row: 4, col: 12, cat: "transition" },
  { z: 31, sym: "Ga", nameUz: "Galliy", weight: 69.723, color: "#C28F8F", row: 4, col: 13, cat: "post-transition" },
  { z: 32, sym: "Ge", nameUz: "Germaniy", weight: 72.630, color: "#668F8F", row: 4, col: 14, cat: "metalloid" },
  { z: 33, sym: "As", nameUz: "Margimush", weight: 74.922, color: "#BD80E3", row: 4, col: 15, cat: "metalloid" },
  { z: 34, sym: "Se", nameUz: "Selen", weight: 78.971, color: "#FFA100", row: 4, col: 16, cat: "nonmetal" },
  { z: 35, sym: "Br", nameUz: "Brom", weight: 79.904, color: "#A62929", row: 4, col: 17, cat: "halogen" },
  { z: 36, sym: "Kr", nameUz: "Kripton", weight: 83.798, color: "#5CB8D1", row: 4, col: 18, cat: "noble" },

  { z: 37, sym: "Rb", nameUz: "Rubidiy", weight: 85.468, color: "#702EB0", row: 5, col: 1, cat: "alkali" },
  { z: 38, sym: "Sr", nameUz: "Stronsiy", weight: 87.62, color: "#00FF00", row: 5, col: 2, cat: "alkaline" },
  { z: 39, sym: "Y", nameUz: "Ittriy", weight: 88.906, color: "#94FFFF", row: 5, col: 3, cat: "transition" },
  { z: 40, sym: "Zr", nameUz: "Sirkoniy", weight: 91.224, color: "#94E0E0", row: 5, col: 4, cat: "transition" },
  { z: 41, sym: "Nb", nameUz: "Niobiy", weight: 92.906, color: "#73C2C9", row: 5, col: 5, cat: "transition" },
  { z: 42, sym: "Mo", nameUz: "Molibden", weight: 95.95, color: "#54B5B5", row: 5, col: 6, cat: "transition" },
  { z: 43, sym: "Tc", nameUz: "Texnetsiy", weight: 98, color: "#3B9E9E", row: 5, col: 7, cat: "transition" },
  { z: 44, sym: "Ru", nameUz: "Ruteniy", weight: 101.07, color: "#248F8F", row: 5, col: 8, cat: "transition" },
  { z: 45, sym: "Rh", nameUz: "Rodiy", weight: 102.91, color: "#0A7D8C", row: 5, col: 9, cat: "transition" },
  { z: 46, sym: "Pd", nameUz: "Palladiy", weight: 106.42, color: "#006985", row: 5, col: 10, cat: "transition" },
  { z: 47, sym: "Ag", nameUz: "Kumush", weight: 107.87, color: "#C0C0C0", row: 5, col: 11, cat: "transition" },
  { z: 48, sym: "Cd", nameUz: "Kadmiy", weight: 112.41, color: "#FFD98F", row: 5, col: 12, cat: "transition" },
  { z: 49, sym: "In", nameUz: "Indiy", weight: 114.82, color: "#A67573", row: 5, col: 13, cat: "post-transition" },
  { z: 50, sym: "Sn", nameUz: "Qalay", weight: 118.71, color: "#668080", row: 5, col: 14, cat: "post-transition" },
  { z: 51, sym: "Sb", nameUz: "Surma", weight: 121.76, color: "#9E63B5", row: 5, col: 15, cat: "metalloid" },
  { z: 52, sym: "Te", nameUz: "Tellur", weight: 127.60, color: "#D47A00", row: 5, col: 16, cat: "metalloid" },
  { z: 53, sym: "I", nameUz: "Yod", weight: 126.90, color: "#940094", row: 5, col: 17, cat: "halogen" },
  { z: 54, sym: "Xe", nameUz: "Ksenon", weight: 131.29, color: "#429EB0", row: 5, col: 18, cat: "noble" },

  { z: 55, sym: "Cs", nameUz: "Seziy", weight: 132.91, color: "#57178F", row: 6, col: 1, cat: "alkali" },
  { z: 56, sym: "Ba", nameUz: "Bariy", weight: 137.33, color: "#00C900", row: 6, col: 2, cat: "alkaline" },
  { z: 57, sym: "La", nameUz: "Lantan", weight: 138.91, color: "#70D4FF", row: 6, col: 3, cat: "lanthanide" },
  { z: 72, sym: "Hf", nameUz: "Gafniy", weight: 178.49, color: "#4DC2FF", row: 6, col: 4, cat: "transition" },
  { z: 73, sym: "Ta", nameUz: "Tantal", weight: 180.95, color: "#4DA6FF", row: 6, col: 5, cat: "transition" },
  { z: 74, sym: "W", nameUz: "Volfram", weight: 183.84, color: "#2194D6", row: 6, col: 6, cat: "transition" },
  { z: 75, sym: "Re", nameUz: "Reniy", weight: 186.21, color: "#267DAB", row: 6, col: 7, cat: "transition" },
  { z: 76, sym: "Os", nameUz: "Osmiy", weight: 190.23, color: "#266696", row: 6, col: 8, cat: "transition" },
  { z: 77, sym: "Ir", nameUz: "Iridiy", weight: 192.22, color: "#175487", row: 6, col: 9, cat: "transition" },
  { z: 78, sym: "Pt", nameUz: "Platina", weight: 195.08, color: "#D0D0E0", row: 6, col: 10, cat: "transition" },
  { z: 79, sym: "Au", nameUz: "Oltin", weight: 196.97, color: "#FFD123", row: 6, col: 11, cat: "transition" },
  { z: 80, sym: "Hg", nameUz: "Simob", weight: 200.59, color: "#B8B8D0", row: 6, col: 12, cat: "transition" },
  { z: 81, sym: "Tl", nameUz: "Talliy", weight: 204.38, color: "#A6544D", row: 6, col: 13, cat: "post-transition" },
  { z: 82, sym: "Pb", nameUz: "Qoʻrgʻoshin", weight: 207.2, color: "#575961", row: 6, col: 14, cat: "post-transition" },
  { z: 83, sym: "Bi", nameUz: "Vismut", weight: 208.98, color: "#9E4FB5", row: 6, col: 15, cat: "post-transition" },
  { z: 84, sym: "Po", nameUz: "Poloniy", weight: 209, color: "#AB5C00", row: 6, col: 16, cat: "post-transition" },
  { z: 85, sym: "At", nameUz: "Astat", weight: 210, color: "#754F45", row: 6, col: 17, cat: "halogen" },
  { z: 86, sym: "Rn", nameUz: "Radon", weight: 222, color: "#428296", row: 6, col: 18, cat: "noble" },

  { z: 87, sym: "Fr", nameUz: "Fransiy", weight: 223, color: "#420066", row: 7, col: 1, cat: "alkali" },
  { z: 88, sym: "Ra", nameUz: "Radiy", weight: 226, color: "#007D00", row: 7, col: 2, cat: "alkaline" },
  { z: 89, sym: "Ac", nameUz: "Aktiniy", weight: 227, color: "#70ABFA", row: 7, col: 3, cat: "actinide" },
  { z: 104, sym: "Rf", nameUz: "Rezerfordiy", weight: 267, color: "#4DC2FF", row: 7, col: 4, cat: "transition" },
  { z: 105, sym: "Db", nameUz: "Dubniy", weight: 268, color: "#4DA6FF", row: 7, col: 5, cat: "transition" },
  { z: 106, sym: "Sg", nameUz: "Siborgiy", weight: 269, color: "#2194D6", row: 7, col: 6, cat: "transition" },
  { z: 107, sym: "Bh", nameUz: "Boriy", weight: 270, color: "#267DAB", row: 7, col: 7, cat: "transition" },
  { z: 108, sym: "Hs", nameUz: "Xassiy", weight: 269, color: "#266696", row: 7, col: 8, cat: "transition" },
  { z: 109, sym: "Mt", nameUz: "Meytneriy", weight: 278, color: "#175487", row: 7, col: 9, cat: "transition" },
  { z: 110, sym: "Ds", nameUz: "Darmshtadtiy", weight: 281, color: "#A0A0C0", row: 7, col: 10, cat: "transition" },
  { z: 111, sym: "Rg", nameUz: "Rentgeniy", weight: 282, color: "#C0C0C0", row: 7, col: 11, cat: "transition" },
  { z: 112, sym: "Cn", nameUz: "Kopernitsiy", weight: 285, color: "#B8B8D0", row: 7, col: 12, cat: "transition" },
  { z: 113, sym: "Nh", nameUz: "Nihoniy", weight: 286, color: "#A6544D", row: 7, col: 13, cat: "post-transition" },
  { z: 114, sym: "Fl", nameUz: "Fleroviy", weight: 289, color: "#575961", row: 7, col: 14, cat: "post-transition" },
  { z: 115, sym: "Mc", nameUz: "Moskoviy", weight: 290, color: "#9E4FB5", row: 7, col: 15, cat: "post-transition" },
  { z: 116, sym: "Lv", nameUz: "Livermoriy", weight: 293, color: "#AB5C00", row: 7, col: 16, cat: "post-transition" },
  { z: 117, sym: "Ts", nameUz: "Tennessin", weight: 294, color: "#754F45", row: 7, col: 17, cat: "halogen" },
  { z: 118, sym: "Og", nameUz: "Oganeson", weight: 294, color: "#428296", row: 7, col: 18, cat: "noble" },

  // ---- lanthanides (period 6 f-block) → detached row 8, cols 4..17 ----
  { z: 58, sym: "Ce", nameUz: "Seriy", weight: 140.12, color: "#FFFFC7", row: 8, col: 4, cat: "lanthanide" },
  { z: 59, sym: "Pr", nameUz: "Prazeodim", weight: 140.91, color: "#D9FFC7", row: 8, col: 5, cat: "lanthanide" },
  { z: 60, sym: "Nd", nameUz: "Neodim", weight: 144.24, color: "#C7FFC7", row: 8, col: 6, cat: "lanthanide" },
  { z: 61, sym: "Pm", nameUz: "Prometiy", weight: 145, color: "#A3FFC7", row: 8, col: 7, cat: "lanthanide" },
  { z: 62, sym: "Sm", nameUz: "Samariy", weight: 150.36, color: "#8FFFC7", row: 8, col: 8, cat: "lanthanide" },
  { z: 63, sym: "Eu", nameUz: "Yevropiy", weight: 151.96, color: "#61FFC7", row: 8, col: 9, cat: "lanthanide" },
  { z: 64, sym: "Gd", nameUz: "Gadoliniy", weight: 157.25, color: "#45FFC7", row: 8, col: 10, cat: "lanthanide" },
  { z: 65, sym: "Tb", nameUz: "Terbiy", weight: 158.93, color: "#30FFC7", row: 8, col: 11, cat: "lanthanide" },
  { z: 66, sym: "Dy", nameUz: "Disproziy", weight: 162.50, color: "#1FFFC7", row: 8, col: 12, cat: "lanthanide" },
  { z: 67, sym: "Ho", nameUz: "Golmiy", weight: 164.93, color: "#00FF9C", row: 8, col: 13, cat: "lanthanide" },
  { z: 68, sym: "Er", nameUz: "Erbiy", weight: 167.26, color: "#00E675", row: 8, col: 14, cat: "lanthanide" },
  { z: 69, sym: "Tm", nameUz: "Tuliy", weight: 168.93, color: "#00D452", row: 8, col: 15, cat: "lanthanide" },
  { z: 70, sym: "Yb", nameUz: "Itterbiy", weight: 173.05, color: "#00BF38", row: 8, col: 16, cat: "lanthanide" },
  { z: 71, sym: "Lu", nameUz: "Lutetsiy", weight: 174.97, color: "#00AB24", row: 8, col: 17, cat: "lanthanide" },

  // ---- actinides (period 7 f-block) → detached row 9, cols 4..17 ----
  { z: 90, sym: "Th", nameUz: "Toriy", weight: 232.04, color: "#00BAFF", row: 9, col: 4, cat: "actinide" },
  { z: 91, sym: "Pa", nameUz: "Protaktiniy", weight: 231.04, color: "#00A1FF", row: 9, col: 5, cat: "actinide" },
  { z: 92, sym: "U", nameUz: "Uran", weight: 238.03, color: "#008FFF", row: 9, col: 6, cat: "actinide" },
  { z: 93, sym: "Np", nameUz: "Neptuniy", weight: 237, color: "#0080FF", row: 9, col: 7, cat: "actinide" },
  { z: 94, sym: "Pu", nameUz: "Plutoniy", weight: 244, color: "#006BFF", row: 9, col: 8, cat: "actinide" },
  { z: 95, sym: "Am", nameUz: "Ameritsiy", weight: 243, color: "#545CF2", row: 9, col: 9, cat: "actinide" },
  { z: 96, sym: "Cm", nameUz: "Kyuriy", weight: 247, color: "#785CE3", row: 9, col: 10, cat: "actinide" },
  { z: 97, sym: "Bk", nameUz: "Berkliy", weight: 247, color: "#8A4FE3", row: 9, col: 11, cat: "actinide" },
  { z: 98, sym: "Cf", nameUz: "Kaliforniy", weight: 251, color: "#A136D4", row: 9, col: 12, cat: "actinide" },
  { z: 99, sym: "Es", nameUz: "Eynshteyniy", weight: 252, color: "#B31FD4", row: 9, col: 13, cat: "actinide" },
  { z: 100, sym: "Fm", nameUz: "Fermiy", weight: 257, color: "#B31FBA", row: 9, col: 14, cat: "actinide" },
  { z: 101, sym: "Md", nameUz: "Mendeleeviy", weight: 258, color: "#B30DA6", row: 9, col: 15, cat: "actinide" },
  { z: 102, sym: "No", nameUz: "Nobeliy", weight: 259, color: "#BD0D87", row: 9, col: 16, cat: "actinide" },
  { z: 103, sym: "Lr", nameUz: "Lourensiy", weight: 262, color: "#C70066", row: 9, col: 17, cat: "actinide" },
];

/** Quick lookup by symbol. */
export const PT_BY_SYM: Record<string, PTElement> = Object.fromEntries(
  PERIODIC.map((e) => [e.sym, e]),
);

/** The grid spans 18 columns × 9 rows (7 main + La/Ac series rows 8,9). */
export const PT_COLS = 18;
export const PT_ROWS = 9;
