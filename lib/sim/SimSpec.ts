// lib/sim/SimSpec.ts
/**
 * SimSpec — Zod-typed schema describing a sim's inputs + outputs + initial state.
 * Adopted from Loomin (NVIDIA GTC 2026 hackathon winner) and Brilliant's
 * Diagrammar pattern: an LLM (or human) authors a SimSpec, the renderer
 * interprets it. Generate the SPEC, never the pixels.
 *
 * Plan #1 ships the schema. Plan #3 will use it for runtime AI sim generation.
 */
import { z } from "zod";

export const SimInputSchema = z.object({
  key: z.string(),
  labelUz: z.string(),
  kind: z.enum(["number", "boolean", "enum"]),
  initial: z.union([z.number(), z.boolean(), z.string()]),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  unitUz: z.string().optional(),
  options: z.array(z.string()).optional(),
});

export const SimOutputSchema = z.object({
  key: z.string(),
  labelUz: z.string(),
  formulaUz: z.string().optional(),
  unitUz: z.string().optional(),
});

export const SimSpecSchema = z.object({
  simId: z.string(),
  titleUz: z.string(),
  inputs: z.array(SimInputSchema),
  outputs: z.array(SimOutputSchema),
  modelDocPath: z.string(),
});

export type SimInput = z.infer<typeof SimInputSchema>;
export type SimOutput = z.infer<typeof SimOutputSchema>;
export type SimSpec = z.infer<typeof SimSpecSchema>;
