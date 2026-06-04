// lib/curriculum/types.ts
/**
 * Schema for a single authored lesson — the JSON at
 * data/curriculum/uz/lessons/grade-{N}/{subject}/{lessonId}.json. Adapter at
 * lib/curriculum/registerJson.ts converts to the runtime Lesson (lib/lesson.ts).
 *
 * Cards use the existing Card union from lib/lesson.ts (now extended in Task 9
 * with 6 manifesto kinds: predict · explore-sandbox · challenge ·
 * pattern-discover · compare-and-decide · build).
 */
import type { Card } from "@/lib/lesson";
import type { PersonaId } from "@/lib/personas";

export type SubjectId = "fizika" | "kimyo" | "matematika" | "biologiya" | "tabiiy-fan";

export interface LessonMisconception {
  id: string;
  labelUz: string;
  watchFor: string;
}

export interface LessonContent {
  id: string;
  grade: number;
  subject: SubjectId;
  titleUz: string;
  chapterUz: string;
  summaryUz: string;
  source: { url: string; pulledAt: string; notes?: string };
  mentorId: PersonaId;
  misconceptions: LessonMisconception[];
  cards: Card[];
}
