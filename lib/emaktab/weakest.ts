/**
 * Weakest-lesson picker — pure function, no I/O.
 *
 * Scans the diary from newest to oldest, finds the most recent low-mark
 * (≤ 3) in fizika/tabiiy-fan, then ROUTES the student to the Scorpius lesson
 * whose topic best matches the school lesson where they struggled.
 *
 * Routing matches the lesson title/homework text against keyword fingerprints
 * for each cached lesson. If no fingerprint matches, falls back to a
 * subject-appropriate default (broun = the gentlest physics intro). The
 * `reasonUz` line surfaces the specific topic so the student sees a
 * personalization receipt, not a generic "we picked something" message.
 *
 * Note on subjectId values: the loader in lib/emaktab.ts normalises all raw
 * emaktab subject strings before they reach this function, so we compare
 * against the already-normalised ids ("fizika", "tabiiy-fan") — not the raw
 * emaktab strings ("Fizika", "Tabiiy fan").
 */

import type { EmaktabSnapshot } from "@/lib/emaktab";

export interface WeakestPick {
  grade: number;
  subject: "fizika" | "tabiiy-fan";
  lessonId: string;
  /** Short, second-person Uzbek explanation surfaced on the home star. */
  reasonUz: string;
  /** The school lesson title we matched against (for telemetry + parent brief). */
  matchedSchoolTopic: string;
  /** The actual mark that triggered this pick. */
  mark: number;
}

/** Keyword fingerprints — each cached Scorpius lesson knows which Uzbek
 *  textbook topic-strings indicate it's the right remediation. Lower-cased,
 *  diacritic-free, designed to survive school-side typos. First match wins. */
const FINGERPRINTS: ReadonlyArray<{
  lessonId: string;
  keywords: ReadonlyArray<string>;
}> = [
  // Bob I — Modda tuzilishi
  { lessonId: "broun", keywords: ["broun", "molekul", "diffuz", "modda tuzilish", "issiqlik harakat"] },
  // Bob II — Arximed / suyuqlik
  { lessonId: "arximed", keywords: ["arximed", "suzish", "cho'k", "ko'tarish kuch", "suyuqlik bosim"] },
  { lessonId: "paskal", keywords: ["paskal", "gidravlik", "yopiq idish", "bosim tarqal"] },
  // Bob III — Mexanika / oddiy mexanizmlar
  { lessonId: "richag", keywords: ["richag", "kuch momenti", "muvozanat", "oddiy mexanizm", "blok", "qiya tekislik"] },
  // Bob V — Elektr
  { lessonId: "zanjir", keywords: ["elektr", "tok", "zanjir", "lampa", "kuchlanish", "qarshilik", "om qonun"] },
  // Bob VI — Yorug'lik
  { lessonId: "tutilish", keywords: ["tutilish", "soya", "yarim soya", "quyosh oy", "oy quyosh"] },
  { lessonId: "kamalak", keywords: ["kamalak", "prizma", "spektr", "yorug'lik tarqal", "yorug'lik rang"] },
  { lessonId: "linza", keywords: ["linza", "fokus", "tasvir", "lupa", "ko'zgu", "yassi ko'zgu"] },
  // Bob VII — Tovush
  { lessonId: "tovush", keywords: ["tovush", "to'lqin", "akustika", "aks sado", "chastota", "amplitud"] },
];

/** Fallback when we recognised a low mark but no fingerprint matched.
 *  Pick by subject so the routing at least respects what the kid struggled in. */
const SUBJECT_FALLBACK: Record<"fizika" | "tabiiy-fan", string> = {
  fizika: "broun",        // gentlest physics intro
  "tabiiy-fan": "broun",  // shared with fizika at Grade 6 level
};

function normaliseTopic(s: string): string {
  return s
    .toLowerCase()
    .replace(/['ʼʻ`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Match the school lesson's title + homework text against fingerprints.
 *  Returns the best lessonId or null if nothing scores. */
function routeToLesson(topicText: string): string | null {
  const haystack = normaliseTopic(topicText);
  if (!haystack) return null;
  for (const fp of FINGERPRINTS) {
    for (const kw of fp.keywords) {
      if (haystack.includes(kw)) return fp.lessonId;
    }
  }
  return null;
}

/** Render the topic name into a brief Uzbek phrase. Falls back to the raw
 *  school topic if we have one; otherwise stays generic. */
function reasonFor(lessonId: string, mark: number, schoolTopic: string): string {
  const topicLabel: Record<string, string> = {
    broun: "Broun harakati",
    arximed: "Arximed qonuni",
    paskal: "Paskal qonuni",
    richag: "Richag va kuch momenti",
    zanjir: "Elektr zanjiri",
    tutilish: "Quyosh va Oy tutilishi",
    kamalak: "Kamalak va prizma",
    linza: "Linzalar",
    tovush: "Tovush kattaliklari",
  };
  const niceName = topicLabel[lessonId] ?? "shu mavzu";
  // Prefer the concrete school topic when we have one — it sounds like the
  // app knows what happened today.
  if (schoolTopic.trim()) {
    return `Kecha maktabda ${mark} olding — "${schoolTopic.trim()}". ${niceName}ni birga ko'rib chiqaylik.`;
  }
  return `Kecha maktabda ${mark} olding. ${niceName}ni birga ko'rib chiqaylik.`;
}

export function pickWeakestLesson(snapshot: EmaktabSnapshot): WeakestPick | null {
  const grade = snapshot.profile.grade ?? 6;
  const allDays = [...snapshot.diary].sort((a, b) => b.iso.localeCompare(a.iso));
  for (const day of allDays) {
    for (const lesson of day.lessons) {
      if (lesson.subjectId !== "fizika" && lesson.subjectId !== "tabiiy-fan") continue;
      const worstMark = lesson.marks
        .map((m) => parseInt(m.value, 10))
        .filter((n) => !isNaN(n))
        .sort((a, b) => a - b)[0];
      if (worstMark === undefined || worstMark > 3) continue;

      // Combine title + homework into one fingerprintable string. emaktab's
      // diary lesson model only carries `subject` + `homework`, so we hash both.
      const topicText = [lesson.subject, lesson.homework ?? ""].join(" ");
      const routedId = routeToLesson(topicText);
      const lessonId = routedId ?? SUBJECT_FALLBACK[lesson.subjectId];

      return {
        grade,
        subject: lesson.subjectId,
        lessonId,
        reasonUz: reasonFor(lessonId, worstMark, lesson.homework ?? lesson.subject),
        matchedSchoolTopic: lesson.subject,
        mark: worstMark,
      };
    }
  }
  return null;
}
