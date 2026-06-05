"use client";

/**
 * Supernova ceremony — the chapter-end cinematic.
 *
 *  Fires when the LAST star in a constellation lights up. The collapsing
 *  constellation becomes a single named, dated supernova: "{Name}'ning
 *  supernovasi · {Month YYYY}". Persists forever as a permanent badge.
 *
 *  Storage strategy:
 *   - localStorage `scorpius:supernovas` = canonical list (read on every visit)
 *   - localStorage `scorpius:supernova-pending` = transient flag the ceremony
 *     overlay reads on mount and clears after the cinematic ran. This lets
 *     LessonDeck "queue" a supernova that SkyView fires on next render.
 *   - Phase 5 will mirror to Firestore under users/{uid}/supernovas.
 */

export interface Supernova {
  /** Stable id — `{subjectId}-{constellationId}` so a subject can host
   *  multiple supernovas (one per unit) over time. */
  id: string;
  /** Subject family — math or physics today; will grow. */
  subjectId: string;
  /** Display name — "{first-name}'ning supernovasi". */
  name: string;
  /** Human-readable month+year — "2026-yil iyun". */
  whenLabel: string;
  /** ISO timestamp for sorting. */
  ts: number;
}

const STORAGE_KEY = "scorpius:supernovas";
const PENDING_KEY = "scorpius:supernova-pending";

const UZBEK_MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentyabr", "oktyabr", "noyabr", "dekabr",
];

function uzbekMonth(d: Date = new Date()): string {
  return `${d.getFullYear()}-yil ${UZBEK_MONTHS[d.getMonth()]}`;
}

/** Read the persistent list. Client-only — returns [] on SSR. */
export function loadSupernovas(): Supernova[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Supernova[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSupernovas(list: Supernova[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* unavailable */
  }
}

/** Has the user already earned a supernova for this constellation? */
export function hasSupernova(id: string): boolean {
  return loadSupernovas().some((s) => s.id === id);
}

/** Persist a new supernova. Idempotent — no-op if already exists. */
export function recordSupernova(input: {
  id: string;
  subjectId: string;
  firstName: string;
}): Supernova | null {
  if (hasSupernova(input.id)) return null;
  const list = loadSupernovas();
  const sn: Supernova = {
    id: input.id,
    subjectId: input.subjectId,
    name: `${input.firstName}'ning supernovasi`,
    whenLabel: uzbekMonth(),
    ts: Date.now(),
  };
  saveSupernovas([...list, sn]);
  return sn;
}

/** Queue a supernova ceremony to fire on the *next* SkyView mount. Used
 *  by LessonDeck on the moment of completion so the ceremony can play
 *  with the full screen, not inside the lesson deck. */
export function queueSupernova(id: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PENDING_KEY, id);
  } catch {
    /* unavailable */
  }
}

/** Pop the pending supernova id, returning it if any. */
export function consumePendingSupernova(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const id = localStorage.getItem(PENDING_KEY);
    if (id) localStorage.removeItem(PENDING_KEY);
    return id;
  } catch {
    return null;
  }
}
