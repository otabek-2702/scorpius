/**
 * Typed loader for the emaktab snapshot — the single import point for any
 * app surface that needs to read what the extractor pulled.
 *
 * Why a loader (instead of importing the JSON directly):
 *  - applies subject-name normalisation (Ona tili, Rus tili, ...) at read time,
 *    so consumers never have to think about emaktab's casing quirks,
 *  - hides the file location,
 *  - lets us swap the source later (Firestore snapshot, an API route) without
 *    changing every caller.
 *
 * The on-disk JSON is the source of truth — see `scripts/extract-emaktab.ts`
 * for the shape and `docs/EMAKTAB-DATA.md` for the field-by-field semantics.
 */

import emaktabExport from "../data/emaktab-export.json";
import { markKind, normalizeSubjectName, type MarkKind, type SubjectId } from "./emaktab/normalize";

// ---- Types ------------------------------------------------------------------

export interface EmaktabProfile {
  name: string;
  className: string | null;
  school: string | null;
  grade: number | null;
  academicYear: string | null;
  emaktab: { schoolId: string | null; personId: string | null; groupId: string | null };
}

export interface EmaktabMark {
  value: string;
  /** Raw label from emaktab (Uzbek). Use `kind` for analytics. */
  type: string | null;
  kind: MarkKind;
  date: string | null;
  lessonNo: string | null;
}

export interface EmaktabSubjectGrades {
  /** Canonical display label, e.g. "Ona tili". */
  subject: string;
  /** Stable id used everywhere downstream — see [[normalize]]. */
  subjectId: SubjectId;
  average: string | null;
  finalMark: string | null;
  /** Always length 4 on the year-summary period, [Q1, Q2, Q3, Q4] with nulls for missing. */
  quarterMarks: (string | null)[] | null;
  marks: EmaktabMark[];
}

export interface EmaktabPeriodGrades {
  period: string; // "1" | "2" | "3" | "4" | "xulosa"
  subjects: EmaktabSubjectGrades[];
}

export interface EmaktabDiaryLesson {
  lessonNo: string | null;
  subject: string;
  subjectId: SubjectId;
  time: string | null;
  homework: string | null;
  homeworkDone: boolean;
  marks: { value: string; type: string | null; kind: MarkKind }[];
}

export interface EmaktabDiaryDay {
  /** Display text emaktab printed (Uzbek), e.g. "JUM, 22 may". */
  date: string;
  /** Unix epoch (seconds) — authoritative key, derived from data-test-id. */
  dateKey: string;
  /** ISO date "YYYY-MM-DD" — sortable + groupable. */
  iso: string;
  lessons: EmaktabDiaryLesson[];
}

export interface EmaktabHomework {
  task: string;
  subject: string | null;
  subjectId: SubjectId;
  lessonDate: string | null;
  lessonNo: string | null;
  updated: string | null;
  status: string | null;
}

export interface EmaktabSnapshot {
  profile: EmaktabProfile;
  grades: EmaktabPeriodGrades[];
  diary: EmaktabDiaryDay[];
  homework: EmaktabHomework[];
  meta: { source: string; pulledAt: string; notes: string[] };
}

// ---- Loader -----------------------------------------------------------------

let cached: EmaktabSnapshot | null = null;

/** The full snapshot, with subject names canonicalised and marks classified. */
export function getEmaktabSnapshot(): EmaktabSnapshot {
  if (cached) return cached;

  const raw = emaktabExport as {
    profile: EmaktabProfile;
    grades: {
      period: string;
      subjects: {
        subject: string;
        average: string | null;
        finalMark: string | null;
        quarterMarks: (string | null)[] | null;
        marks: { value: string; type: string | null; date: string | null; lessonNo: string | null }[];
      }[];
    }[];
    diary: {
      date: string;
      dateKey?: string;
      iso?: string;
      lessons: {
        lessonNo: string | null;
        subject: string;
        time: string | null;
        homework: string | null;
        homeworkDone: boolean;
        marks: { value: string; type: string | null }[];
      }[];
    }[];
    homework: {
      task: string;
      subject: string | null;
      lessonDate: string | null;
      lessonNo: string | null;
      updated: string | null;
      status: string | null;
    }[];
    meta: { source: string; pulledAt: string; notes: string[] };
  };

  cached = {
    profile: raw.profile,
    grades: raw.grades.map((p) => ({
      period: p.period,
      subjects: p.subjects.map((s) => {
        const { label, id } = normalizeSubjectName(s.subject);
        return {
          subject: label,
          subjectId: id,
          average: s.average,
          finalMark: s.finalMark,
          quarterMarks: s.quarterMarks,
          marks: s.marks.map((m) => ({
            value: m.value,
            type: m.type,
            kind: markKind(m.type),
            date: m.date,
            lessonNo: m.lessonNo,
          })),
        };
      }),
    })),
    diary: raw.diary.map((d) => ({
      date: d.date,
      dateKey: d.dateKey ?? "",
      iso: d.iso ?? "",
      lessons: d.lessons.map((l) => {
        const { label, id } = normalizeSubjectName(l.subject);
        return {
          lessonNo: l.lessonNo,
          subject: label,
          subjectId: id,
          time: l.time,
          homework: l.homework,
          homeworkDone: l.homeworkDone,
          marks: l.marks.map((m) => ({ value: m.value, type: m.type, kind: markKind(m.type) })),
        };
      }),
    })),
    homework: raw.homework.map((h) => {
      const { id } = normalizeSubjectName(h.subject);
      return {
        task: h.task,
        subject: h.subject,
        subjectId: id,
        lessonDate: h.lessonDate,
        lessonNo: h.lessonNo,
        updated: h.updated,
        status: h.status,
      };
    }),
    meta: raw.meta,
  };
  return cached;
}

// ---- Convenience views ------------------------------------------------------

/** Every distinct subject in the snapshot (from xulosa or the first non-empty period),
 *  in the order emaktab returned them. */
export function getEmaktabSubjects(): { subject: string; subjectId: SubjectId }[] {
  const snap = getEmaktabSnapshot();
  const source =
    snap.grades.find((p) => p.period === "xulosa")?.subjects ?? snap.grades[0]?.subjects ?? [];
  const seen = new Set<string>();
  const out: { subject: string; subjectId: SubjectId }[] = [];
  for (const s of source) {
    if (!s.subjectId || seen.has(s.subjectId)) continue;
    seen.add(s.subjectId);
    out.push({ subject: s.subject, subjectId: s.subjectId });
  }
  return out;
}

/** All diary days, sorted chronologically. */
export function getEmaktabDiary(): EmaktabDiaryDay[] {
  return getEmaktabSnapshot().diary.slice().sort((a, b) => Number(a.dateKey) - Number(b.dateKey));
}

/** All homework, sorted by lesson date (oldest first) — fallback to original order if undated. */
export function getEmaktabHomework(): EmaktabHomework[] {
  return getEmaktabSnapshot().homework.slice();
}

/** All marks earned in a given subject across the whole academic year. */
export function marksForSubject(subjectId: SubjectId): EmaktabMark[] {
  const snap = getEmaktabSnapshot();
  const out: EmaktabMark[] = [];
  for (const period of snap.grades) {
    if (period.period === "xulosa") continue; // summary has no individual marks
    const s = period.subjects.find((x) => x.subjectId === subjectId);
    if (s) out.push(...s.marks);
  }
  return out;
}
