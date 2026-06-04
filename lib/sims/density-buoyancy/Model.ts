// lib/sims/density-buoyancy/Model.ts
/**
 * DensityBuoyancyModel — fully time-integrated buoyancy lab.
 *
 * Implements SimModel (lib/sim/SimModel.ts). All mutable state is held as
 * Property<T> from lib/sim/observable. See model.md alongside this file for the
 * full physics derivation, units, and integration scheme.
 *
 * Physics (SI, 1-D vertical): each solid block falls under gravity, splashes
 * into the water, and settles to Archimedes equilibrium via semi-implicit
 * Euler. The learner can change the block SIZE — proving density is intrinsic
 * (a big light block still floats; a tiny dense one still sinks). Water level
 * rises with cumulative displaced volume; the View reports the rise in cm.
 *
 * Oil is immiscible and less dense than water, so it is NOT modelled as a solid
 * cube — it accumulates as a floating LIQUID LAYER on top of the water. The
 * View paints that layer; the model tracks its volume + thickness.
 *
 * The View reads `blocks`, `waterHeight`, `oilHeight`, and `splashes` and
 * paints — it contains zero physics.
 */
import { Property } from "@/lib/sim/observable/Property";
import type { SimModel } from "@/lib/sim/SimModel";
import type { MaterialBlock } from "@/lib/sim/types";

// ---- Real-world constants (SI) ---------------------------------------------
const G = 9.81; // m/s²
const RHO_WATER = 1000; // kg/m³
const RHO_OIL = 920; // kg/m³ — vegetable/mineral oil, floats on water
const BASE_SIDE = 0.1; // m — reference block edge (10 cm)

// Tank geometry in metres (mapped to SVG px by the View).
export const TANK_M = {
  width: 0.5, // m
  height: 0.4, // m
  waterRest: 0.24, // m — rest surface height above floor
};

// Tank cross-section for the level-rise calc: 2-D unit-depth slice of edge
// BASE_SIDE deep, so one reference cube fully submerged raises the level by a
// visible amount. See model.md.
const TANK_AREA = TANK_M.width * BASE_SIDE; // m²

/**
 * Default palette — REAL densities in g/cm³ (×1000 → kg/m³). `phase: "liquid"`
 * marks oil, which pours into a floating layer rather than dropping as a cube.
 */
export const DEFAULT_MATERIALS: MaterialBlock[] = [
  { id: "wood", labelUz: "Yogʻoch", density: 0.5, color: "#b07d4e" },
  { id: "ice", labelUz: "Muz", density: 0.92, color: "#bfe4f5" },
  { id: "oil", labelUz: "Moy", density: 0.92, color: "#e6c34a", phase: "liquid" },
  { id: "rubber", labelUz: "Kauchuk", density: 1.2, color: "#3c3c43" },
  { id: "aluminum", labelUz: "Alyuminiy", density: 2.7, color: "#c2cad2" },
  { id: "iron", labelUz: "Temir", density: 7.87, color: "#828a95" },
  { id: "gold", labelUz: "Oltin", density: 19.3, color: "#e8b923" },
];

export type BlockSizePreset = "small" | "medium" | "large";

/** Edge length (m) for each size preset. Volume scales with the cube. */
export const SIZE_SIDES: Record<BlockSizePreset, number> = {
  small: 0.06, // 6 cm
  medium: 0.1, // 10 cm
  large: 0.15, // 15 cm
};

export interface Block {
  id: number;
  mat: MaterialBlock;
  /** Edge length of this cube, m (set from the size preset at spawn). */
  side: number;
  /** Horizontal centre in metres from the left tank wall (cosmetic — no x-physics). */
  x: number;
  /** Centre height in metres above the tank floor. */
  y: number;
  /** Vertical velocity, m/s (up positive). */
  vy: number;
  /** True once the block has come to rest (settles the integrator + readout). */
  settled: boolean;
  /** True for the frame the block first pierces the surface — drives the splash. */
  justSplashed: boolean;
}

/** A transient surface splash, consumed + animated by the View. */
export interface Splash {
  id: number;
  /** Horizontal centre in metres. */
  x: number;
  /** Strength 0..1 — scales ripple radius + particle count (from impact speed). */
  strength: number;
  /** performance.now()-style birth time (ms) for the View's animation clock. */
  bornAt: number;
}

export const blockVolume = (side: number) => side ** 3; // m³

/** Submerged fraction (0..1) of a cube of edge `side` whose centre is at `y`. */
function submergedFraction(y: number, side: number, waterHeight: number): number {
  const bottom = y - side / 2;
  const depth = Math.max(0, Math.min(side, waterHeight - bottom));
  return depth / side;
}

export class DensityBuoyancyModel implements SimModel {
  /** Observable list of live solid blocks — View subscribes via useProperty(). */
  readonly blocks = new Property<Block[]>([]);
  /** Observable water surface height (m) — rises with displacement. */
  readonly waterHeight = new Property<number>(TANK_M.waterRest);
  /** Floating oil-layer thickness (m) sitting on top of the water surface. */
  readonly oilHeight = new Property<number>(0);
  /** Active splashes (transient) — View animates + prunes via age. */
  readonly splashes = new Property<Splash[]>([]);
  /** Distinct spawns — gates lesson progression. */
  readonly interactionCount = new Property<number>(0);

  /** Currently-selected block size preset (drives the next spawn). */
  readonly sizePreset = new Property<BlockSizePreset>("medium");

  private nextId = 1;
  private nextSplashId = 1;

  /** Spawn a falling block (solid) or pour oil (liquid) for material `mat`. */
  drop(mat: MaterialBlock): void {
    if (mat.phase === "liquid") {
      // Oil pours in as a fixed parcel that joins the floating layer.
      const parcel = blockVolume(BASE_SIDE) * 0.6; // m³ per pour
      this.oilHeight.value =
        this.oilHeight.value + parcel / (TANK_M.width * BASE_SIDE);
      this.interactionCount.value = this.interactionCount.value + 1;
      return;
    }
    const side = SIZE_SIDES[this.sizePreset.value];
    const list = this.blocks.value;
    const lane = list.length % 4;
    const x = 0.09 + lane * 0.105 + (Math.random() - 0.5) * 0.015;
    const block: Block = {
      id: this.nextId++,
      mat,
      side,
      x,
      y: TANK_M.height + 0.13, // start above the rim
      vy: 0,
      settled: false,
      justSplashed: false,
    };
    this.blocks.value = [...list, block];
    this.interactionCount.value = this.interactionCount.value + 1;
  }

  /** Total submerged volume across all solid blocks at a trial water height. */
  private displacedVolume(waterHeight: number): number {
    let v = 0;
    for (const b of this.blocks.value) {
      v += submergedFraction(b.y, b.side, waterHeight) * blockVolume(b.side);
    }
    return v;
  }

  /** Solve water height for current block positions (fixed-point iteration). */
  private solveWaterHeight(): number {
    let h = this.waterHeight.value;
    for (let i = 0; i < 6; i++) {
      h = TANK_M.waterRest + this.displacedVolume(h) / TANK_AREA;
    }
    return h;
  }

  /** Advance the simulation by `dt` seconds with fixed sub-steps. */
  step(dt: number): void {
    // Always age splashes (cheap) even when no blocks move.
    this.pruneSplashes();
    if (this.blocks.value.length === 0) return;

    const clamped = Math.min(dt, 1 / 60);
    const SUB = 1 / 120;
    let remaining = clamped;
    let anyMoved = false;

    while (remaining > 1e-6) {
      const h = Math.min(remaining, SUB);
      remaining -= h;
      const hWater = this.solveWaterHeight();
      this.waterHeight.value = hWater;

      for (const b of this.blocks.value) {
        if (b.settled) continue;
        const V = blockVolume(b.side);
        const m = b.mat.density * 1000 * V; // kg
        const fracBefore = submergedFraction(b.y, b.side, hWater);
        const frac = fracBefore;
        const vSub = frac * V;
        const fG = -m * G;
        const fB = RHO_WATER * G * vSub;
        // Linear damper tuned as a FRACTION OF CRITICAL DAMPING so every block —
        // light or heavy, small or large — settles in a few visible bobs rather
        // than ringing forever. The floater's spring constant is k = ρ_w·g·A
        // (A = s²); critical damping c_crit = 2·√(k·m). We use ζ ≈ 0.5. Active
        // only while submerged (scaled by frac). Declared simplification — see
        // model.md "Drag model": this sets only the transient, not the waterline.
        const A = b.side * b.side;
        const cCrit = 2 * Math.sqrt(RHO_WATER * G * A * m);
        const fDrag = -0.5 * cCrit * b.vy * frac;
        const fNet = fG + fB + fDrag;
        const a = fNet / m;

        const wasAbove = fracBefore <= 1e-4;
        // Semi-implicit (symplectic) Euler.
        b.vy += a * h;
        b.y += b.vy * h;

        // Detect first piercing of the surface → splash.
        const fracAfter = submergedFraction(b.y, b.side, hWater);
        if (wasAbove && fracAfter > 1e-4 && b.vy < -0.2) {
          this.emitSplash(b.x, Math.min(1, Math.abs(b.vy) / 2.2), b.side);
        }

        // Floor: the tank bottom supplies a normal force. A sinker rests here.
        const onFloor = b.y - b.side / 2 <= 1e-4;
        if (onFloor) {
          b.y = b.side / 2;
          if (b.vy < 0) b.vy = 0; // floor can't pull down
        }

        const slow = Math.abs(b.vy) < 0.006;
        const floaterBalanced = Math.abs(fNet) / m < 0.05; // |a| < 0.05 m/s²
        if (slow && ((onFloor && fNet <= 0) || floaterBalanced)) {
          b.vy = 0;
          b.settled = true;
        }
        anyMoved = true;
      }
    }

    if (anyMoved) {
      this.blocks.value = [...this.blocks.value];
      this.waterHeight.value = this.solveWaterHeight();
    }
  }

  private emitSplash(x: number, strength: number, side: number): void {
    const s = Math.min(1, strength * (side / BASE_SIDE));
    this.splashes.value = [
      ...this.splashes.value,
      { id: this.nextSplashId++, x, strength: Math.max(0.25, s), bornAt: performance.now() },
    ];
  }

  /** Remove splashes older than their lifetime so the View list stays small. */
  private pruneSplashes(): void {
    const list = this.splashes.value;
    if (list.length === 0) return;
    const now = performance.now();
    const alive = list.filter((s) => now - s.bornAt < 900);
    if (alive.length !== list.length) this.splashes.value = alive;
  }

  /** Live submerged fraction (0..1) for a block — used by the View readout. */
  fractionOf(b: Block): number {
    return submergedFraction(b.y, b.side, this.waterHeight.value);
  }

  /** Water-level rise above rest, in metres (for the displacement readout). */
  levelRise(): number {
    return Math.max(0, this.waterHeight.value - TANK_M.waterRest);
  }

  reset(): void {
    this.blocks.value = [];
    this.waterHeight.value = TANK_M.waterRest;
    this.oilHeight.value = 0;
    this.splashes.value = [];
    this.interactionCount.value = 0;
    this.nextId = 1;
    this.nextSplashId = 1;
  }

  dispose(): void {
    this.blocks.dispose();
    this.waterHeight.dispose();
    this.oilHeight.dispose();
    this.splashes.dispose();
    this.interactionCount.dispose();
    this.sizePreset.dispose();
  }
}

// Re-export constants the View needs to map metres → SVG px + draw to scale.
export const PHYS = { G, RHO_WATER, RHO_OIL, BASE_SIDE, blockVolume };
