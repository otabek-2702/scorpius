/**
 * emaktab.uz (Kundalik) Playwright extractor — server-only library.
 *
 * Logs in with a consented student account and scrapes profile, grades per
 * quarter, the weekly diary with marks + homework, and the homework list.
 * Returns a clean structured EmaktabExport.
 *
 * Two entry points:
 *   - The CLI script at scripts/extract-emaktab.ts (writes a JSON file).
 *   - The /api/emaktab/connect API route (returns the snapshot per uid).
 *
 * Re-runnable and resilient: a missing page is reported in `notes` and skipped,
 * never a crash. Credentials are passed in by the caller; this module never
 * reads process.env.
 */

import { chromium, type Browser, type Page } from "playwright";

// ---- URLs --------------------------------------------------------------------

const LOGIN_URL = "https://login.emaktab.uz/login";
const FEED_URL = "https://emaktab.uz/userfeed";
const MARKS_URL = "https://emaktab.uz/marks";
const HOMEWORK_URL = "https://schools.emaktab.uz/v2/homework";

// ---- Shapes -----------------------------------------------------------------

export interface Profile {
  name: string;
  className: string | null;
  school: string | null;
  grade: number | null;
  academicYear: string | null;
  emaktab: { schoolId: string | null; personId: string | null; groupId: string | null };
}

export interface PeriodMark {
  value: string;
  type: string | null;
  date: string | null;
  lessonNo: string | null;
}

export interface SubjectGrades {
  subject: string;
  average: string | null;
  finalMark: string | null;
  quarterMarks: (string | null)[] | null;
  marks: PeriodMark[];
}

export interface PeriodGrades {
  period: string;
  subjects: SubjectGrades[];
}

export interface DiaryMark {
  value: string;
  type: string | null;
}

export interface DiaryLesson {
  lessonNo: string | null;
  subject: string;
  time: string | null;
  homework: string | null;
  homeworkDone: boolean;
  marks: DiaryMark[];
}

export interface DiaryDay {
  date: string;
  dateKey: string;
  iso: string;
  lessons: DiaryLesson[];
}

export interface HomeworkItem {
  task: string;
  subject: string | null;
  lessonDate: string | null;
  lessonNo: string | null;
  updated: string | null;
  status: string | null;
}

export interface EmaktabExport {
  profile: Profile;
  grades: PeriodGrades[];
  diary: DiaryDay[];
  homework: HomeworkItem[];
  meta: { source: string; pulledAt: string; notes: string[] };
}

// ---- Public API options -----------------------------------------------------

/** Recognised progress stages — surfaced to the caller for UI updates. */
export type ExtractStage =
  | "starting"
  | "logging-in"
  | "profile"
  | "grades"
  | "diary"
  | "homework"
  | "finalising"
  | "done";

export interface ExtractOptions {
  /** Called once per stage with a short human-readable Uzbek message. */
  onProgress?: (stage: ExtractStage, message: string) => void;
  /** Abort the run early. The browser is closed in the finally block. */
  signal?: AbortSignal;
  /** Override the default 20s per-action Playwright timeout. */
  defaultTimeoutMs?: number;
}

// ---- Helpers ----------------------------------------------------------------

/** Strip emaktab's invisible bidi marks (U+2068 / U+2069) that wrap tooltip text. */
function clean(s: string | null | undefined): string {
  return (s ?? "").replace(/[⁦-⁩‪-‮]/g, "").replace(/\s+/g, " ").trim();
}

// ---- Browser-side scrapers --------------------------------------------------
// Passed to page.evaluate() as plain strings. esbuild (via tsx) injects a `__name`
// helper into transpiled named functions, which does not exist in the page context
// and crashes evaluate — keeping these as strings sidesteps that transform entirely.

const SCRAPE_PERIOD_TABLE = `(() => {
  const strip = (s) => (s || "").replace(/[\\u2066-\\u2069\\u202a-\\u202e]/g, "").replace(/\\s+/g, " ").trim();
  const norm = (v) => (!v || v === "-" ? null : v);
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
  if (page.url().includes("/userfeed")) return;

  const loginField = page.locator('[data-test-id="login-field"]');
  if ((await loginField.count()) === 0) {
    throw new Error(`login form not found at ${page.url()} — site layout may have changed`);
  }
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
  await page.waitForLoadState("networkidle").catch(() => {});

  if (page.url().includes("login.emaktab.uz")) {
    const err = clean(
      await page
        .locator(".login__error, [class*='error']")
        .first()
        .textContent()
        .catch(() => ""),
    );
    throw new Error(`login failed — still on the login page${err ? ` (${err})` : ""}`);
  }
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

  const ratingHref = await page
    .locator('a[href*="childPersonId="]')
    .first()
    .getAttribute("href")
    .catch(() => null);
  if (ratingHref) {
    profile.emaktab.personId = new URL(ratingHref).searchParams.get("childPersonId");
    profile.emaktab.groupId = new URL(ratingHref).searchParams.get("groupId");
  }
  const schoolHref = await page
    .locator('a[href*="marks?school="]')
    .first()
    .getAttribute("href")
    .catch(() => null);
  if (schoolHref) {
    profile.emaktab.schoolId = new URL(schoolHref).searchParams.get("school");
  }
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
    const bodyText = clean(await page.locator("body").innerText().catch(() => ""));
    const m = bodyText.match(/\d+-sonli[^\n]{0,80}?maktab(?:i|imiz)?\b/i);
    if (m) profile.school = clean(m[0]);
  }

  await page.goto(MARKS_URL, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  profile.name = clean(
    await page
      .locator("[data-test-id='selected-membership']")
      .first()
      .textContent()
      .catch(() => ""),
  );

  await page.locator('[data-test-id="tab-period"]').click().catch(() => {});
  await page.waitForLoadState("networkidle").catch(() => {});
  const yearText = clean(
    await page
      .locator("text=/20\\d\\d\\/20\\d\\d/")
      .first()
      .textContent()
      .catch(() => ""),
  );
  if (yearText) {
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

// ---- Grades -----------------------------------------------------------------

async function extractGrades(
  page: Page,
  profile: Profile,
  notes: string[],
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
      await Promise.all([
        page.waitForLoadState("networkidle").catch(() => {}),
        tab.click(),
      ]);
      await page.waitForSelector("table tbody tr", { timeout: 10000 });
      await page.waitForTimeout(500);
      const subjects = (await page.evaluate(SCRAPE_PERIOD_TABLE)) as SubjectGrades[];
      periods.push({ period: label, subjects });
    } catch (err) {
      notes.push(`period "${label}" failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  return periods;
}

// ---- Diary ------------------------------------------------------------------

async function extractDiary(page: Page, notes: string[]): Promise<DiaryDay[]> {
  const SCHOOL_START_SEC = Math.floor(new Date("2025-09-01").getTime() / 1000);
  const MAX_LESSONS_PER_DAY = 12;
  const MAX_CLICKS = 95;

  const allDays = new Map<string, DiaryDay>();

  const scrapeWindow = async (): Promise<DiaryDay[]> => {
    try {
      await page.waitForSelector("[data-test-id^='day-']", { timeout: 8000 });
      const days = (await page.evaluate(SCRAPE_DIARY_WEEK)) as DiaryDay[];
      return days.filter(
        (d) => d.date && d.dateKey && d.lessons.length > 0 && d.lessons.length <= MAX_LESSONS_PER_DAY,
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

  const VISIBLE_DAY_IDS = `Array.from(document.querySelectorAll('[data-test-id^="day-"]'))
    .map((e) => e.getAttribute('data-test-id'))
    .filter((id) => /^day-\\d+$/.test(id))
    .sort()
    .join(',')`;

  await page.goto(MARKS_URL, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  ingest(await scrapeWindow());

  const arrowExists = await page.evaluate(
    `!!document.querySelector('[data-test-id="arrow-left"]')`,
  );
  if (!arrowExists) {
    notes.push("arrow-left control missing — diary limited to the current week");
    return Array.from(allDays.values()).sort((a, b) => Number(a.dateKey) - Number(b.dateKey));
  }

  let earliestEverSec = Number.MAX_SAFE_INTEGER;
  let noProgressInRow = 0;
  const NO_PROGRESS_BUDGET = 6;

  for (let i = 0; i < MAX_CLICKS; i++) {
    const beforeIds = (await page.evaluate(VISIBLE_DAY_IDS)) as string;
    try {
      await page.evaluate(
        `document.querySelector('[data-test-id="arrow-left"]').click()`,
      );
    } catch (err) {
      notes.push(`arrow-left click failed at step ${i + 1}: ${err instanceof Error ? err.message : err}`);
      break;
    }
    const escaped = beforeIds.replace(/'/g, "\\'");
    const changed = await page
      .waitForFunction(
        `(${VISIBLE_DAY_IDS}) !== '${escaped}' && document.querySelectorAll('[data-test-id^="day-"]').length > 1`,
        { timeout: 10000 },
      )
      .then(() => true)
      .catch(() => false);
    if (!changed) break;
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(300);

    let window = await scrapeWindow();
    if (window.length === 0) {
      await page.waitForTimeout(700);
      window = await scrapeWindow();
    }
    ingest(window);
    const earliestThisStepSec = window.reduce(
      (min, d) => (Number(d.dateKey) < min ? Number(d.dateKey) : min),
      Number.MAX_SAFE_INTEGER,
    );
    if (earliestThisStepSec < earliestEverSec) {
      earliestEverSec = earliestThisStepSec;
      noProgressInRow = 0;
    } else {
      noProgressInRow++;
    }
    if (earliestEverSec <= SCHOOL_START_SEC) break;
    if (noProgressInRow >= NO_PROGRESS_BUDGET) break;
  }
  return Array.from(allDays.values()).sort((a, b) => Number(a.dateKey) - Number(b.dateKey));
}

// ---- Homework ---------------------------------------------------------------

async function extractHomework(page: Page, notes: string[]): Promise<HomeworkItem[]> {
  await page.goto(HOMEWORK_URL, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});

  const items: HomeworkItem[] = [];
  const seen = new Set<string>();
  for (let guard = 0; guard < 25; guard++) {
    try {
      await page.waitForSelector("table tbody tr, [class*='row']", { timeout: 8000 }).catch(() => {});
      const pageItems = (await page.evaluate(SCRAPE_HOMEWORK_TABLE)) as HomeworkItem[];
      for (const it of pageItems) {
        const key = `${it.task}|${it.lessonDate}|${it.subject}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push(it);
        }
      }
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

// ---- Public API -------------------------------------------------------------

/**
 * Run the full emaktab extraction with provided credentials. Returns a
 * structured EmaktabExport. Closes the browser in the finally block. Caller is
 * responsible for storing the result (CLI → file, API route → Firestore).
 *
 * Throws on auth failure (bad creds, captcha shown) so callers can surface a
 * clean error UI. Section failures are recorded in `meta.notes` rather than
 * thrown — a partial snapshot is better than nothing.
 */
export async function extractEmaktabSnapshot(
  username: string,
  password: string,
  opts: ExtractOptions = {},
): Promise<EmaktabExport> {
  const notes: string[] = [];
  let browser: Browser | null = null;

  const progress = (stage: ExtractStage, message: string) => {
    opts.onProgress?.(stage, message);
  };

  try {
    progress("starting", "Brauzer ishga tushirilmoqda");
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      locale: "uz-UZ",
      viewport: { width: 1366, height: 900 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(opts.defaultTimeoutMs ?? 20000);

    if (opts.signal?.aborted) throw new Error("aborted before login");
    progress("logging-in", "emaktab.uz ga kirilmoqda");
    await login(page, username, password);

    if (opts.signal?.aborted) throw new Error("aborted after login");
    progress("profile", "Profil ma'lumotlari olinmoqda");
    const profile = await extractProfile(page, notes);

    if (opts.signal?.aborted) throw new Error("aborted after profile");
    progress("grades", "Choraklik baholar olinmoqda");
    const grades = await extractGrades(page, profile, notes);

    if (opts.signal?.aborted) throw new Error("aborted after grades");
    progress("diary", "Kundalik (haftalik darslar) olinmoqda");
    const diary = await extractDiary(page, notes);

    if (opts.signal?.aborted) throw new Error("aborted after diary");
    progress("homework", "Uy vazifalari olinmoqda");
    const homework = await extractHomework(page, notes);

    progress("finalising", "Ma'lumotlar saqlanmoqda");
    const data: EmaktabExport = {
      profile,
      grades,
      diary,
      homework,
      meta: {
        source: "emaktab.uz (Kundalik) — Playwright, in-app connect flow",
        pulledAt: new Date().toISOString(),
        notes,
      },
    };
    progress("done", "Tayyor");
    return data;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
