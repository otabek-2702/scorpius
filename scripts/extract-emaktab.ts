import { writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { chromium, type Browser, type Page } from "playwright";
import { adminDb } from "../lib/firebase/admin";

/**
 * emaktab.uz (Kundalik) data extractor — the emaktab Sync agent (ARCHITECTURE.md §9).
 *
 * Logs in with one consented student account, scrapes every available piece of data
 * (profile, grades per quarter, the weekly diary with marks + homework, the homework
 * list), and writes a clean structured JSON to data/emaktab-export.json. The same
 * snapshot is cached to Firestore at students/{STUDENT_ID}/emaktab/snapshot so the
 * hackathon demo runs on cached data — never live scraping on stage (CLAUDE.md §1).
 *
 * Re-runnable and resilient: a missing page is reported and skipped, never a crash.
 * Credentials are read from process.env only — never logged, never committed.
 *
 *   npx tsx --env-file=.env.local scripts/extract-emaktab.ts
 */

const STUDENT_ID = "demo-student-1";
const EXPORT_PATH = "data/emaktab-export.json";

const LOGIN_URL = "https://login.emaktab.uz/login";
const FEED_URL = "https://emaktab.uz/userfeed";
const MARKS_URL = "https://emaktab.uz/marks";
const HOMEWORK_URL = "https://schools.emaktab.uz/v2/homework";

// ---- Shapes -----------------------------------------------------------------

interface Profile {
  name: string;
  className: string | null;
  school: string | null;
  grade: number | null;
  academicYear: string | null;
  emaktab: { schoolId: string | null; personId: string | null; groupId: string | null };
}

/** One mark in the quarter grade table — date and type come from the cell tooltip. */
interface PeriodMark {
  value: string;
  type: string | null;
  date: string | null;
  lessonNo: string | null;
}

/** A subject's grades for one period (quarter or the yearly summary).
 *  `quarterMarks` is filled only on the summary ("xulosa") view: [Q1, Q2, Q3, Q4]. */
interface SubjectGrades {
  subject: string;
  average: string | null;
  finalMark: string | null;
  quarterMarks: (string | null)[] | null;
  marks: PeriodMark[];
}

interface PeriodGrades {
  period: string; // "1", "2", "3", "4", "xulosa"
  subjects: SubjectGrades[];
}

/** A mark earned in a lesson — value plus its type ("Darsda javob", "Uy vazifasi"...). */
interface DiaryMark {
  value: string;
  type: string | null;
}

/** One lesson row in the daily diary. */
interface DiaryLesson {
  lessonNo: string | null;
  subject: string;
  time: string | null;
  homework: string | null;
  homeworkDone: boolean;
  marks: DiaryMark[];
}

interface DiaryDay {
  /** Display heading text, e.g. "JUM, 22 may" — Uzbek, day-of-week + date. */
  date: string;
  /** Unix epoch (seconds) from the day card's `data-test-id="day-{ts}"`. The
   *  authoritative dedup key — display text repeats across years. */
  dateKey: string;
  /** ISO date "YYYY-MM-DD" derived from dateKey. Stable for sorting/grouping. */
  iso: string;
  lessons: DiaryLesson[];
}

interface HomeworkItem {
  task: string;
  subject: string | null;
  lessonDate: string | null;
  lessonNo: string | null;
  updated: string | null;
  status: string | null;
}

interface EmaktabExport {
  profile: Profile;
  grades: PeriodGrades[];
  diary: DiaryDay[];
  homework: HomeworkItem[];
  meta: {
    source: string;
    pulledAt: string;
    notes: string[];
  };
}

// ---- Helpers ----------------------------------------------------------------

function log(msg: string) {
  console.log(`[extract-emaktab] ${msg}`);
}

/** Strip emaktab's invisible bidi marks (U+2068 / U+2069) that wrap tooltip text. */
function clean(s: string | null | undefined): string {
  return (s ?? "").replace(/[⁦-⁩‪-‮]/g, "").replace(/\s+/g, " ").trim();
}

// ---- Browser-side scrapers --------------------------------------------------
// Passed to page.evaluate() as plain strings. esbuild (via tsx) injects a `__name`
// helper into transpiled named functions, which does not exist in the page context
// and crashes evaluate — keeping these as strings sidesteps that transform entirely.

/** Reads a grade table on the period page. Two layouts share one scraper:
 *  - a quarter (1-4): subject-name | marks_container | average_* | periodFinalMark_*
 *  - the summary ("xulosa"): subject-name | per-quarter final-mark_* | final-year_*.
 *  In the summary there are no individual marks; quarterMarks + finalMark are filled. */
const SCRAPE_PERIOD_TABLE = `(() => {
  const strip = (s) => (s || "").replace(/[\\u2066-\\u2069\\u202a-\\u202e]/g, "").replace(/\\s+/g, " ").trim();
  const norm = (v) => (!v || v === "-" ? null : v);
  // A summary cell reads "Baho 1 chorak uchun5" — keep only the trailing mark.
  const markOnly = (s) => { const v = strip(s); const m = v.match(/([0-9]+(?:[.,][0-9]+)?|[A-Z]{1,3})$/); return m ? m[1] : norm(v); };
  const rows = Array.from(document.querySelectorAll("table tbody tr"));
  return rows.map((row) => {
    const subjEl = row.querySelector("[data-test-id^='subject-name']");
    const avgEl = row.querySelector("[data-test-id^='average']");
    const periodFinalEl = row.querySelector("[data-test-id^='periodFinalMark']");
    const yearFinalEl = row.querySelector("[data-test-id^='final-year']");
    const quarterEls = Array.from(row.querySelectorAll("[data-test-id^='final-mark_period']"));
    const markCell = row.querySelector("[data-test-id^='marks_container']");
    const marks = markCell
      ? Array.from(markCell.querySelectorAll("[data-test-id^='work_mark']")).map((m) => {
          const tipEl = m.parentElement ? m.parentElement.querySelector(".tvlOr, div") : null;
          const tip = strip(tipEl && tipEl !== m ? tipEl.textContent : "");
          const parts = tip.split(",").map((p) => p.trim());
          return { value: strip(m.textContent), type: parts[0] || null, date: parts[1] || null, lessonNo: parts[2] || null };
        })
      : [];
    // Slot each xulosa quarter-mark cell into its quarter index when its
    // data-test-id ends in a digit (e.g. "final-mark_period1"). Pad missing
    // quarters with null so callers always see a 4-element [Q1,Q2,Q3,Q4]
    // array and "OZ in Q3" never gets mis-read as "OZ in Q1".
    let quarterMarks = null;
    if (quarterEls.length) {
      const slots = [null, null, null, null];
      let placedAny = false;
      for (const el of quarterEls) {
        const id = el.getAttribute("data-test-id") || "";
        const m = id.match(/(\\d)(?!.*\\d)/);
        if (m) {
          const idx = Number(m[1]) - 1;
          if (idx >= 0 && idx < 4) { slots[idx] = markOnly(el.textContent); placedAny = true; }
        }
      }
      if (!placedAny) {
        for (let i = 0; i < Math.min(4, quarterEls.length); i++) slots[i] = markOnly(quarterEls[i].textContent);
      }
      quarterMarks = slots;
    }
    return {
      subject: strip(subjEl ? subjEl.textContent : ""),
      average: norm(strip(avgEl ? avgEl.textContent : "")),
      finalMark: norm(strip(periodFinalEl ? periodFinalEl.textContent : "")) ||
                 (yearFinalEl ? markOnly(yearFinalEl.textContent) : null),
      quarterMarks,
      marks,
    };
  }).filter((s) => s.subject);
})()`;

/** Reads the visible daily diary: each day's lessons with time, marks, homework.
 *  A mark element ('work-marks-*') carries its type in a '.tvlOr' tooltip child;
 *  the mark value is the element text with the tooltip text removed.
 *  Day cards: strict `day-N` match. emaktab also exposes wrapper containers
 *  (e.g. `day-card-list`, `day-content`) whose data-test-id starts with `day-`
 *  but isn't a numeric day — those would flatten a whole week into one "day"
 *  with dozens of lessons. The `^day-\\d+$` regex rejects them. */
const SCRAPE_DIARY_WEEK = `(() => {
  const strip = (s) => (s || "").replace(/[\\u2066-\\u2069\\u202a-\\u202e]/g, "").replace(/\\s+/g, " ").trim();
  const days = Array.from(document.querySelectorAll("[data-test-id^='day-']"))
    .filter((d) => /^day-\\d+$/.test(d.getAttribute("data-test-id") || ""));
  return days.map((day) => {
    const dateEl = day.querySelector("[data-test-id^='card-date-']") || day.querySelector("[class*='date']");
    const lessons = Array.from(day.querySelectorAll("[data-test-id^='lesson-']"))
      .filter((l) => /^lesson-\\d+$/.test(l.getAttribute("data-test-id") || ""))
      .map((l) => {
        const id = l.getAttribute("data-test-id");
        const numEl = l.querySelector("[data-test-id='" + id + "-number']");
        const subjEl = l.querySelector("[data-test-id^='subject-name']");
        const timeEl = l.querySelector("[data-test-id='" + id + "-timeAndPlace']");
        const hwEl = l.querySelector("[data-test-id='" + id + "-homework-text']");
        const hwDone = !!l.querySelector("[data-test-id='" + id + "-homework-completed']");
        const marks = Array.from(l.querySelectorAll("[data-test-id^='work-marks-']")).map((m) => {
          const tip = m.querySelector(".tvlOr");
          const type = strip(tip ? tip.textContent : "") || null;
          let value = strip(m.textContent);
          if (type && value.startsWith(type)) value = value.slice(type.length).trim();
          return { value, type };
        }).filter((m) => m.value);
        return {
          lessonNo: numEl ? strip(numEl.textContent).replace(/\\.$/, "") : null,
          subject: strip(subjEl ? subjEl.textContent : ""),
          time: timeEl ? strip(timeEl.textContent) : null,
          homework: hwEl ? strip(hwEl.textContent) : null,
          homeworkDone: hwDone,
          marks,
        };
      })
      .filter((les) => les.subject);
    const dayId = day.getAttribute("data-test-id") || "";
    const tsMatch = dayId.match(/^day-(\\d+)$/);
    const dateKey = tsMatch ? tsMatch[1] : "";
    const iso = tsMatch ? new Date(Number(tsMatch[1]) * 1000).toISOString().slice(0, 10) : "";
    return { date: strip(dateEl ? dateEl.textContent : ""), dateKey, iso, lessons };
  });
})()`;

/** Reads one page of the homework list table. */
const SCRAPE_HOMEWORK_TABLE = `(() => {
  const strip = (s) => (s || "").replace(/[\\u2066-\\u2069\\u202a-\\u202e]/g, "").replace(/\\s+/g, " ").trim();
  const rows = Array.from(document.querySelectorAll("table tbody tr"));
  return rows.map((row) => {
    const c = Array.from(row.querySelectorAll("td")).map((td) => strip(td.textContent));
    if (c.length < 4) return null;
    const lessonRaw = c[3] || "";
    const dateMatch = lessonRaw.match(/\\d{1,2}\\s+\\S+\\s+20\\d\\d/);
    const noMatch = lessonRaw.match(/(\\d+)\\s*dars/);
    return {
      task: c[0],
      subject: c[2] || null,
      lessonDate: dateMatch ? dateMatch[0] : null,
      lessonNo: noMatch ? noMatch[1] : null,
      updated: c[4] || null,
      status: c[5] || c[c.length - 1] || null,
    };
  }).filter((x) => x !== null && !!x.task);
})()`;

// ---- Login ------------------------------------------------------------------

async function login(page: Page, username: string, password: string): Promise<void> {
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });

  // If a session cookie was reused the login page redirects straight to the feed.
  if (page.url().includes("/userfeed")) {
    log("already authenticated — skipping login form");
    return;
  }

  const loginField = page.locator('[data-test-id="login-field"]');
  if ((await loginField.count()) === 0) {
    throw new Error(`login form not found at ${page.url()} — site layout may have changed`);
  }

  // A captcha only appears after failed attempts; bail out clearly if one is shown.
  const captcha = page.locator('input[name="Captcha.Input"]');
  if ((await captcha.count()) > 0 && (await captcha.first().isVisible())) {
    throw new Error("emaktab is showing a captcha — too many recent attempts; retry later");
  }

  await loginField.fill(username);
  await page.locator('[data-test-id="password-field"]').fill(password);
  await Promise.all([
    page.waitForLoadState("domcontentloaded"),
    page.locator('[data-test-id="login-button"]').click(),
  ]);

  // Give any post-login redirect a moment to settle.
  await page.waitForLoadState("networkidle").catch(() => {});

  if (page.url().includes("login.emaktab.uz")) {
    const err = clean(
      await page
        .locator(".login__error, [class*='error']")
        .first()
        .textContent()
        .catch(() => "")
    );
    throw new Error(`login failed — still on the login page${err ? ` (${err})` : ""}`);
  }
  log("logged in");
}

// ---- Profile ----------------------------------------------------------------

async function extractProfile(page: Page, notes: string[]): Promise<Profile> {
  await page.goto(FEED_URL, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});

  const profile: Profile = {
    name: "",
    className: null,
    school: null,
    grade: null,
    academicYear: null,
    emaktab: { schoolId: null, personId: null, groupId: null },
  };

  // The feed exposes a "Reyting" link carrying childPersonId + groupId.
  const ratingHref = await page
    .locator('a[href*="childPersonId="]')
    .first()
    .getAttribute("href")
    .catch(() => null);
  if (ratingHref) {
    profile.emaktab.personId = new URL(ratingHref).searchParams.get("childPersonId");
    profile.emaktab.groupId = new URL(ratingHref).searchParams.get("groupId");
  }
  // The "period marks" link carries the schoolId.
  const schoolHref = await page
    .locator('a[href*="marks?school="]')
    .first()
    .getAttribute("href")
    .catch(() => null);
  if (schoolHref) {
    profile.emaktab.schoolId = new URL(schoolHref).searchParams.get("school");
  }
  // School name on the feed — try a few selectors, then a body-text regex as
  // last resort (Uzbek schools format as "<N>-sonli ... maktab"). Stays null
  // when nothing matches; downstream treats school as decorative.
  for (const sel of [
    '[data-test-id*="schoolName"]',
    '[data-test-id*="school-name"]',
    'a[href*="/school/"]',
    '[class*="schoolName"]',
  ]) {
    const text = clean(await page.locator(sel).first().textContent().catch(() => ""));
    if (text && text.length > 2 && /maktab|школа|school/i.test(text)) {
      profile.school = text;
      break;
    }
  }
  if (!profile.school) {
    // Stop at "maktab" (+ optional Uzbek possessive suffix) so we don't pull
    // in adjacent UI text like a "yesterday 5 English" notification badge.
    const bodyText = clean(await page.locator("body").innerText().catch(() => ""));
    const m = bodyText.match(/\d+-sonli[^\n]{0,80}?maktab(?:i|imiz)?\b/i);
    if (m) profile.school = clean(m[0]);
  }

  // The marks page header carries the full name, class and academic year.
  await page.goto(MARKS_URL, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});

  // The marks page tags the student name on the membership selector.
  profile.name = clean(
    await page
      .locator("[data-test-id='selected-membership']")
      .first()
      .textContent()
      .catch(() => "")
  );

  // Switch to the period view — its year selector states the academic year + class.
  await page.locator('[data-test-id="tab-period"]').click().catch(() => {});
  await page.waitForLoadState("networkidle").catch(() => {});
  const yearText = clean(
    await page
      .locator("text=/20\\d\\d\\/20\\d\\d/")
      .first()
      .textContent()
      .catch(() => "")
  );
  if (yearText) {
    // e.g. "2025/2026 (6-a)"
    const m = yearText.match(/(20\d\d\/20\d\d)\s*\(([^)]+)\)/);
    if (m) {
      profile.academicYear = m[1];
      profile.className = m[2];
      const gradeNum = m[2].match(/^(\d+)/);
      if (gradeNum) profile.grade = Number(gradeNum[1]);
    } else {
      profile.academicYear = yearText;
    }
  }

  if (!profile.name) notes.push("profile name not found on the marks page");
  return profile;
}

// ---- Grades (period table) --------------------------------------------------

async function extractGrades(
  page: Page,
  profile: Profile,
  notes: string[]
): Promise<PeriodGrades[]> {
  const periods: PeriodGrades[] = [];
  const { schoolId, personId } = profile.emaktab;
  if (!schoolId || !personId) {
    notes.push("schoolId/personId unknown — cannot open the quarter grade table");
    return periods;
  }

  const periodUrl = `${MARKS_URL}/school/${schoolId}/student/${personId}/period`;
  await page.goto(periodUrl, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForSelector("[data-test-id='selected-period']", { timeout: 12000 }).catch(() => {});

  const periodCount = await page.locator('[data-test-id="selected-period"] > div').count();
  if (periodCount === 0) {
    notes.push("period grade selector not found — no quarter grades extracted");
    return periods;
  }

  for (let i = 0; i < periodCount; i++) {
    const tab = page.locator('[data-test-id="selected-period"] > div').nth(i);
    const label = clean(await tab.textContent().catch(() => `${i + 1}`)) || `${i + 1}`;
    try {
      // Clicking a period reloads the table via a ?periodId= navigation.
      await Promise.all([
        page.waitForLoadState("networkidle").catch(() => {}),
        tab.click(),
      ]);
      await page.waitForSelector("table tbody tr", { timeout: 10000 });
      await page.waitForTimeout(500);

      const subjects = (await page.evaluate(SCRAPE_PERIOD_TABLE)) as SubjectGrades[];
      periods.push({ period: label, subjects });
      const markTotal = subjects.reduce((n, s) => n + s.marks.length, 0);
      log(`grades · period "${label}": ${subjects.length} subjects, ${markTotal} marks`);
    } catch (err) {
      notes.push(`period "${label}" failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  return periods;
}

// ---- Diary (current tab — daily timetable + marks + homework) ---------------

/**
 * Reads the diary back to the start of the academic year. emaktab's `/marks`
 * page shows one week at a time; navigation is via two arrow controls that sit
 * as siblings of the day-cards container with `data-test-id="arrow-left"` and
 * `data-test-id="arrow-right"`. Each click swaps the day-cards out for the next
 * earlier week via XHR; the day cards themselves carry `data-test-id="day-{ts}"`
 * where `{ts}` is a unix epoch in seconds — the authoritative dedup key.
 *
 * Loop strategy: click arrow-left, wait for the rendered timestamp set to
 * change, scrape, ingest. Stop when the earliest visible day is on or before
 * 2025-09-01 (academic year start), or when three clicks in a row add no new
 * days (emaktab has reached the boundary of stored data).
 */
async function extractDiary(page: Page, notes: string[]): Promise<DiaryDay[]> {
  const SCHOOL_START_SEC = Math.floor(new Date("2025-09-01").getTime() / 1000);
  const MAX_LESSONS_PER_DAY = 12;
  const MAX_CLICKS = 95; // emaktab shifts ~2-3 school days per click → 95 clicks covers a full 9-month academic year

  const allDays = new Map<string, DiaryDay>();

  const scrapeWindow = async (): Promise<DiaryDay[]> => {
    try {
      await page.waitForSelector("[data-test-id^='day-']", { timeout: 8000 });
      const days = (await page.evaluate(SCRAPE_DIARY_WEEK)) as DiaryDay[];
      return days.filter(
        (d) => d.date && d.dateKey && d.lessons.length > 0 && d.lessons.length <= MAX_LESSONS_PER_DAY
      );
    } catch {
      return [];
    }
  };

  const ingest = (days: DiaryDay[]): number => {
    let added = 0;
    for (const d of days) {
      const prev = allDays.get(d.dateKey);
      if (!prev) {
        allDays.set(d.dateKey, d);
        added++;
      } else if (d.lessons.length < prev.lessons.length) {
        allDays.set(d.dateKey, d);
      }
    }
    return added;
  };

  /** Read the currently rendered set of `day-{ts}` IDs — the wait-signal. */
  const VISIBLE_DAY_IDS = `Array.from(document.querySelectorAll('[data-test-id^="day-"]'))
    .map((e) => e.getAttribute('data-test-id'))
    .filter((id) => /^day-\\d+$/.test(id))
    .sort()
    .join(',')`;

  // ---- Initial window ----
  await page.goto(MARKS_URL, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  ingest(await scrapeWindow());
  log(`diary: initial window → ${allDays.size} days`);

  // Probe for the navigator. We click via JS because the control is a styled
  // <div> with an SVG inside; Playwright's .click() can be intercepted by ad
  // banners on the page, while a programmatic .click() on the element triggers
  // emaktab's handler directly.
  const arrowExists = await page.evaluate(
    `!!document.querySelector('[data-test-id="arrow-left"]')`
  );
  if (!arrowExists) {
    notes.push("arrow-left control missing — diary limited to the current week");
    log(`diary: no arrow control found — captured ${allDays.size} days`);
    return Array.from(allDays.values()).sort((a, b) => Number(a.dateKey) - Number(b.dateKey));
  }

  // ---- Walk back, week by week ----
  // Boundary signal: the *earliest visible* dateKey stops decreasing across
  // several consecutive clicks. Emaktab often shows overlapping windows
  // (clicks that show dates we already have), so "added == 0" alone is not a
  // boundary — it just means the new window is a repeat. The real boundary is
  // "we keep clicking and the floor never moves back".
  let stepsTried = 0;
  let stepsWithNew = 0;
  let earliestEverSec = Number.MAX_SAFE_INTEGER;
  let noProgressInRow = 0;
  const NO_PROGRESS_BUDGET = 6;

  for (let i = 0; i < MAX_CLICKS; i++) {
    stepsTried++;
    const beforeIds = (await page.evaluate(VISIBLE_DAY_IDS)) as string;
    try {
      await page.evaluate(
        `document.querySelector('[data-test-id="arrow-left"]').click()`
      );
    } catch (err) {
      notes.push(`arrow-left click failed at step ${i + 1}: ${err instanceof Error ? err.message : err}`);
      break;
    }
    // Wait for the day-IDs to swap AND for at least one day card to be rendered
    // (avoids scraping in the brief empty-state between weeks).
    const escaped = beforeIds.replace(/'/g, "\\'");
    const changed = await page
      .waitForFunction(
        `(${VISIBLE_DAY_IDS}) !== '${escaped}' && document.querySelectorAll('[data-test-id^="day-"]').length > 1`,
        { timeout: 10000 }
      )
      .then(() => true)
      .catch(() => false);
    if (!changed) {
      log(`diary: step ${i + 1} produced no DOM change — boundary`);
      break;
    }
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(300);

    // Retry the scrape if we caught a transition with no days yet.
    let window = await scrapeWindow();
    if (window.length === 0) {
      await page.waitForTimeout(700);
      window = await scrapeWindow();
    }
    const added = ingest(window);
    if (added > 0) stepsWithNew++;
    const earliestThisStepSec = window.reduce(
      (min, d) => (Number(d.dateKey) < min ? Number(d.dateKey) : min),
      Number.MAX_SAFE_INTEGER
    );
    const movedBack = earliestThisStepSec < earliestEverSec;
    if (movedBack) {
      earliestEverSec = earliestThisStepSec;
      noProgressInRow = 0;
    } else {
      noProgressInRow++;
    }
    const earliestIso =
      earliestThisStepSec === Number.MAX_SAFE_INTEGER
        ? "(empty)"
        : new Date(earliestThisStepSec * 1000).toISOString().slice(0, 10);
    log(
      `diary: step ${i + 1} → +${added} new (total ${allDays.size}, this-window earliest ${earliestIso}` +
        (movedBack ? ", floor moved back" : `, stalled ${noProgressInRow}/${NO_PROGRESS_BUDGET}`) +
        ")"
    );

    if (earliestEverSec <= SCHOOL_START_SEC) {
      log(`diary: reached school-year start (${new Date(SCHOOL_START_SEC * 1000).toISOString().slice(0, 10)}) at step ${i + 1}`);
      break;
    }
    if (noProgressInRow >= NO_PROGRESS_BUDGET) {
      log(`diary: ${noProgressInRow} steps without moving the date floor — assuming emaktab history boundary at ${new Date(earliestEverSec * 1000).toISOString().slice(0, 10)}`);
      break;
    }
  }

  const result = Array.from(allDays.values()).sort(
    (a, b) => Number(a.dateKey) - Number(b.dateKey)
  );
  log(
    `diary: walk complete — ${stepsTried} clicks, ${stepsWithNew} added new days, ${result.length} unique days total`
  );
  return result;
}

// ---- Homework list ----------------------------------------------------------

async function extractHomework(page: Page, notes: string[]): Promise<HomeworkItem[]> {
  await page.goto(HOMEWORK_URL, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});

  const items: HomeworkItem[] = [];
  const seen = new Set<string>();

  // The list is paginated; walk every page link at the bottom.
  for (let guard = 0; guard < 25; guard++) {
    try {
      await page.waitForSelector("table tbody tr, [class*='row']", { timeout: 8000 }).catch(() => {});
      const pageItems = (await page.evaluate(SCRAPE_HOMEWORK_TABLE)) as HomeworkItem[];

      let added = 0;
      for (const it of pageItems) {
        const key = `${it.task}|${it.lessonDate}|${it.subject}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push(it);
          added++;
        }
      }
      log(`homework · page ${guard + 1}: ${added} new items`);

      // Find the next page number link.
      const nextNum = String(guard + 2);
      const nextLink = page.locator(`a, [class*='page']`).filter({ hasText: new RegExp(`^${nextNum}$`) });
      if ((await nextLink.count()) === 0) break;
      await nextLink.first().click();
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(500);
    } catch (err) {
      notes.push(`homework page ${guard + 1} failed: ${err instanceof Error ? err.message : err}`);
      break;
    }
  }
  return items;
}

// ---- Cache to Firestore -----------------------------------------------------

async function cacheToFirestore(data: EmaktabExport): Promise<void> {
  const p = data.profile;
  await adminDb.doc(`students/${STUDENT_ID}`).set(
    {
      name: p.name,
      className: p.className,
      school: p.school,
      grade: p.grade,
      academicYear: p.academicYear,
      emaktab: p.emaktab,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  await adminDb.doc(`students/${STUDENT_ID}/emaktab/snapshot`).set({
    grades: data.grades,
    diary: data.diary,
    homework: data.homework,
    source: data.meta.source,
    pulledAt: data.meta.pulledAt,
  });
  log(`cached to Firestore: students/${STUDENT_ID} + /emaktab/snapshot`);
}

// ---- Main -------------------------------------------------------------------

async function main() {
  const username = process.env.EMAKTAB_USERNAME;
  const password = process.env.EMAKTAB_PASSWORD;
  if (!username || !password) {
    throw new Error("EMAKTAB_USERNAME / EMAKTAB_PASSWORD missing — set them in .env.local");
  }

  const notes: string[] = [];
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      locale: "uz-UZ",
      viewport: { width: 1366, height: 900 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);

    await login(page, username, password);

    const profile = await extractProfile(page, notes);
    log(`profile: ${profile.name || "(name missing)"} · ${profile.className ?? "?"} · ${profile.academicYear ?? "?"}`);

    const grades = await extractGrades(page, profile, notes);
    const diary = await extractDiary(page, notes);
    const homework = await extractHomework(page, notes);

    const data: EmaktabExport = {
      profile,
      grades,
      diary,
      homework,
      meta: {
        source: "emaktab.uz (Kundalik) — consented account, Playwright",
        pulledAt: new Date().toISOString(),
        notes,
      },
    };

    mkdirSync(dirname(EXPORT_PATH), { recursive: true });
    writeFileSync(EXPORT_PATH, JSON.stringify(data, null, 2), "utf8");
    log(`wrote ${EXPORT_PATH}`);

    try {
      await cacheToFirestore(data);
    } catch (err) {
      notes.push(`Firestore cache failed: ${err instanceof Error ? err.message : err}`);
      log(`WARNING — Firestore cache failed: ${err instanceof Error ? err.message : err}`);
    }

    const markTotal = grades.reduce(
      (n, p) => n + p.subjects.reduce((m, s) => m + s.marks.length, 0),
      0
    );
    log("---- summary ----");
    log(`profile:  ${profile.name} (${profile.className}, ${profile.academicYear})`);
    log(`grades:   ${grades.length} periods, ${markTotal} marks total`);
    log(`diary:    ${diary.length} days`);
    log(`homework: ${homework.length} items`);
    if (notes.length) {
      log(`notes (${notes.length}):`);
      for (const n of notes) log(`  - ${n}`);
    }
  } finally {
    if (browser) await browser.close();
  }
}

main().catch((err) => {
  console.error(`[extract-emaktab] FATAL: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
