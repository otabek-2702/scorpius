# emaktab data — site map, extraction, data shape

> How Scorpius gets its real-student signal. The emaktab Sync agent of
> `ARCHITECTURE.md` §9: a consented, user-authorized pull from emaktab.uz
> (Kundalik), normalized and cached. Posture is the Plaid model — the parent/
> student provides their own login; the agent acts as their browser, on their
> behalf. Never described to judges as "scraping".

---

## 1. The account

One consented demo account: **Vasliddin Shahobiddinov**, class **6-a**, school
**64** (`64-sonli umumiy o'rta ta'lim maktabi`), academic year **2025/2026**.
Credentials live in `.env.local` as `EMAKTAB_USERNAME` / `EMAKTAB_PASSWORD` —
never in code, chat, or git.

emaktab IDs discovered for this account:

| ID | Value |
|----|-------|
| `schoolId`  | `1000004672539` |
| `personId`  | `1000005506825` |
| `groupId`   | `2362942520810758875` |

**Honest scope:** this is a single Grade-6 student. The account exposes exactly
**one academic year (2025/2026)** — there is no past-year history to pull. The
homework page's year dropdown lists 2020/2021–2027/2028, but those are empty
shells; only 2025/2026 holds real data.

---

## 2. Site map

emaktab spans two front-ends: the classic `emaktab.uz` server-rendered pages
and the newer `schools.emaktab.uz/v2` React app. The extractor favours the
classic pages — they carry stable `data-test-id` attributes.

| Page | URL | What it has |
|------|-----|-------------|
| Userfeed | `emaktab.uz/userfeed` | recent grades, today's timetable, links carrying the account IDs |
| Kundalik — Joriy | `emaktab.uz/marks` | the diary: a multi-week window of daily lessons with time, marks, and homework per lesson |
| Kundalik — Choraklar | `emaktab.uz/marks/school/{schoolId}/student/{personId}/period` | the quarter grade table — one row per subject |
| Login | `login.emaktab.uz/login` | `login` / `password` fields; captcha appears only after failed attempts |
| Timetable (v2) | `schools.emaktab.uz/v2/schedules/` | full weekly schedule grid (teachers, rooms) — not scraped, the diary covers it |
| Homework (v2) | `schools.emaktab.uz/v2/homework` | paginated homework list with status |

### The quarter grade table

The `/period` page has a period selector with five tabs: **1, 2, 3, 4, xulosa**.
Selecting one reloads the table via a `?periodId=` navigation.

- A **quarter** view (1–4): columns `Fan | marks | O'rtacha ball | <N> Chorak`.
  Every mark cell has a tooltip giving its **type, date, and lesson number**.
- The **xulosa** (summary) view: columns `Fan | 1–4 Chorak | Yil | Imtihon |
  Xulosa` — per-quarter final marks plus the year-final mark.

---

## 3. What is and is not extractable

**Extractable (and extracted):**

- Profile — name, class, school, grade, academic year, emaktab IDs.
- Grades — every mark for all four quarters, each with type, date, lesson no.;
  per-subject quarter average and quarter-final mark; year-final marks.
- Diary — **the entire academic year**: every school day from Day 1 (2025-09-02)
  to today, with per-lesson subject, time, marks, homework text, and whether
  the homework is marked done. The extractor clicks the `arrow-left` control on
  `/marks` week-by-week until emaktab returns no earlier history.
- Homework — the full homework list with subject, lesson date, status.

**Not extracted (by design):**

- Past academic years — they do not exist for this account.
- The v2 schedule grid (teachers/rooms) — the diary already carries the
  timetable; teacher names are not needed for tutoring.
- Chats, social feed — out of scope.

---

## 4. The extracted data shape

`scripts/extract-emaktab.ts` writes `data/emaktab-export.json` (gitignored):

```jsonc
{
  "profile": {
    "name": "Vasliddin Shahobiddinov",
    "className": "6-a",
    "school": "64-sonli umumiy o'rta ta'lim maktabi",
    "grade": 6,
    "academicYear": "2025/2026",
    "emaktab": { "schoolId": "...", "personId": "...", "groupId": "..." }
  },
  "grades": [                       // one entry per period: "1".."4","xulosa"
    {
      "period": "4",
      "subjects": [
        {
          "subject": "Adabiyot",
          "average": "5",           // O'rtacha ball
          "finalMark": "5",         // the quarter mark (or year mark on xulosa)
          "quarterMarks": null,     // always 4-slot [Q1,Q2,Q3,Q4] on xulosa
                                    // (with nulls for missing quarters); null
                                    // on individual-quarter periods
          "marks": [
            { "value": "5", "type": "Darsda javob",
              "date": "02 aprel 2026", "lessonNo": "5 dars" }
          ]
        }
      ]
    }
  ],
  "diary": [                        // every school day in the academic year
    {
      "date": "JUM, 22 may",        // emaktab's display text (Uzbek)
      "dateKey": "1779408000",      // unix epoch seconds — authoritative key
      "iso": "2026-05-22",          // derived for sorting/grouping
      "lessons": [
        {
          "lessonNo": "3", "subject": "Matematika",
          "time": "14:50 - 15:35",
          "homework": "2-mashq daftari 127-128-betlar",
          "homeworkDone": false,
          "marks": [ { "value": "5", "type": "Darsda javob" } ]
        }
      ]
    }
  ],
  "homework": [
    {
      "task": "Oila haqida insho yozish", "subject": "Kelajak soati",
      "lessonDate": "18 may 2026", "lessonNo": "1",
      "updated": "18 may 2026 da 14:30", "status": "Bajarildi"
    }
  ],
  "meta": { "source": "...", "pulledAt": "ISO-8601", "notes": [] }
}
```

### Read it in the app via `lib/emaktab.ts`

Application code never touches the raw JSON. `lib/emaktab.ts` is the typed
loader — it normalises subject names through `lib/emaktab/normalize.ts`
(so "ona tili", "tarbiya", "Rus til (n)" all canonicalise correctly) and
classifies marks into `homework` / `classwork` / `test` / `other`. Surfaces
that need a list of subjects import `emaktabSubjects` from
`lib/curriculum/subjects.generated.ts`, which the codegen script
`scripts/sync-curriculum-subjects.ts` writes from the snapshot — so subjects
are genuinely data, not a hand-typed list.

Mark types seen: `Darsda javob` (class answer), `Uy vazifasi` (homework),
`Nazorat ishi` (test). Homework statuses: `Bajarildi` (done), `berilgan` (set).

The same snapshot is cached to Firestore so the demo never scrapes live on
stage (`CLAUDE.md` §1, `ARCHITECTURE.md` §9):

- `students/demo-student-1` — profile fields.
- `students/demo-student-1/emaktab/snapshot` — `{ grades, diary, homework }`.

---

## 5. What the last run pulled (verified 2026-05-23)

| Data | Count |
|------|-------|
| Profile | Vasliddin Shahobiddinov, 6-a, 64-sonli umumiy o'rta ta'lim maktabi, 2025/2026 |
| Grade periods | 5 (quarters 1–4 + xulosa) |
| Marks total | 843 (Q1 225 · Q2 166 · Q3 227 · Q4 225) |
| Subjects with grades | 14 |
| Diary | **199 school days · 2025-09-02 → 2026-05-25 (37.9 weeks — the full academic year)** |
| Homework | 30 items |

Year-final marks are issued for only 3 subjects — the 2025/2026 year is still in
progress (4th quarter ongoing). That is the true state of the account, not a
gap in extraction.

Run `npx tsx scripts/verify-emaktab.ts` after an extract — it checks the audit
invariants (no oversized day card, no duplicate diary days, 4-slot xulosa,
school name populated, walked back into the early autumn).

---

## 6. How to run the extractor

```bash
npx tsx --env-file=.env.local scripts/extract-emaktab.ts
```

- Reads `EMAKTAB_USERNAME` / `EMAKTAB_PASSWORD` from the environment only.
- Re-runnable and resilient: a failed page is recorded in `meta.notes` and
  skipped — it never crashes the run. A clear error is printed if credentials
  are missing or emaktab shows a captcha (too many recent attempts — retry
  later).
- Writes `data/emaktab-export.json` and caches the snapshot to Firestore.
- Uses the `playwright` npm package, headless Chromium. If the browser is
  missing: `npx playwright install chromium`.

Inspect the cached curriculum in Firestore with:

```bash
npx tsx --env-file=.env.local scripts/check-curriculum.ts
```

---

## 7. The curriculum graph

`lib/curriculum.ts` turns the extracted subjects into Scorpius's learning tree:
**grade → subject → unit → topic**, each topic with an `order` and optional
`prereqs`. It holds only what genuinely exists — the Grade-6 Mathematics and
History units whose first lessons are extracted and cached in Firestore
(`curriculum/6/{math,history}/lesson-1`), plus the 14 real Grade-6 subjects the
emaktab account exposes (units fill in as lessons are extracted). The
constellation in `lib/sky.ts` (`buildSky`) is built from this graph, not a
hardcoded list — adding a grade or subject is data, not code.
