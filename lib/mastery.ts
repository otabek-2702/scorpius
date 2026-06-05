"use client";

/**
 * Mastery engine — per-skill knowledge tracing + spaced-repetition recall.
 *
 * Combines two models so the scheduler can ask BOTH "does the student know
 * this?" (BKT) and "will they remember it next week?" (half-life recall):
 *
 *   - Bayesian Knowledge Tracing (4-param HMM): pL=P(known), pT=P(transit),
 *     pG=P(guess), pS=P(slip). Updates on every attempt.
 *   - Half-life recall: exponential decay h(t) = 0.5^((t-lastSeen)/halfLife)
 *     where halfLife grows on correct attempts, shrinks on wrong ones.
 *
 * Composite mastery = pL × R(now). Level thresholds:
 *   ≥ 0.95 → mastered
 *   ≥ 0.80 → proficient
 *   ≥ 0.50 → familiar
 *   else   → attempted
 *
 * "mastered" is also gated by the Mastery Challenge — same-skill grinding
 * sets pL high but doesn't actually flip the level until a mixed-context
 * Challenge attempt confirms transfer. That gate lives in lib/scheduler.ts.
 *
 * Storage: localStorage source of truth; best-effort Firestore mirror
 * (users/{uid}/mastery/{skillId}). Reads are sync, writes are async.
 *
 * FIRe credits (Math Academy's pattern): when an advanced skill is
 * exercised, its prereqs get a fractional credit because the act of doing
 * the harder thing implicitly re-tests the easier thing.
 */

import { ensureAnonymousUser } from "@/lib/auth";
import { getSkill } from "@/lib/skills";

const STORAGE_PREFIX = "scorpius:mastery:";

export type MasteryLevel = "attempted" | "familiar" | "proficient" | "mastered";

export interface MasteryRecord {
  skillId: string;
  /** Raw attempt counters. */
  correct: number;
  total: number;
  /** Consecutive-correct streak. Resets on any wrong. */
  streak: number;
  /** Half-life in days for the forgetting curve. Updated on each attempt. */
  halfLifeDays: number;
  /** Local ms timestamp of last attempt. */
  lastSeen: number;
  /** Local ms timestamp when scheduler wants to surface this skill again. */
  nextDue: number;
  /** BKT parameters — per-skill, evolve via cohort fits later. */
  pL: number;
  pT: number;
  pG: number;
  pS: number;
  /** Composite knowledge×recall — kept on the record for cheap UI render. */
  mastery: number;
  /** UI bucket; "mastered" requires masteryChallengePass = true. */
  level: MasteryLevel;
  /** True once the skill survived a mixed-context Mastery Challenge. */
  masteryChallengePass: boolean;
  /** Ring buffer — last 10 attempts for telemetry + scheduler diagnostics. */
  lastAttempts: ReadonlyArray<{
    ts: number;
    correct: boolean;
    hintCount?: number;
    msToAnswer?: number;
  }>;
}

// Defaults from the literature (Corbett & Anderson 1995):
//   pG ≤ 0.30, pS ≤ 0.10. Initial pL = 0.10, pT = 0.18.
const PRIOR_PL = 0.1;
const PRIOR_PT = 0.18;
const PRIOR_PG = 0.2;
const PRIOR_PS = 0.08;
const INITIAL_HALF_LIFE_DAYS = 1.5;
const TARGET_RECALL = 0.85;
const FIRE_WEIGHT = 0.4;

const MAX_PG = 0.3;
const MAX_PS = 0.1;

const DAY_MS = 86_400_000;

// ---- Empty record + storage -----------------------------------------------

function emptyRecord(skillId: string): MasteryRecord {
  return {
    skillId,
    correct: 0,
    total: 0,
    streak: 0,
    halfLifeDays: INITIAL_HALF_LIFE_DAYS,
    lastSeen: 0,
    nextDue: 0,
    pL: PRIOR_PL,
    pT: PRIOR_PT,
    pG: PRIOR_PG,
    pS: PRIOR_PS,
    mastery: PRIOR_PL,
    level: "attempted",
    masteryChallengePass: false,
    lastAttempts: [],
  };
}

function key(skillId: string): string {
  return STORAGE_PREFIX + skillId;
}

export function loadMastery(skillId: string): MasteryRecord {
  if (typeof window === "undefined") return emptyRecord(skillId);
  try {
    const raw = localStorage.getItem(key(skillId));
    if (!raw) return emptyRecord(skillId);
    const parsed = JSON.parse(raw) as Partial<MasteryRecord>;
    return { ...emptyRecord(skillId), ...parsed, skillId };
  } catch {
    return emptyRecord(skillId);
  }
}

function saveMastery(record: MasteryRecord): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key(record.skillId), JSON.stringify(record));
  } catch {
    /* unavailable */
  }
  void mirrorToFirestore(record);
}

async function mirrorToFirestore(record: MasteryRecord): Promise<void> {
  try {
    const uid = await ensureAnonymousUser();
    if (!uid) return;
    const { doc, setDoc } = await import("firebase/firestore");
    const { db } = await import("@/lib/firebase/client");
    await setDoc(
      doc(db, "users", uid, "mastery", record.skillId),
      record,
      { merge: true }
    );
  } catch {
    /* offline / permission denied */
  }
}

// ---- Core math ------------------------------------------------------------

/** Predicted probability of recall at time `now` given last seen + halfLife. */
export function recallNow(record: MasteryRecord, now: number = Date.now()): number {
  if (record.lastSeen === 0) return 1; // never seen → assume fresh
  const days = (now - record.lastSeen) / DAY_MS;
  if (days <= 0) return 1;
  return Math.pow(0.5, days / record.halfLifeDays);
}

/** BKT posterior update given a single observation. */
function bktUpdate(
  pL: number,
  correct: boolean,
  pG: number,
  pS: number,
  pT: number
): number {
  // P(known | obs)
  const pLgivenObs = correct
    ? (pL * (1 - pS)) / (pL * (1 - pS) + (1 - pL) * pG + 1e-9)
    : (pL * pS) / (pL * pS + (1 - pL) * (1 - pG) + 1e-9);
  // Transition step: even if not known, has pT chance of learning this attempt.
  return pLgivenObs + (1 - pLgivenObs) * pT;
}

/** Re-derive composite mastery and level from BKT + recall. */
function deriveLevel(record: MasteryRecord, now: number): {
  mastery: number;
  level: MasteryLevel;
} {
  const R = recallNow(record, now);
  const mastery = record.pL * R;
  let level: MasteryLevel;
  if (mastery >= 0.95 && record.masteryChallengePass) {
    level = "mastered";
  } else if (mastery >= 0.8) {
    level = "proficient";
  } else if (mastery >= 0.5) {
    level = "familiar";
  } else {
    level = "attempted";
  }
  return { mastery, level };
}

/** When a Mastery Challenge attempt passes for this skill, set the gate. */
export function passMasteryChallenge(skillId: string): MasteryRecord {
  const r = loadMastery(skillId);
  const next: MasteryRecord = { ...r, masteryChallengePass: true };
  const derived = deriveLevel(next, Date.now());
  const updated: MasteryRecord = { ...next, ...derived };
  saveMastery(updated);
  return updated;
}

// ---- Public attempt-recording API ----------------------------------------

export interface AttemptInput {
  skillId: string;
  correct: boolean;
  hintCount?: number;
  msToAnswer?: number;
  /** Internal — set when this attempt is a FIRe prereq credit, not a direct attempt. */
  _fireCredit?: boolean;
}

/** Record a single attempt against a skill. Idempotent within ~250 ms (a
 *  double-tap or React StrictMode double-invocation won't double-count).
 *
 *  Returns the updated record so the caller can read mastery/level for an
 *  immediate UI delta (e.g. the bar nudges forward right after a tap). */
export function recordAttempt(input: AttemptInput): MasteryRecord {
  const r = loadMastery(input.skillId);
  const now = Date.now();

  // Idempotency: if the last attempt was less than 250ms ago AND the same
  // correctness, treat as a dupe (StrictMode dev double-invoke / accidental
  // double-tap). The lastAttempts ring buffer is the canonical lookup.
  const lastAttempt = r.lastAttempts[r.lastAttempts.length - 1];
  if (lastAttempt && now - lastAttempt.ts < 250 && lastAttempt.correct === input.correct) {
    return r;
  }

  // Update BKT — but FIRe credits use a softened weight: only run the
  // *positive* posterior bump, never the slip-penalty branch.
  const weight = input._fireCredit ? FIRE_WEIGHT : 1;
  let newPL = bktUpdate(r.pL, input.correct, r.pG, r.pS, r.pT * weight);
  if (input._fireCredit) {
    // Soften: blend the prior with the new estimate by FIRE_WEIGHT.
    newPL = r.pL + (newPL - r.pL) * FIRE_WEIGHT;
  }

  // Half-life update: correct + no hint → big bump; correct + hint → modest;
  // wrong → cut in half, floor at 0.5 day.
  let newHalfLife = r.halfLifeDays;
  if (input.correct) {
    const hintBoost = (input.hintCount ?? 0) === 0 ? 1.7 : 1.2;
    newHalfLife = newHalfLife * hintBoost;
  } else if (!input._fireCredit) {
    newHalfLife = Math.max(0.5, newHalfLife * 0.5);
  }

  const newStreak = input.correct ? r.streak + 1 : 0;
  const newCorrect = r.correct + (input.correct ? 1 : 0);
  const newTotal = r.total + (input._fireCredit ? 0 : 1);
  const nextDue = now + newHalfLife * Math.log2(1 / TARGET_RECALL) * DAY_MS;

  const ringEntry = {
    ts: now,
    correct: input.correct,
    hintCount: input.hintCount,
    msToAnswer: input.msToAnswer,
  };
  const nextAttempts = [...r.lastAttempts, ringEntry].slice(-10);

  const base: MasteryRecord = {
    ...r,
    correct: newCorrect,
    total: newTotal,
    streak: newStreak,
    halfLifeDays: newHalfLife,
    lastSeen: now,
    nextDue,
    pL: newPL,
    lastAttempts: nextAttempts,
  };
  // Clamp guess/slip if anyone has tinkered with them later.
  base.pG = Math.min(MAX_PG, base.pG);
  base.pS = Math.min(MAX_PS, base.pS);

  const derived = deriveLevel(base, now);
  const updated: MasteryRecord = { ...base, ...derived };
  saveMastery(updated);

  // FIRe — credit each prereq with a fractional positive attempt.
  if (!input._fireCredit) {
    const skill = getSkill(input.skillId);
    if (skill) {
      for (const prereqId of skill.prereqs) {
        recordAttempt({
          skillId: prereqId,
          correct: input.correct,
          hintCount: input.hintCount,
          _fireCredit: true,
        });
      }
    }
  }

  return updated;
}

// ---- Aggregations (for UI) -----------------------------------------------

/** Composite mastery 0..1 averaged over a set of skills.
 *  Used by burj/constellation/star tiles to render "X% mastered". */
export function aggregateMastery(skillIds: ReadonlyArray<string>): number {
  if (skillIds.length === 0) return 0;
  let sum = 0;
  for (const id of skillIds) {
    const r = loadMastery(id);
    const { mastery } = deriveLevel(r, Date.now());
    sum += mastery;
  }
  return sum / skillIds.length;
}

/** All skill records currently in localStorage — scans the prefix.
 *  Used by the Mastery Challenge picker + the Personal Zij page. */
export function loadAllMastery(): MasteryRecord[] {
  if (typeof window === "undefined") return [];
  const out: MasteryRecord[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(STORAGE_PREFIX)) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as MasteryRecord;
        if (parsed.skillId) out.push(parsed);
      } catch {
        /* skip corrupt */
      }
    }
  } catch {
    /* unavailable */
  }
  return out;
}

/** Pick N skills the student recently practiced but hasn't mastered.
 *  This is the candidate pool for a Mastery Challenge — mixed-context
 *  retrieval across what they've seen lately. */
export function pickRecentSkills(n: number): MasteryRecord[] {
  return loadAllMastery()
    .filter((r) => r.total > 0 && !r.masteryChallengePass)
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, n);
}
