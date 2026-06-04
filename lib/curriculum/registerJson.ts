// lib/curriculum/registerJson.ts
/**
 * Adapter: convert a LessonContent (the JSON schema authored under
 * data/curriculum/uz/lessons/grade-N/...) into the existing runtime Lesson shape
 * (lib/lesson.ts). Keeps the JSON schema editor-friendly while reusing the
 * lesson player + Card DSL we already shipped in v0.1.
 */
import { loadLesson } from "./loader";
import type { Lesson } from "@/lib/lesson";
import type { LessonContent } from "./types";

const SUBJECT_LABEL: Record<LessonContent["subject"], string> = {
  fizika: "FIZIKA",
  kimyo: "KIMYO",
  matematika: "MATEMATIKA",
  biologiya: "BIOLOGIYA",
  "tabiiy-fan": "TABIIY FAN",
};

const SUBJECT_TO_RUNTIME: Record<LessonContent["subject"], Lesson["subject"]> = {
  fizika: "physics",
  kimyo: "chemistry",
  matematika: "math",
  biologiya: "biology",
  "tabiiy-fan": "physics", // 6-sinf integrated science maps to "physics" for now
};

export function lessonFromJson(content: LessonContent): Lesson {
  // The runtime Lesson interface (lib/lesson.ts:98) wants:
  //   id?, subject, subjectLabel, title, cards. mentorId is bolted on via
  //   cast — Task 9 will officially type it on Lesson.
  return {
    id: content.id,
    subject: SUBJECT_TO_RUNTIME[content.subject],
    subjectLabel: SUBJECT_LABEL[content.subject],
    title: content.titleUz,
    cards: content.cards,
    mentorId: content.mentorId,
  } as Lesson;
}

export async function loadAndAdapt(
  grade: number,
  subject: LessonContent["subject"],
  lessonId: string,
): Promise<Lesson | null> {
  const c = await loadLesson(grade, subject, lessonId);
  if (!c) return null;
  return lessonFromJson(c);
}
