"use client";

/**
 * Lab Notebook — the sim-as-instrument receipt layer.
 *
 *  Every sim that wants to be a real instrument (not a quiz disguised as one)
 *  publishes the measurements the student takes — buoyant force at the moment
 *  a block was dropped, torque when the lever balanced, current when the
 *  bulb lit. Entries land in a React context and render as a persistent
 *  list below the sim canvas.
 *
 *  Storage: in-memory React state during the session. localStorage mirror
 *  per lesson so the kid can revisit the deck and see what they measured.
 *  Phase 5 mirrors to Firestore as `users/{uid}/notebooks/{lessonId}`.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createElement } from "react";

export interface LabEntry {
  /** Stable client id — `${ts}-${counter}` so duplicate-rapid-fire works. */
  id: string;
  /** Local time in ms. */
  ts: number;
  /** Short symbol — e.g. "F", "τ", "I", "v/u". 1-6 chars best. */
  label: string;
  /** Ready-to-render value with units — e.g. "12.3 N", "0.8 A". */
  value: string;
  /** Optional context — e.g. "po'lat, 10 sm chuqurlikda". */
  context?: string;
}

export interface LabNotebookApi {
  entries: ReadonlyArray<LabEntry>;
  /** Push a new measurement. The hook caps the buffer at 50 entries (LRU). */
  recordEntry: (e: Omit<LabEntry, "id" | "ts">) => void;
  /** Wipe the notebook for this lesson — used by the "Tozalash" button. */
  clear: () => void;
}

const MAX_ENTRIES = 50;
const NoopApi: LabNotebookApi = {
  entries: [],
  recordEntry: () => {},
  clear: () => {},
};

const Ctx = createContext<LabNotebookApi>(NoopApi);

function storageKey(lessonId: string | undefined): string | null {
  if (!lessonId) return null;
  return `scorpius:notebook:${lessonId}`;
}

export function LabNotebookProvider({
  lessonId,
  children,
}: {
  lessonId: string | undefined;
  children: ReactNode;
}): ReactNode {
  const [entries, setEntries] = useState<ReadonlyArray<LabEntry>>([]);
  // Counter is a side-channel id, not render state — useRef keeps it stable
  // across StrictMode double-invocation. Using setState inside another setState
  // updater (the previous pattern) caused recordEntry to push the same entry
  // twice in dev under StrictMode.
  const counterRef = useRef(0);

  // Hydrate from localStorage on mount (client-only).
  useEffect(() => {
    const key = storageKey(lessonId);
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as LabEntry[];
        if (Array.isArray(parsed)) setEntries(parsed.slice(-MAX_ENTRIES));
      }
    } catch {
      /* localStorage unavailable */
    }
  }, [lessonId]);

  // Persist to localStorage whenever entries change.
  useEffect(() => {
    const key = storageKey(lessonId);
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(entries));
    } catch {
      /* localStorage unavailable */
    }
  }, [lessonId, entries]);

  const recordEntry = useCallback(
    (e: Omit<LabEntry, "id" | "ts">) => {
      const ts = Date.now();
      counterRef.current += 1;
      const id = `${ts}-${counterRef.current}`;
      setEntries((prev) => {
        const entry: LabEntry = { ...e, id, ts };
        const updated = [...prev, entry];
        // LRU cap — drop oldest if over limit.
        return updated.length > MAX_ENTRIES
          ? updated.slice(updated.length - MAX_ENTRIES)
          : updated;
      });
    },
    []
  );

  const clear = useCallback(() => setEntries([]), []);

  // Stabilise the context value reference so consumers don't re-render every
  // time the provider re-renders for unrelated reasons. recordEntry/clear are
  // already stable via useCallback; entries is the only changing dependency.
  const api = useMemo<LabNotebookApi>(
    () => ({ entries, recordEntry, clear }),
    [entries, recordEntry, clear],
  );

  return createElement(Ctx.Provider, { value: api }, children);
}

/** Hook every sim uses to register measurements. Returns the noop API outside
 *  a provider so old sims without integration still type-check. */
export function useLabNotebook(): LabNotebookApi {
  return useContext(Ctx);
}

/** Format a timestamp as HH:MM:SS local. */
export function formatTs(ts: number): string {
  const d = new Date(ts);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}
