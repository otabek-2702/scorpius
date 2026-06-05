/**
 * Demo-data generator — produces a plausible EmaktabExport when the real
 * emaktab account returns empty (e.g. summer break, brand-new academic
 * year, fresh transfer student).
 *
 * Strategy:
 *   - Use the real profile (name, class, school, grade) that was scraped.
 *   - Generate 8 weeks of diary days walking back from a synthetic "today"
 *     in the active school year (April–May 2026, the back half of
 *     2025/2026).
 *   - 6 plausible subjects per grade level, each with its own per-mark
 *     distribution biased toward 4-5 with a few 3s — feels like a real
 *     middle-pack student.
 *   - Final grade panel summarising what the diary contains.
 *
 * The output is deterministic per profile (seeded from the profile name +
 * personId) so a parent who connects twice sees the same dashboard, not a
 * jarring new set of "grades".
 *
 * Mark source is tagged via `meta.source = "demo-vacation"` and the dashboard
 * footnote surfaces it honestly: this is generated, not from emaktab.
 */

import type { EmaktabExport, Profile } from "@/lib/emaktab/extract.server";

const UZ_DAY = ["DSH", "SE", "CHR", "PA", "JUM", "SH", "YA"] as const;
const UZ_MO = [
  "yan", "fev", "mar", "apr", "may", "iyun",
  "iyul", "avg", "sent", "okt", "noy", "dek",
] as const;

interface SubjectDef {
  subject: string;
  subjectId: string;
  /** Pool of plausible marks for this subject for this student. The first
   *  entries appear more often because we sample with replacement. Weighting
   *  the pool toward 4-5 keeps the demo feeling like a B+ student. */
  pool: number[];
}

/** Subject mix per grade tier. 5-7 sinf = core middle-school subjects, 8+ adds
 *  chemistry/physics in earnest. Falls back to the 5-7 mix when grade unknown. */
function subjectsForGrade(grade: number | null): SubjectDef[] {
  const g = grade ?? 6;
  if (g <= 4) {
    return [
      { subject: "Matematika",     subjectId: "matematika",     pool: [5, 5, 5, 4, 4, 4, 4, 5, 3] },
      { subject: "Ona tili",       subjectId: "ona-tili",       pool: [5, 5, 5, 5, 4, 4, 4, 5] },
      { subject: "Atrofimizdagi olam", subjectId: "atrof-olam", pool: [5, 4, 5, 4, 4, 5, 5] },
      { subject: "Ingliz tili",    subjectId: "ingliz-tili",    pool: [4, 4, 5, 4, 4, 4, 3] },
      { subject: "Jismoniy tarbiya", subjectId: "jismoniy",     pool: [5, 5, 5, 4, 5] },
    ];
  }
  if (g <= 7) {
    return [
      { subject: "Matematika",  subjectId: "matematika",  pool: [5, 5, 4, 4, 5, 4, 5, 3, 4, 5] },
      { subject: "Fizika",      subjectId: "fizika",      pool: [4, 3, 3, 4, 3, 4, 4, 3, 4, 3] },
      { subject: "Ona tili",    subjectId: "ona-tili",    pool: [5, 5, 4, 5, 5, 5, 4, 5] },
      { subject: "Ingliz tili", subjectId: "ingliz-tili", pool: [4, 4, 3, 4, 3, 4, 4, 3] },
      { subject: "Tarix",       subjectId: "tarix",       pool: [4, 5, 4, 4, 5, 4] },
      { subject: "Biologiya",   subjectId: "biologiya",   pool: [5, 4, 4, 5, 3, 4, 5] },
    ];
  }
  // 8+ sinf
  return [
    { subject: "Algebra",     subjectId: "algebra",     pool: [4, 4, 4, 3, 5, 4, 4, 3, 4] },
    { subject: "Geometriya",  subjectId: "geometriya",  pool: [4, 4, 3, 4, 4, 3, 4] },
    { subject: "Fizika",      subjectId: "fizika",      pool: [4, 3, 4, 3, 4, 3, 4, 3] },
    { subject: "Kimyo",       subjectId: "kimyo",       pool: [4, 4, 5, 4, 4, 3] },
    { subject: "Ona tili",    subjectId: "ona-tili",    pool: [5, 5, 4, 5, 5, 4, 5] },
    { subject: "Ingliz tili", subjectId: "ingliz-tili", pool: [4, 4, 3, 4, 3, 4, 4] },
    { subject: "Tarix",       subjectId: "tarix",       pool: [4, 5, 4, 4, 5, 4] },
  ];
}

/** Tiny LCG seeded from a string — deterministic so the same profile always
 *  produces the same demo data. */
function seededRng(seed: string): () => number {
  let state = 0;
  for (let i = 0; i < seed.length; i++) {
    state = (state * 31 + seed.charCodeAt(i)) | 0;
  }
  state = (state ^ 0xdeadbeef) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function dayLabel(d: Date): string {
  return `${UZ_DAY[(d.getDay() + 6) % 7]}, ${d.getDate()} ${UZ_MO[d.getMonth()]}`;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Anchor the synthetic "today" deterministically so the dataset looks like
 *  it ended last May (end of 2025/2026). Real today (June 2026) would put
 *  us in vacation — we want to render *recent school marks*. */
const SYNTHETIC_TODAY = new Date(2026, 4, 23); // 23 May 2026

const QUARTER_LABELS = ["1", "2", "3", "4", "xulosa"];

export function generateDemoData(profile: Profile): EmaktabExport {
  const seedKey =
    (profile.name ?? "demo") +
    "|" +
    (profile.emaktab.personId ?? "p") +
    "|" +
    (profile.className ?? "c");
  const rng = seededRng(seedKey);
  const subjects = subjectsForGrade(profile.grade);

  // ---- Diary: 8 weeks of weekdays back from SYNTHETIC_TODAY ----
  const diary: EmaktabExport["diary"] = [];
  const end = new Date(SYNTHETIC_TODAY);
  for (let i = 56; i >= 0; i--) {
    const day = new Date(end);
    day.setDate(end.getDate() - i);
    if (day.getDay() === 0) continue; // skip Sundays
    const dailyMix = [...subjects];
    // 5-6 lessons a day; rotate so each subject appears across the week.
    const lessonCount = 5 + Math.floor(rng() * 2);
    const todays: SubjectDef[] = [];
    for (let s = 0; s < lessonCount; s++) {
      const idx = Math.floor(rng() * dailyMix.length);
      todays.push(dailyMix[idx]);
      dailyMix.splice(idx, 1);
      if (dailyMix.length === 0) dailyMix.push(...subjects);
    }
    const lessons = todays.map((s, slot) => {
      const hasMark = rng() < 0.32;
      const marks = hasMark
        ? [
            {
              value: String(pick(s.pool, rng)),
              type: "kundalik",
            },
          ]
        : [];
      const hasHomework = rng() < 0.55;
      const homeworkDone = hasHomework && rng() < (s.subjectId === "ona-tili" ? 0.92 : 0.78);
      // DiaryLesson shape (raw — subjectId is computed by the loader via
      // normalizeSubjectName so we emit only `subject` here).
      return {
        lessonNo: String(slot + 1),
        subject: s.subject,
        time: `${8 + slot}:00`,
        homework: hasHomework ? `${s.subject} — mashqlarni bajaring` : null,
        homeworkDone,
        marks,
      };
    });
    diary.push({
      date: dayLabel(day),
      dateKey: String(Math.floor(day.getTime() / 1000)),
      iso: isoDate(day),
      lessons,
    });
  }

  // ---- Grades panel: aggregate diary marks per subject + a "xulosa" entry ----
  // Bucket by display name (raw `subject`) — the loader will normalize to
  // subjectId on read.
  const collectedBySubject = new Map<string, number[]>();
  for (const d of diary) {
    for (const l of d.lessons) {
      for (const m of l.marks) {
        const v = parseInt(m.value, 10);
        if (!Number.isFinite(v)) continue;
        const list = collectedBySubject.get(l.subject);
        if (list) list.push(v);
        else collectedBySubject.set(l.subject, [v]);
      }
    }
  }

  // SubjectGrades shape (raw — `subjectId` added by the loader downstream).
  const subjectGrades = subjects.map((s) => {
    const values = collectedBySubject.get(s.subject) ?? [];
    const avgRaw = values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
    const finalRound = avgRaw === 0 ? null : Math.round(avgRaw);
    return {
      subject: s.subject,
      average: avgRaw === 0 ? null : avgRaw.toFixed(1),
      finalMark: finalRound === null ? null : String(finalRound),
      quarterMarks: null as (string | null)[] | null,
      marks: values.map((v, i) => ({
        value: String(v),
        type: "kundalik",
        date: i === 0 ? dayLabel(SYNTHETIC_TODAY) : null,
        lessonNo: null,
      })),
    };
  });

  const summarySubjects = subjects.map((s, i) => {
    const sg = subjectGrades[i];
    const final = sg.finalMark;
    return {
      ...sg,
      finalMark: final,
      quarterMarks: final ? ([final, final, final, final] as (string | null)[]) : null,
    };
  });

  const grades = QUARTER_LABELS.map((period) => ({
    period,
    subjects: period === "xulosa" ? summarySubjects : subjectGrades,
  }));

  // ---- Homework list — pull a handful of recent ones ----
  // HomeworkItem shape: raw subject string, no subjectId.
  const homework = diary
    .slice(-14)
    .flatMap((d) =>
      d.lessons
        .filter((l) => l.homework)
        .map((l) => ({
          task: l.homework!,
          subject: l.subject,
          lessonDate: d.date,
          lessonNo: l.lessonNo,
          updated: d.iso,
          status: l.homeworkDone ? "bajarildi" : "kutmoqda",
        })),
    )
    .slice(-30);

  return {
    profile,
    grades,
    diary,
    homework,
    meta: {
      source: "demo-vacation (real profile + generated marks; emaktab returned empty)",
      pulledAt: new Date().toISOString(),
      notes: [
        "Yozgi ta'til — emaktabda hozircha baholar yo'q. Sizning profilingiz asosida namuna ma'lumotlari yaratildi.",
      ],
    },
  };
}

/** True when a real extraction came back essentially empty — caller should
 *  substitute generated data for the dashboard to have anything to render. */
export function shouldUseDemoData(extracted: EmaktabExport): boolean {
  const totalMarks = extracted.grades.reduce(
    (n, p) => n + p.subjects.reduce((m, s) => m + s.marks.length, 0),
    0,
  );
  const dayHasLessons = extracted.diary.some((d) => d.lessons.length > 0);
  return totalMarks === 0 && !dayHasLessons;
}
