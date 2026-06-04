import { readFileSync, statSync } from "fs";

/**
 * Verify the latest emaktab extract against the audit checklist
 * (steps A · A2 · C · D from the cleanup pass). Read-only.
 *
 *   npx tsx scripts/verify-emaktab.ts
 */

const PATH = "data/emaktab-export.json";

interface DiaryDay {
  date: string;
  dateKey?: string;
  iso?: string;
  lessons: { lessonNo: string | null; subject: string }[];
}

interface PeriodGrades {
  period: string;
  subjects: {
    subject: string;
    quarterMarks: (string | null)[] | null;
    finalMark: string | null;
    marks: { value: string; type: string | null; date: string | null }[];
  }[];
}

const data = JSON.parse(readFileSync(PATH, "utf8")) as {
  profile: {
    name: string;
    school: string | null;
    className: string | null;
    academicYear: string | null;
    emaktab: Record<string, string | null>;
  };
  grades: PeriodGrades[];
  diary: DiaryDay[];
  homework: { task: string; subject: string | null }[];
  meta: { pulledAt: string; notes: string[] };
};

let pass = 0;
let fail = 0;
let warn = 0;
const check = (label: string, condition: boolean, evidence: string) => {
  if (condition) {
    pass++;
    console.log(`PASS ${label}  ·  ${evidence}`);
  } else {
    fail++;
    console.log(`FAIL ${label}  ·  ${evidence}`);
  }
};
const note = (label: string, evidence: string) => {
  warn++;
  console.log(`NOTE ${label}  ·  ${evidence}`);
};

console.log(
  `\nverifying ${PATH} (${(statSync(PATH).size / 1024).toFixed(1)} KB · pulled ${data.meta.pulledAt})\n`
);

// ---- A: no oversize day, no duplicate date ----
const maxLessons = Math.max(...data.diary.map((d) => d.lessons.length));
check(
  "A · no day with more than 12 lessons",
  maxLessons <= 12,
  `max lessons-per-day = ${maxLessons}`
);

const datesSeen = new Map<string, number>();
for (const d of data.diary) {
  const key = d.dateKey || d.date;
  datesSeen.set(key, (datesSeen.get(key) ?? 0) + 1);
}
const dupes = [...datesSeen.entries()].filter(([, n]) => n > 1);
check(
  "A · no duplicate diary days",
  dupes.length === 0,
  dupes.length === 0
    ? `${data.diary.length} unique days`
    : `duplicates: ${dupes.slice(0, 3).map(([k, n]) => `${k}×${n}`).join(", ")}`
);

// ---- A2: deep diary walk ----
const isoSorted = data.diary
  .map((d) => d.iso || "")
  .filter(Boolean)
  .sort();
const earliestIso = isoSorted[0] || "(none)";
const latestIso = isoSorted[isoSorted.length - 1] || "(none)";
check(
  "A2 · diary walked back beyond 2025-12-01",
  earliestIso !== "(none)" && earliestIso <= "2025-12-01",
  `earliest day = ${earliestIso}, latest = ${latestIso}, total ${data.diary.length} days`
);

// span in weeks
if (earliestIso !== "(none)" && latestIso !== "(none)") {
  const spanDays = Math.round(
    (new Date(latestIso).getTime() - new Date(earliestIso).getTime()) / 86400000
  );
  note("A2 · span", `${spanDays} days (${(spanDays / 7).toFixed(1)} weeks)`);
}

// ---- C: every xulosa row has a 4-slot quarterMarks ----
const xulosa = data.grades.find((p) => p.period === "xulosa");
if (xulosa) {
  const badRows = xulosa.subjects.filter(
    (s) => s.quarterMarks && s.quarterMarks.length !== 4
  );
  check(
    "C · every xulosa row has a 4-slot quarterMarks",
    badRows.length === 0,
    badRows.length === 0
      ? `${xulosa.subjects.length} subjects, all 4-slot`
      : `${badRows.length} bad rows: ${badRows.map((r) => `${r.subject}(${r.quarterMarks?.length})`).join(", ")}`
  );
} else {
  fail++;
  console.log("FAIL C · xulosa period missing");
}

// ---- D: school name ----
if (data.profile.school) {
  pass++;
  console.log(`PASS D · profile.school populated  ·  "${data.profile.school}"`);
} else {
  note("D · profile.school is null", "selector probe found nothing — left honestly null");
}

// ---- General health ----
const markTotal = data.grades.reduce(
  (n, p) => n + p.subjects.reduce((m, s) => m + s.marks.length, 0),
  0
);
note(
  "general · totals",
  `profile=${data.profile.name} · ${data.profile.className} · ${data.profile.academicYear} · ${data.grades.length} periods · ${markTotal} marks · ${data.diary.length} diary days · ${data.homework.length} homework`
);

if (data.meta.notes.length) {
  console.log("\n-- extractor notes --");
  for (const n of data.meta.notes) console.log(`   · ${n}`);
}

console.log(`\n${pass} pass · ${fail} fail · ${warn} note`);
process.exit(fail === 0 ? 0 : 1);
