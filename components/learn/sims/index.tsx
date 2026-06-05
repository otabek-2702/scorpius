/**
 * Registry of interactive simulations available to the `simulation` card type.
 * The lesson card carries a `sim: "<key>"` field; the renderer looks the key
 * up here. Add new sims by importing the component and adding a row.
 */
import type { ComponentType } from "react";
import { BrachistochroneSim } from "./BrachistochroneSim";
import { DensityBuoyancyTank } from "./DensityBuoyancyTank";
import { BrownianSim } from "./BrownianSim";
import { BuoyancySim } from "./BuoyancySim";
import { EclipseSim } from "./EclipseSim";
import { PrismSim } from "./PrismSim";
import { DivisorGridSim } from "./DivisorGridSim";
import { LeverSim } from "./LeverSim";
import { PascalSim } from "./PascalSim";
import { SoundSim } from "./SoundSim";
import { LensSim } from "./LensSim";
import { CircuitSim } from "./CircuitSim";

/** Props every sim component receives from SimulationCard. */
export interface SimProps {
  /** Fires once the user has meaningfully interacted (raced, completed, etc.). */
  onComplete?: () => void;
  /** Sim-specific config passed through from the Lesson DSL. */
  config?: Record<string, unknown>;
}

export const SIM_REGISTRY: Record<string, ComponentType<SimProps>> = {
  brachistochrone: BrachistochroneSim,
  "density-buoyancy-tank": DensityBuoyancyTank as ComponentType<SimProps>,
  brownian: BrownianSim,
  buoyancy: BuoyancySim,
  eclipse: EclipseSim,
  prism: PrismSim,
  "divisor-grid": DivisorGridSim,
  richag: LeverSim,
  paskal: PascalSim,
  tovush: SoundSim,
  linza: LensSim,
  zanjir: CircuitSim,
};
