// lib/sim/SimModel.ts
/**
 * Base interface for every sim's deterministic model layer. Per the manifesto
 * + design-references-synthesis architectural law: the model computes, the
 * renderer paints, the AI only chooses affordances. Models are pure functions
 * of (state, dt, inputs) — time is just another input.
 *
 * Each sim provides:
 *   - inputs (NumberProperty/BooleanProperty for user-tunable params)
 *   - outputs (DerivedProperty for computed values, observable by the view)
 *   - step(dt) for physics integration
 *   - reset() to return to initial state
 *
 * Every sim MUST ship with a model.md alongside its model.ts file
 * documenting the physics equations + assumptions + parameter ranges.
 * This is the PhET simula-rasa discipline. Skipping model.md = plan failure.
 */
export interface SimModel {
  /** Advance the simulation by `dt` seconds. Pure mutation of own observable state. */
  step(dt: number): void;
  /** Return to initial state. */
  reset(): void;
  /** Free listeners + interval handles. Called on unmount. */
  dispose(): void;
}
