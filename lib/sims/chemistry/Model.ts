// lib/sims/chemistry/Model.ts
/**
 * ChemistryModel — molecular-assembly lab implementing SimModel.
 *
 * The learner gathers atoms (drag from a palette, or pick a featured reaction);
 * when the gathered multiset equals a known balanced reaction the model arms,
 * then on react() it ASSEMBLES: scattered reactant atoms ease along curved
 * paths into the true product geometry (ångström, from data.ts), bonds grow in,
 * and an energy flash fires scaled by ΔH. Ionic reactions add an electron-jump
 * + a packing cubic lattice.
 *
 * Architecture law (AGENTS.md): the model computes, the view paints. ALL state
 * is Property<T>; this file is pure TS, zero React. A single rAF loop in the
 * view calls step(dt). See model.md for the state machine, easing scheme,
 * units, and the declared simplifications.
 */
import { Property } from "@/lib/sim/observable/Property";
import type { SimModel } from "@/lib/sim/SimModel";
import {
  ATOMS,
  REACTIONS,
  REACTION_BY_ID,
  matchReaction,
  type Reaction,
  type ProductStructure,
} from "./data";

export type Phase = "idle" | "armed" | "assembling" | "product";

/** An atom the user has gathered into the chamber (pre-reaction). */
export interface TrayAtom {
  id: number;
  el: string;
}

/**
 * A scene atom during assembly: eases from a scattered start to its slot in the
 * product geometry. Positions are in ångström (molecule frame). The view maps
 * Å → px (Variant A) or feeds Å straight to 3Dmol (Variant B).
 */
export interface SceneAtom {
  id: number;
  el: string;
  /** Scattered start (Å). */
  sx: number;
  sy: number;
  sz: number;
  /** Assembled target = product geometry slot (Å). */
  tx: number;
  ty: number;
  tz: number;
  /** Perpendicular curl offset magnitude (Å) for a slight swirl-in arc. */
  curl: number;
  /** Index into structure.atoms (so bonds can reference scene atoms). */
  slot: number;
  /** For ionic: +1 cation, -1 anion, 0 covalent (drives radius scaling). */
  ion: number;
}

export interface SceneBond {
  a: number; // scene atom index
  b: number;
  order: number;
}

const T_ASSEMBLE = 1.15; // s — covalent assembly time
const T_ASSEMBLE_SLOW = 3.4; // s — rust (slow oxidation)
const FLASH_AT = 0.62; // progress where atoms "make contact" → flash fires
const FLASH_TAU = 0.5; // s — flash decay time constant
const FLASH_TAU_SLOW = 1.6; // s — slow warm spread

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Deterministic pseudo-random in [-1,1] from an integer seed. */
function seeded(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

/**
 * Build scene atoms for a reaction: each product-geometry slot gets a scattered
 * start ring around the chamber and a curl offset. Ionic atoms carry their ion
 * sign. Returns atoms + bonds (covalent only).
 */
function buildScene(structure: ProductStructure, kind: Reaction["kind"]): {
  atoms: SceneAtom[];
  bonds: SceneBond[];
} {
  const n = structure.atoms.length;
  const atoms: SceneAtom[] = structure.atoms.map((pa, i) => {
    // Scatter on a ring, radius scaled so even the big lattice starts spread out.
    const ang = (i / n) * Math.PI * 2 + seeded(i) * 0.6;
    const ringR = (kind === "ionic" ? 7.5 : 5.5) + Math.abs(seeded(i * 3)) * 1.5;
    const info = ATOMS[pa.el];
    const ion = kind === "ionic" ? (info?.ionCharge ?? 0) > 0 ? 1 : -1 : 0;
    return {
      id: i,
      el: pa.el,
      sx: Math.cos(ang) * ringR,
      sy: Math.sin(ang) * ringR * 0.7,
      sz: seeded(i * 7) * (kind === "ionic" ? 2.5 : 1.2),
      tx: pa.x,
      ty: pa.y,
      tz: pa.z,
      curl: seeded(i * 11) * (kind === "ionic" ? 0.6 : 1.4),
      slot: i,
      ion,
    };
  });
  const bonds: SceneBond[] = structure.bonds.map((b) => ({
    a: b.a,
    b: b.b,
    order: b.order,
  }));
  return { atoms, bonds };
}

export class ChemistryModel implements SimModel {
  // ---- observable state (the view subscribes via useProperty) --------------
  readonly phase = new Property<Phase>("idle");
  readonly progress = new Property<number>(0);
  readonly flash = new Property<number>(0);
  readonly electronJump = new Property<number>(0);
  readonly tray = new Property<TrayAtom[]>([]);
  readonly matched = new Property<Reaction | null>(null);
  /** Selected/active reaction (set by picker OR by a successful tray match). */
  readonly activeId = new Property<string | null>(null);
  /** Bumps each time the user gathers/reacts — gates lesson progression. */
  readonly interactionCount = new Property<number>(0);
  /**
   * Purely temporal multiplier on the assembly clock (0.5 Sekin · 1 Oddiy ·
   * 2 Tez). Scales how fast `progress` advances; the geometry, conservation,
   * bonds and ΔH are untouched. See model.md.
   */
  readonly assemblySpeed = new Property<number>(1);

  private scene: SceneAtom[] = [];
  private sceneBonds: SceneBond[] = [];
  private nextTrayId = 1;
  private flashFired = false;

  // ----- tray editing -------------------------------------------------------

  /** Add one atom of element `el` to the chamber. */
  addAtom(el: string): void {
    if (this.phase.value === "assembling") return;
    if (this.phase.value === "product") this.clearChamber();
    this.tray.value = [...this.tray.value, { id: this.nextTrayId++, el }];
    this.interactionCount.value++;
    this.recomputeMatch();
  }

  /** Remove a tray atom by id (clicking it in the chamber). */
  removeAtom(id: number): void {
    if (this.phase.value === "assembling" || this.phase.value === "product") return;
    this.tray.value = this.tray.value.filter((a) => a.id !== id);
    this.recomputeMatch();
  }

  /** Empty the chamber back to idle. */
  clearChamber(): void {
    this.tray.value = [];
    this.matched.value = null;
    this.activeId.value = null;
    this.phase.value = "idle";
    this.progress.value = 0;
    this.flash.value = 0;
    this.electronJump.value = 0;
    this.scene = [];
    this.sceneBonds = [];
    this.flashFired = false;
  }

  /** Load the exact reactant atoms for a featured reaction (the chip picker). */
  loadReaction(id: string): void {
    const r = REACTION_BY_ID[id];
    if (!r) return;
    const atoms: TrayAtom[] = [];
    for (const [el, count] of Object.entries(r.requiredAtoms)) {
      for (let i = 0; i < count; i++) atoms.push({ id: this.nextTrayId++, el });
    }
    this.scene = [];
    this.sceneBonds = [];
    this.flashFired = false;
    this.progress.value = 0;
    this.flash.value = 0;
    this.electronJump.value = 0;
    this.tray.value = atoms;
    this.activeId.value = id;
    this.matched.value = r;
    this.phase.value = "armed";
    this.interactionCount.value++;
  }

  /**
   * Set the assembly-speed multiplier (Sekin 0.5 · Oddiy 1 · Tez 2). Temporal
   * only — does not touch geometry, conservation, bonds or ΔH (see model.md).
   */
  setAssemblySpeed(v: number): void {
    this.assemblySpeed.value = v > 0 ? v : 1;
  }

  /** Re-evaluate whether the current tray equals a known reaction. */
  private recomputeMatch(): void {
    const counts: Record<string, number> = {};
    for (const a of this.tray.value) counts[a.el] = (counts[a.el] ?? 0) + 1;
    const r = matchReaction(counts);
    this.matched.value = r;
    if (r) {
      this.activeId.value = r.id;
      this.phase.value = "armed";
    } else {
      this.activeId.value = null;
      if (this.phase.value !== "assembling" && this.phase.value !== "product") {
        this.phase.value = "idle";
      }
    }
  }

  // ----- the reaction -------------------------------------------------------

  /** Trigger assembly. No-op unless armed. */
  react(): void {
    const r = this.matched.value;
    if (!r || this.phase.value !== "armed") return;
    const { atoms, bonds } = buildScene(r.structure, r.kind);
    this.scene = atoms;
    this.sceneBonds = bonds;
    this.flashFired = false;
    this.progress.value = 0;
    this.flash.value = 0;
    this.electronJump.value = 0;
    this.phase.value = "assembling";
    this.interactionCount.value++;
  }

  /** Reduced-motion path: jump straight to the assembled product. */
  snap(): void {
    if (this.phase.value === "armed") this.react();
    if (this.phase.value !== "assembling") return;
    this.progress.value = 1;
    this.electronJump.value = 1;
    this.flash.value = (this.matched.value?.flash ?? 0) * 0.25;
    this.flashFired = true;
    this.phase.value = "product";
  }

  // ----- integration --------------------------------------------------------

  step(dt: number): void {
    const clamped = Math.min(dt, 0.033);
    const r = this.matched.value;

    if (this.phase.value === "assembling" && r) {
      const T = r.slow ? T_ASSEMBLE_SLOW : T_ASSEMBLE;
      // assemblySpeed scales the assembly clock only (temporal, not physical).
      const spd = this.assemblySpeed.value > 0 ? this.assemblySpeed.value : 1;
      const u = Math.min(1, this.progress.value + (clamped * spd) / T);
      this.progress.value = u;

      // ionic electron jump in the first 40% of assembly
      if (r.kind === "ionic") {
        this.electronJump.value = Math.min(1, u / 0.4);
      }

      // fire flash once at contact
      if (!this.flashFired && u >= FLASH_AT) {
        this.flashFired = true;
        this.flash.value = r.flash;
        // slow reactions: a gentle warm spread instead of a flash
        if (r.slow) this.flash.value = 0.35;
      }

      if (u >= 1) this.phase.value = "product";
    }

    // flash decays whenever it is lit (any phase after firing)
    if (this.flash.value > 1e-3) {
      const slow = !!r?.slow;
      const tau = slow ? FLASH_TAU_SLOW : FLASH_TAU;
      this.flash.value = this.flash.value * Math.exp(-clamped / tau);
      if (this.flash.value < 1e-3) this.flash.value = 0;
    }
  }

  // ----- view accessors (computed poses; the view only reads) ---------------

  /**
   * Current eased pose of every scene atom (Å). u=progress drives the lerp from
   * scattered start to product geometry along a slight curl arc.
   */
  poses(): { id: number; el: string; x: number; y: number; z: number; r: number; ion: number; slot: number }[] {
    const u = this.progress.value;
    const e = easeInOutCubic(u);
    const bump = Math.sin(Math.PI * e); // 0 at ends, 1 in the middle
    return this.scene.map((a) => {
      const x = a.sx + (a.tx - a.sx) * e;
      const y = a.sy + (a.ty - a.sy) * e + a.curl * bump;
      const z = a.sz + (a.tz - a.sz) * e + a.curl * 0.5 * bump;
      const info = ATOMS[a.el];
      let radius = info?.r ?? 1.5;
      // ionic: cation shrinks, anion grows as the lattice packs in
      if (a.ion > 0) radius *= 1 - 0.28 * u;
      else if (a.ion < 0) radius *= 1 + 0.18 * u;
      return { id: a.id, el: a.el, x, y, z, r: radius, ion: a.ion, slot: a.slot };
    });
  }

  /** Scene bonds with a 0..1 grow factor (atoms arrive first, then bond). */
  bonds(): { a: number; b: number; order: number; grow: number }[] {
    const u = this.progress.value;
    const grow = Math.max(0, Math.min(1, (u - 0.55) / 0.45));
    return this.sceneBonds.map((b) => ({ ...b, grow }));
  }

  /** Is the active reaction ionic (lattice render path)? */
  isIonic(): boolean {
    return this.matched.value?.kind === "ionic";
  }

  reset(): void {
    this.clearChamber();
    this.nextTrayId = 1;
    this.interactionCount.value = 0;
  }

  dispose(): void {
    this.phase.dispose();
    this.progress.dispose();
    this.flash.dispose();
    this.electronJump.dispose();
    this.tray.dispose();
    this.matched.dispose();
    this.activeId.dispose();
    this.interactionCount.dispose();
    this.assemblySpeed.dispose();
  }
}

/** Featured reactions for the picker chips (all of them, in teaching order). */
export const FEATURED = REACTIONS;
