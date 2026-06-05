/**
 * Streak engine — daily-return measurement with the Duolingo escape valve.
 *
 * Source of truth is localStorage so the UI can render synchronously on first
 * paint. A best-effort Firestore mirror keeps the device-of-record honest
 * across reinstalls. The day boundary is the user's *local* midnight (kid in
 * Andijon's day rolls over at 00:00 Tashkent, which is what their clock says
 * anyway) — we tag days by their `YYYY-MM-DD` string in local time.
 *
 * Why a freeze/repair: punishment-only streaks produce churn the day they
 * snap. Duolingo learned this the hard way. v1 ships:
 *   - 1 free freeze per ISO week (auto-replenishes each Monday)
 *   - 1 paid repair per calendar month (placeholder — UI nudges to paywall)
 *
 * On a missed day, the engine auto-applies a freeze if one is available;
 * the user sees no break and gets a "muzlatildi" notice on their next visit.
 */

import { ensureAnonymousUser } from "@/lib/auth";

const STORAGE_KEY = "scorpius:streak";

export interface StreakState {
  /** Current consecutive-day streak length, after any auto-freezes applied. */
  current: number;
  /** Best (longest) streak the user has ever held. */
  best: number;
  /** YYYY-MM-DD (local) of the last day a lesson was completed. Null on a fresh profile. */
  lastActiveDay: string | null;
  /** ISO-week (YYYY-Www) of the last freeze grant — used to detect when to replenish. */
  freezeWeek: string | null;
  /** Free freezes left this week. 1 by default, decrements when auto-applied. */
  freezesAvailable: number;
  /** YYYY-MM (local) of the last paid repair — caps to 1/month. */
  repairMonth: string | null;
  /** Days the engine auto-froze for the user. Used to render a friendly notice. */
  recentFreezes: string[];
}

const FREEZES_PER_WEEK = 1;

// ---- Date utilities (local time) -------------------------------------------

/** YYYY-MM-DD in the user's local timezone. */
export function localDay(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** YYYY-Www — ISO week number in local time. */
function localIsoWeek(d: Date = new Date()): string {
  // Use UTC for the math but keep day-of-year alignment with local.
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const weekNum =
    1 +
    Math.round(
      ((t.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7
    );
  return `${t.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

/** YYYY-MM local month for repair cap. */
function localMonth(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Inclusive day diff: ("2026-06-04", "2026-06-03") → 1. */
function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00`);
  const b = new Date(`${toIso}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

// ---- Storage ---------------------------------------------------------------

function emptyState(): StreakState {
  return {
    current: 0,
    best: 0,
    lastActiveDay: null,
    freezeWeek: null,
    freezesAvailable: FREEZES_PER_WEEK,
    repairMonth: null,
    recentFreezes: [],
  };
}

export function loadStreak(): StreakState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<StreakState>;
    return { ...emptyState(), ...parsed };
  } catch {
    return emptyState();
  }
}

function saveStreak(state: StreakState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* localStorage unavailable */
  }
  // Fire-and-forget cloud mirror. Failures are silent — localStorage is canonical.
  void mirrorToFirestore(state);
}

async function mirrorToFirestore(state: StreakState): Promise<void> {
  try {
    const uid = await ensureAnonymousUser();
    if (!uid) return;
    const { doc, setDoc } = await import("firebase/firestore");
    const { db } = await import("@/lib/firebase/client");
    await setDoc(doc(db, "users", uid, "meta", "streak"), state, { merge: true });
  } catch {
    /* offline / permission denied — ignore */
  }
}

// ---- Core logic ------------------------------------------------------------

/** Replenish weekly freezes if a new ISO week has started. */
function ensureWeeklyReplenish(state: StreakState): StreakState {
  const week = localIsoWeek();
  if (state.freezeWeek === week) return state;
  return { ...state, freezeWeek: week, freezesAvailable: FREEZES_PER_WEEK };
}

/** Apply auto-freezes for missed days, up to available count. Returns the new
 *  state and the list of days that were frozen (for the "muzlatildi" toast).
 *
 *  On a successful freeze-bridge we advance `lastActiveDay` to *yesterday*
 *  (today − 1). That keeps the streak intact and makes the next call idempotent:
 *  a second `refreshStreak()` later the same day sees gap=1, no further action.
 *  Without this advance, repeat calls would re-compute the same gap, run out of
 *  freezes, and snap an already-bridged streak. */
function applyFreezes(state: StreakState): StreakState {
  if (!state.lastActiveDay) return state;
  const today = localDay();
  const gap = daysBetween(state.lastActiveDay, today);
  // gap <= 0: same day or clock skew, nothing to do.
  // gap === 1: yesterday → today is a continuous day, no freeze needed.
  // gap === 2: missed one day, need 1 freeze to bridge.
  // gap >= 3: missed multiple days, would need multiple freezes (currently capped at 1/wk).
  const missed = Math.max(0, gap - 1);
  if (missed === 0) return state;

  const s = ensureWeeklyReplenish(state);
  const freezesNeeded = missed;
  const freezesToBurn = Math.min(s.freezesAvailable, freezesNeeded);
  if (freezesToBurn < freezesNeeded) {
    // Not enough freezes — streak snaps. Reset current, preserve best, clear lastActiveDay
    // so the *next* completion starts a new streak from 1.
    return { ...s, current: 0, lastActiveDay: null };
  }
  // Enough freezes — burn them and record the bridge days for the UI.
  const bridged: string[] = [];
  // Build the list of bridged days (skipping the original lastActiveDay).
  for (let i = 1; i <= missed; i++) {
    const dt = new Date(`${s.lastActiveDay}T00:00:00`);
    dt.setDate(dt.getDate() + i);
    bridged.push(localDay(dt));
  }
  // Advance lastActiveDay to *yesterday* so subsequent refreshes are idempotent.
  // Computing "yesterday" from today (rather than walking forward from the old
  // lastActiveDay) avoids any drift if the date boundary moves between calls.
  const yesterday = (() => {
    const d = new Date(`${today}T00:00:00`);
    d.setDate(d.getDate() - 1);
    return localDay(d);
  })();
  return {
    ...s,
    freezesAvailable: s.freezesAvailable - freezesToBurn,
    recentFreezes: [...s.recentFreezes, ...bridged].slice(-10),
    lastActiveDay: yesterday,
  };
}

/** Read the streak as it would appear right now — including any auto-freezes
 *  the engine would apply if the user opened the app this instant. Pure-ish:
 *  it persists the replenish + freeze application as a side effect so the UI
 *  number matches what's stored. */
export function refreshStreak(): StreakState {
  let s = loadStreak();
  s = ensureWeeklyReplenish(s);
  s = applyFreezes(s);
  saveStreak(s);
  return s;
}

/** Record a lesson completion now. Idempotent within a single local day —
 *  finishing a 2nd lesson the same day doesn't double-count. */
export function recordCompletion(): StreakState {
  let s = loadStreak();
  const today = localDay();

  // 1. Apply weekly replenish + auto-freezes for any missed days.
  s = ensureWeeklyReplenish(s);
  s = applyFreezes(s);

  // 2. Same-day completion: no-op on count, just persist.
  if (s.lastActiveDay === today) {
    saveStreak(s);
    return s;
  }

  // 3. New-day completion: increment streak.
  // - First-ever completion (lastActiveDay null): streak goes 0 → 1.
  // - Yesterday active: continuous, streak += 1.
  // - applyFreezes may have either preserved or snapped the streak — trust
  //   its `current` value for the base, then +1 for today.
  const newCurrent = s.current + 1;
  const newBest = Math.max(s.best, newCurrent);
  const next: StreakState = {
    ...s,
    current: newCurrent,
    best: newBest,
    lastActiveDay: today,
  };
  saveStreak(next);
  return next;
}

/** Spend a one-shot paid repair. UI gates this behind a paywall in v2;
 *  v1 just records the intent so we can analytics-track demand. */
export function spendRepair(): StreakState | null {
  let s = loadStreak();
  const month = localMonth();
  if (s.repairMonth === month) return null; // already used this month
  s = ensureWeeklyReplenish(s);
  // Repair pushes lastActiveDay to yesterday so the *next* lesson today picks
  // the streak back up by one (not a magic +N — repair only saves you from a snap).
  const today = localDay();
  const yesterday = (() => {
    const d = new Date(`${today}T00:00:00`);
    d.setDate(d.getDate() - 1);
    return localDay(d);
  })();
  const next: StreakState = {
    ...s,
    lastActiveDay: yesterday,
    repairMonth: month,
  };
  saveStreak(next);
  return next;
}

/** Was the current streak just preserved by an auto-freeze? Used to render
 *  the "snowflake bridged yesterday" toast on home. */
export function hadRecentFreeze(): boolean {
  const s = loadStreak();
  if (s.recentFreezes.length === 0) return false;
  const lastFrozen = s.recentFreezes[s.recentFreezes.length - 1];
  // Show the toast if a freeze fired in the last 3 calendar days.
  const today = localDay();
  return daysBetween(lastFrozen, today) <= 3;
}
