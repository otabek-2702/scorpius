"use client";

/**
 * Sim state contract — Koji's killer feature, adapted for Humo.
 *
 *  Every Scorpius sim publishes a small structured snapshot of "what the
 *  student is currently looking at": which sim, which parameters they've
 *  set, what they've measured, what's on screen. Humo reads this when the
 *  student opens chat from within a simulation card so the tutor can
 *  reference the SPECIFIC state — not generic "let's talk about lenses",
 *  but "your fly is 6cm in front of a 4cm-focal lens".
 *
 *  Storage: in-memory React state via Context. Latest snapshot is
 *  retained; older snapshots replace. The Humo chat picks up the current
 *  snapshot at open time and injects it as a structured paragraph in the
 *  system prompt.
 */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { createElement } from "react";

/** A single "what's on screen" snapshot. Every sim publishes its own shape
 *  via the params + observations free-form maps — the tutor reads them as a
 *  flat key/value list. Keep keys short and Uzbek-friendly. */
export interface SimSnapshot {
  /** Registry key of the sim — matches SIM_REGISTRY in components/learn/sims/index.tsx */
  simKey: string;
  /** Display title — shown in the chat as "Hozir: {title}". */
  title?: string;
  /** Free-form parameters the user has changed (sliders, dropdowns).
   *  Values are pre-formatted strings ("4.2 sm", "6 V", "havo"). */
  params: Record<string, string>;
  /** Free-form observations — measurements the sim has computed
   *  ("F_buoy = 12.3 N", "image at v = 8.1 sm"). */
  observations: Record<string, string>;
  /** Local ms timestamp of last update. */
  ts: number;
}

const NoopSnapshot: SimSnapshot = {
  simKey: "",
  params: {},
  observations: {},
  ts: 0,
};

interface SimStateApi {
  snapshot: SimSnapshot | null;
  /** Sims call this on every meaningful state change (slider, drop, toggle). */
  publish: (patch: Partial<Omit<SimSnapshot, "ts">>) => void;
}

const NoopApi: SimStateApi = {
  snapshot: null,
  publish: () => {},
};

const Ctx = createContext<SimStateApi>(NoopApi);

export function SimStateProvider({ children }: { children: ReactNode }): ReactNode {
  const [snapshot, setSnapshot] = useState<SimSnapshot | null>(null);

  const publish = useCallback((patch: Partial<Omit<SimSnapshot, "ts">>) => {
    setSnapshot((prev) => {
      const base = prev ?? NoopSnapshot;
      const merged: SimSnapshot = {
        simKey: patch.simKey ?? base.simKey,
        title: patch.title ?? base.title,
        params: { ...base.params, ...(patch.params ?? {}) },
        observations: { ...base.observations, ...(patch.observations ?? {}) },
        ts: Date.now(),
      };
      return merged;
    });
  }, []);

  return createElement(Ctx.Provider, { value: { snapshot, publish } }, children);
}

/** Hook a sim uses to publish state changes. Outside a provider returns a noop. */
export function useSimState(): SimStateApi {
  return useContext(Ctx);
}

/** Convenience: sims that just want to declare their key + title once on
 *  mount and forget can call this. Reduces boilerplate. */
export function useSimIdentity(simKey: string, title?: string): void {
  const { publish } = useSimState();
  useEffect(() => {
    publish({ simKey, title });
  }, [publish, simKey, title]);
}

/** Format a snapshot as a structured Uzbek paragraph for the system prompt.
 *  Returns empty string if nothing meaningful has been published yet. */
export function formatSnapshotForPrompt(s: SimSnapshot | null): string {
  if (!s || !s.simKey) return "";
  const parts: string[] = [];
  parts.push(`HOZIR O'QUVCHI KO'RAYAPTI — simulyatsiya: ${s.title ?? s.simKey}.`);
  const params = Object.entries(s.params);
  if (params.length > 0) {
    parts.push(
      "Sozlamalar: " + params.map(([k, v]) => `${k} = ${v}`).join(", ") + ".",
    );
  }
  const obs = Object.entries(s.observations);
  if (obs.length > 0) {
    parts.push(
      "O'lchovlar: " + obs.map(([k, v]) => `${k} = ${v}`).join(", ") + ".",
    );
  }
  parts.push("Javobingiz aynan shu holatga ishora qilsin.");
  return parts.join(" ");
}
