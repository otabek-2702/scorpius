"use client";

/**
 * Session scheduler — picks what the student should do NEXT.
 *
 * The Wilson & Shenhav 85% Rule says learning is fastest when the next
 * problem is one the learner is ~85% likely to solve. So the scheduler
 * targets predicted P(correct) ≈ 0.85, blended with:
 *
 *   55% ZPD core (predicted P(correct) ∈ [0.75, 0.90])
 *   25% at-risk review (predicted recall ≤ 0.85, weighted by prereq fan-out)
 *   10% exploratory (new topic at the prereq frontier OR mixed-context)
 *   10% confidence builder (recently-mastered, P(correct) ≥ 0.95)
 *
 * v1 operates on SKILLS, not items — there's one canonical Scorpius lesson
 * per skill cluster today. Phase 4 will swap in per-item scheduling once
 * the content engine produces an item bank.
 *
 * Two public entry points:
 *   - `pickNextLesson(skyStars)` — feeds the "Bugungi yulduz" card on /learn
 *   - `pickMasteryChallengeSkills(n)` — feeds the Mastery Challenge picker
 */

import { LESSON_SKILLS, SKILLS, getSkill, type Skill } from "@/lib/skills";
import { loadAllMastery, loadMastery, recallNow, type MasteryRecord } from "@/lib/mastery";

/** Predicted probability of correct response on the next attempt for a skill. */
export function predictCorrect(skillId: string): number {
  const r = loadMastery(skillId);
  const R = recallNow(r);
  // BKT predicted correctness: pL·(1−pS) + (1−pL)·pG, decayed by R.
  return (r.pL * (1 - r.pS) + (1 - r.pL) * r.pG) * R;
}

/** Skills whose prereqs are all proficient (pL × R ≥ 0.80). The frontier
 *  is what the scheduler can introduce next — never something whose
 *  prerequisites haven't been built. */
function frontierSkills(): Skill[] {
  function masteryOf(id: string): number {
    const r = loadMastery(id);
    return r.pL * recallNow(r);
  }
  return SKILLS.filter((s) => {
    const own = masteryOf(s.id);
    if (own >= 0.95) return false; // already mastered, not frontier
    return s.prereqs.every((p) => masteryOf(p) >= 0.5);
  });
}

/** Fan-out: how many other skills list `skillId` as a prereq.
 *  Used to weight at-risk review — a prereq many other skills depend on
 *  is more painful to lose. */
function prereqFanOut(skillId: string): number {
  let count = 0;
  for (const s of SKILLS) {
    if (s.prereqs.includes(skillId)) count++;
  }
  return count;
}

// ---- Lesson picker --------------------------------------------------------

export interface NextLessonPick {
  lessonId: string;
  /** Why this lesson, not another. Short Uzbek sentence for the UI receipt. */
  reasonUz: string;
  /** Which bucket the pick came from — useful for telemetry. */
  bucket: "zpd" | "at-risk" | "frontier" | "confidence" | "fallback";
}

/** Score a lesson against the four buckets, return the highest. */
function scoreLesson(lessonId: string): {
  score: number;
  bucket: NextLessonPick["bucket"];
  reasonUz: string;
} {
  const skillIds = LESSON_SKILLS[lessonId] ?? [];
  if (skillIds.length === 0) return { score: 0, bucket: "fallback", reasonUz: "" };
  // Average the four bucket signals across the lesson's skills.
  let zpd = 0, risk = 0, frontier = 0, confidence = 0;
  for (const id of skillIds) {
    const p = predictCorrect(id);
    const r = loadMastery(id);
    const recall = recallNow(r);
    // ZPD: Gaussian peak at p=0.85, σ=0.06
    zpd += Math.exp(-((p - 0.85) ** 2) / (2 * 0.06 * 0.06));
    // At-risk: low recall × fan-out
    risk += (1 - recall) * (1 + prereqFanOut(id));
    // Frontier: never attempted (total == 0) but prereqs met
    if (r.total === 0) {
      const skill = getSkill(id);
      const prereqsMet = skill?.prereqs.every((pid) => {
        const pr = loadMastery(pid);
        return pr.pL * recallNow(pr) >= 0.5;
      }) ?? true;
      if (prereqsMet) frontier += 1;
    }
    // Confidence builder: recently mastered (pL ≥ 0.95), needs a quick win
    if (r.pL >= 0.95 && r.total > 0) confidence += 1;
  }
  const n = skillIds.length;
  zpd /= n; risk /= n; frontier /= n; confidence /= n;
  // Weighted blend per master plan: 55/25/10/10
  const score = 0.55 * zpd + 0.25 * Math.min(1, risk) + 0.10 * frontier + 0.10 * confidence;
  // Pick the dominant bucket for the reason line.
  const labelled: Array<[NextLessonPick["bucket"], number]> = [
    ["zpd", 0.55 * zpd],
    ["at-risk", 0.25 * Math.min(1, risk)],
    ["frontier", 0.10 * frontier],
    ["confidence", 0.10 * confidence],
  ];
  labelled.sort((a, b) => b[1] - a[1]);
  const [topBucket] = labelled[0];
  const reasonUz = (() => {
    switch (topBucket) {
      case "zpd":
        return "Bu mavzu hozir aynan o'rganish chegarasida — siz uchun maqbul.";
      case "at-risk":
        return "Bu mavzu yarim unutilgan — qisqa takror foydali.";
      case "frontier":
        return "Avvalgi mavzular tayyor — yangi qadam vaqti keldi.";
      case "confidence":
        return "Bu mavzuni allaqachon o'rganganingizdan — qisqa tasdiq.";
      default:
        return "";
    }
  })();
  return { score, bucket: topBucket, reasonUz };
}

/** Pick the best next lesson among a candidate list (e.g. the unlocked stars
 *  in the current constellation). Falls back to the first candidate if no
 *  scoring signal beats zero. */
export function pickNextLesson(candidateLessonIds: ReadonlyArray<string>): NextLessonPick | null {
  if (candidateLessonIds.length === 0) return null;
  let best: { lessonId: string; score: number; bucket: NextLessonPick["bucket"]; reasonUz: string } | null = null;
  for (const lessonId of candidateLessonIds) {
    const scored = scoreLesson(lessonId);
    if (!best || scored.score > best.score) {
      best = { lessonId, ...scored };
    }
  }
  if (!best || best.score === 0) {
    return {
      lessonId: candidateLessonIds[0],
      bucket: "fallback",
      reasonUz: "Avvalgi darsing yakunlandi — keyingi bosqich.",
    };
  }
  return {
    lessonId: best.lessonId,
    bucket: best.bucket,
    reasonUz: best.reasonUz,
  };
}

// ---- Mastery Challenge picker --------------------------------------------

/** Pick N skills the student has practiced but not yet passed a Mastery
 *  Challenge on — recency-weighted, with a soft preference for skills in
 *  different units so the challenge is genuinely mixed-context. */
export function pickMasteryChallengeSkills(count: number): MasteryRecord[] {
  const all = loadAllMastery();
  const candidates = all.filter((r) => r.total >= 2 && !r.masteryChallengePass);
  if (candidates.length === 0) return [];

  // Sort by recency desc, then take a unit-diverse top-N.
  candidates.sort((a, b) => b.lastSeen - a.lastSeen);
  const seenUnits = new Set<string>();
  const out: MasteryRecord[] = [];
  for (const c of candidates) {
    const skill = getSkill(c.skillId);
    if (!skill) continue;
    if (seenUnits.has(skill.unit) && out.length < count) {
      // Allow same-unit picks once we've exhausted distinct units.
      continue;
    }
    out.push(c);
    seenUnits.add(skill.unit);
    if (out.length >= count) break;
  }
  // If we couldn't fill from distinct units, top off from the rest.
  if (out.length < count) {
    for (const c of candidates) {
      if (out.some((o) => o.skillId === c.skillId)) continue;
      out.push(c);
      if (out.length >= count) break;
    }
  }
  return out;
}
