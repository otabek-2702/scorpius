// lib/sim/types.ts
/**
 * Per-sim config types — props passed via the lesson JSON's `simulation` /
 * `explore-sandbox` / `challenge` / `pattern-discover` / `compare-and-decide`
 * card config field. Each sim component extracts its typed config slice.
 *
 * Per-sim entries added here as sims land. Plan #1 ships DensityBuoyancy
 * (Task 22); Plan #2 adds the rest of the sim library.
 */

export interface MaterialBlock {
  id: string;
  labelUz: string;
  /** Density in g/cm³ (water = 1.0). */
  density: number;
  /** Hex color for rendering. */
  color: string;
  /**
   * Physical phase. Solids drop as cubes; a "liquid" (e.g. oil) pours into a
   * floating layer on top of the water instead. Defaults to solid when absent.
   */
  phase?: "solid" | "liquid";
  /**
   * Visual material family — drives the SVG render (grain, metallic sheen,
   * translucency, matte). Defaults inferred from id when absent.
   */
  look?: "wood" | "metal" | "ice" | "matte" | "gold";
}

export interface DensityBuoyancyConfig {
  /** Optional override of the default 8-material palette. */
  materials?: MaterialBlock[];
  /** Material ids to pre-drop in the tank on mount. */
  initialDropped?: string[];
}

/** Union grows as sims land. Plan #2 adds pendulum, circuit, lens, etc. */
export type PhysicsSimConfig = DensityBuoyancyConfig;
