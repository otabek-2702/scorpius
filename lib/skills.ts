/**
 * Skill catalog — the atomization of the curriculum into testable units.
 *
 * Each Scorpius lesson covers 1–3 atomic skills. A skill is the smallest
 * concept the student can plausibly fail in isolation and that we can
 * write distinct items for. Prereqs encode the DAG that the scheduler walks
 * (mastery only counts when prereqs are themselves above the proficient
 * threshold).
 *
 * v1: 28 skills covering the 13 cached lessons. v2 expands to the textbook's
 * ~200 atomic units when the LLM authoring pipeline (Phase 4) ships.
 *
 * Storage is in-source; the mastery state per user lives separately in
 * lib/mastery.ts and points back here by `id`.
 */

export type Domain = "math" | "physics" | "chemistry" | "biology";

export interface Skill {
  id: string;
  /** Human-readable Uzbek (Latin) name — surfaced on the star tile under the percentage. */
  name: string;
  domain: Domain;
  /** Textbook chapter the skill belongs to — used for grouping and burj attribution. */
  unit: string;
  /** Skill ids that must be mastered before this one can be mastered. */
  prereqs: string[];
}

// ---- The catalog -----------------------------------------------------------

export const SKILLS: ReadonlyArray<Skill> = [
  // --- math · sonlar va kasrlar ---
  { id: "math.div.divisors",    name: "Bo'luvchilarni topish",   domain: "math",    unit: "divisibility", prereqs: [] },
  { id: "math.div.multiples",   name: "Karralilarni topish",     domain: "math",    unit: "divisibility", prereqs: [] },
  { id: "math.div.prime-test",  name: "Tub son tekshiruvi",      domain: "math",    unit: "divisibility", prereqs: ["math.div.divisors"] },
  { id: "math.gcd",             name: "EKUB hisoblash",           domain: "math",    unit: "gcd-lcm",      prereqs: ["math.div.divisors"] },
  { id: "math.lcm",             name: "EKUK hisoblash",           domain: "math",    unit: "gcd-lcm",      prereqs: ["math.div.multiples"] },
  { id: "math.frac.read",       name: "Kasrlarni o'qish",         domain: "math",    unit: "fractions",    prereqs: [] },
  { id: "math.frac.compare",    name: "Kasrlarni taqqoslash",     domain: "math",    unit: "fractions",    prereqs: ["math.frac.read"] },
  { id: "math.frac.reduce",     name: "Kasrni qisqartirish",      domain: "math",    unit: "fractions",    prereqs: ["math.gcd"] },

  // --- physics · I bob — modda tuzilishi ---
  { id: "phys.matter.molecule", name: "Molekulalar harakati",     domain: "physics", unit: "matter",       prereqs: [] },
  { id: "phys.matter.brown",    name: "Broun harakati",            domain: "physics", unit: "matter",       prereqs: ["phys.matter.molecule"] },
  { id: "phys.matter.diffusion",name: "Diffuziya",                 domain: "physics", unit: "matter",       prereqs: ["phys.matter.molecule"] },

  // --- physics · II bob — suyuqlik va bosim ---
  { id: "phys.fluid.pressure",  name: "Suyuqlikda bosim",          domain: "physics", unit: "fluids",       prereqs: [] },
  { id: "phys.fluid.pascal",    name: "Paskal qonuni",             domain: "physics", unit: "fluids",       prereqs: ["phys.fluid.pressure"] },
  { id: "phys.fluid.buoyancy",  name: "Arximed ko'tarish kuchi",   domain: "physics", unit: "fluids",       prereqs: ["phys.fluid.pressure"] },
  { id: "phys.fluid.density",   name: "Zichlik va suzish",         domain: "physics", unit: "fluids",       prereqs: ["phys.fluid.buoyancy"] },

  // --- physics · III bob — mexanika ---
  { id: "phys.mech.energy",     name: "Energiya saqlanishi",       domain: "physics", unit: "mechanics",    prereqs: [] },
  { id: "phys.mech.torque",     name: "Kuch momenti",              domain: "physics", unit: "mechanics",    prereqs: [] },
  { id: "phys.mech.equilibrium",name: "Muvozanat",                 domain: "physics", unit: "mechanics",    prereqs: ["phys.mech.torque"] },
  { id: "phys.mech.cycloid",    name: "Eng tez yo'l (sikloid)",   domain: "physics", unit: "mechanics",    prereqs: ["phys.mech.energy"] },

  // --- physics · V bob — elektr ---
  { id: "phys.elec.current",    name: "Elektr toki",               domain: "physics", unit: "electricity",  prereqs: [] },
  { id: "phys.elec.ohm",        name: "Om qonuni",                 domain: "physics", unit: "electricity",  prereqs: ["phys.elec.current"] },

  // --- physics · VI bob — yorug'lik ---
  { id: "phys.opt.shadow",      name: "Soya va yarim soya",        domain: "physics", unit: "optics",       prereqs: [] },
  { id: "phys.opt.eclipse",     name: "Quyosh va Oy tutilishi",    domain: "physics", unit: "optics",       prereqs: ["phys.opt.shadow"] },
  { id: "phys.opt.refraction",  name: "Yorug'likning sinishi",     domain: "physics", unit: "optics",       prereqs: [] },
  { id: "phys.opt.dispersion",  name: "Spektrga ajralish",         domain: "physics", unit: "optics",       prereqs: ["phys.opt.refraction"] },
  { id: "phys.opt.lens",        name: "Linza tenglamasi",          domain: "physics", unit: "optics",       prereqs: ["phys.opt.refraction"] },

  // --- physics · VII bob — tovush ---
  { id: "phys.wave.frequency",  name: "Tovush chastotasi",         domain: "physics", unit: "waves",        prereqs: [] },
  { id: "phys.wave.amplitude",  name: "Tovush amplitudasi",        domain: "physics", unit: "waves",        prereqs: [] },
];

// ---- Lesson → skill mapping ------------------------------------------------

/** Which skills each cached lesson exercises. The mastery engine reads this
 *  when a lesson's graded cards (mcq, discover, sequence, sort, numberline)
 *  fire — distributing attempts across the lesson's skills.  */
export const LESSON_SKILLS: Record<string, ReadonlyArray<string>> = {
  // math
  "boluvchi":       ["math.div.divisors", "math.div.multiples"],
  "ekub-ekuk":      ["math.gcd", "math.lcm"],
  "oddiy-kasr":     ["math.frac.read", "math.frac.compare", "math.frac.reduce"],
  // physics — matter
  "broun":          ["phys.matter.molecule", "phys.matter.brown", "phys.matter.diffusion"],
  // physics — fluids
  "arximed":        ["phys.fluid.buoyancy", "phys.fluid.density"],
  "paskal":         ["phys.fluid.pascal"],
  // physics — mechanics
  "richag":         ["phys.mech.torque", "phys.mech.equilibrium"],
  "brachistochrone":["phys.mech.cycloid", "phys.mech.energy"],
  // physics — electricity
  "zanjir":         ["phys.elec.current", "phys.elec.ohm"],
  // physics — optics
  "tutilish":       ["phys.opt.shadow", "phys.opt.eclipse"],
  "kamalak":        ["phys.opt.refraction", "phys.opt.dispersion"],
  "linza":          ["phys.opt.lens"],
  // physics — waves
  "tovush":         ["phys.wave.frequency", "phys.wave.amplitude"],
};

// ---- Lookups ---------------------------------------------------------------

const SKILL_BY_ID: Record<string, Skill> = Object.fromEntries(
  SKILLS.map((s) => [s.id, s] as const)
);

export function getSkill(id: string): Skill | undefined {
  return SKILL_BY_ID[id];
}

export function getLessonSkills(lessonId: string): ReadonlyArray<string> {
  return LESSON_SKILLS[lessonId] ?? [];
}

/** All skill ids whose unit matches. Used by the scheduler when it wants to
 *  draw mixed-context items from the same chapter. */
export function skillsInUnit(unit: string): ReadonlyArray<string> {
  return SKILLS.filter((s) => s.unit === unit).map((s) => s.id);
}
