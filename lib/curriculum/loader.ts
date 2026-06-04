// lib/curriculum/loader.ts
import type { LessonContent, SubjectId } from "./types";

/** Allowlist for runtime subject validation. Mirrors the SubjectId TS union. */
const ALLOWED_SUBJECTS: ReadonlySet<SubjectId> = new Set([
  "fizika", "kimyo", "matematika", "biologiya", "tabiiy-fan",
]);

/** Lesson ids are short kebab/snake slugs — letters, digits, hyphen, underscore. No dots, no slashes. */
const SAFE_LESSON_ID = /^[a-z0-9][a-z0-9_-]*$/i;

/**
 * Validates each path segment before constructing the dynamic-import path.
 * Defends against path traversal when `lessonId` originates from URL params,
 * emaktab snapshot fields, or any other user-influenced input. Webpack's
 * static bundling provides additional defense in practice, but we don't
 * rely on it — explicit allowlist + slug regex is the contract.
 */
export async function loadLesson(
  grade: number,
  subject: SubjectId,
  lessonId: string,
): Promise<LessonContent | null> {
  if (!Number.isInteger(grade) || grade < 1 || grade > 12) return null;
  if (!ALLOWED_SUBJECTS.has(subject)) return null;
  if (!SAFE_LESSON_ID.test(lessonId)) return null;
  try {
    const mod = await import(
      `@/data/curriculum/uz/lessons/grade-${grade}/${subject}/${lessonId}.json`
    );
    return mod.default as LessonContent;
  } catch {
    return null;
  }
}
