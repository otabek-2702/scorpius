/**
 * Weakest-lesson picker — pure function, no I/O.
 *
 * Scans the diary from newest to oldest and returns the first lesson where
 * the student scored ≤ 3 in fizika or tabiiy-fan. Returns null when the
 * diary has no such entry.
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
  reasonUz: string;
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
      if (worstMark !== undefined && worstMark <= 3) {
        return {
          grade,
          subject: lesson.subjectId as "fizika" | "tabiiy-fan",
          lessonId: "density", // Plan #1 ships density as the pilot; Plan #2 will route by topic
          reasonUz: `Bugun maktabda ${worstMark} olding. Birga tuzataylik.`,
        };
      }
    }
  }
  return null;
}
