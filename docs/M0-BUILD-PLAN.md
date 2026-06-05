# M0 — Skeleton Implementation Plan

> **PROGRESS — 2026-05-22.** **M0 COMPLETE (A–F).** App scaffolded; Firebase + OpenAI live;
> deployed to Vercel (https://scorpius-mu.vercel.app); emaktab Grade-6 student seeded; 2
> Grade-6 lessons (math + history) extracted to Firestore. LLM access went Gemini →
> OpenRouter → **OpenAI** (`gpt-5-mini` for the app, `gpt-5.1` for extraction) — Google API
> billing is unavailable in Uzbekistan; the swappable model adapter absorbed the change with
> no rework. **NEXT: M1** — build the UI from `docs/UX-DESIGN.md`.
> *(Follow-up: add `OPENAI_API_KEY` to Vercel so live `/api/health` is green.)*

> **For agentic workers:** Use `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Scorpius web-app skeleton — a deployed Next.js + Firebase app, a working
Gemini adapter, one emaktab account cached in Firestore, and the curriculum-extraction pipeline
proven on sample lessons.

**Architecture:** One Next.js App Router app is the single web surface. Firebase provides
Firestore (data) and Auth. All LLM access goes through a model adapter (`lib/ai/`) so Gemini is
swappable. Two Node scripts run server-side with the Firebase Admin SDK: one ingests emaktab
data via Playwright, one extracts curriculum from textbook PDFs via Gemini vision.

**Tech Stack:** Next.js 15 (App Router, TypeScript), Tailwind CSS, Firebase + firebase-admin,
`@google/genai` (Gemini 2.5), Playwright, pdf-to-img, tsx.

**Hackathon mode:** verification is by *running the thing* (dev server, health endpoint,
Firestore console) — not exhaustive unit tests (CLAUDE.md §3). Commit after every task.

---

## Prerequisites — inputs needed from Boss

These block specific task groups. A–D can start with items 1–3; E needs 4; F needs 5.

| # | Input | Goes into | Blocks |
|---|-------|-----------|--------|
| 1 | Firebase **web config** (apiKey, authDomain, projectId, …) | `.env.local` | B, C, D |
| 2 | Firebase **service account** JSON (projectId, clientEmail, privateKey) | `.env.local` | B, E, F |
| 3 | **Gemini API key** (aistudio.google.com) | `.env.local` | C, F |
| 4 | **emaktab** consented login (school-64 / `vshahobiddinov`) | `.env.local` | E |
| 5 | **2 textbook PDFs** — Grade-9 Math + Grade-9 History | `data/curriculum/` | F |

Secrets go in `.env.local` only — never in chat, never committed (CLAUDE.md §4).

## File Structure

```
D:\GDG\
  app/
    layout.tsx                  # (from scaffold)
    page.tsx                    # placeholder landing
    api/health/route.ts         # health check — proves Gemini is wired
  lib/
    firebase/
      client.ts                 # Firebase web SDK init (browser + RSC)
      admin.ts                  # Firebase Admin SDK init (scripts only)
    ai/
      model.ts                  # LanguageModel interface
      gemini.ts                 # GeminiModel implementation
      index.ts                  # the configured, exported model
  scripts/
    ingest-emaktab.ts           # Playwright → normalized data → Firestore
    extract-curriculum.ts       # PDF → images → Gemini vision → Firestore
  data/curriculum/              # input PDFs + extracted JSON (gitignored)
  .env.local                    # secrets (gitignored)
  .env.local.example            # template (committed)
```

---

## Task Group A — Project scaffold & git

### Task A1: Scaffold the Next.js app

**Files:** creates the whole Next.js project in `D:\GDG` (alongside the existing `docs/`,
`CLAUDE.md`, `README.md`).

- [ ] **Step 1: Move our README aside so create-next-app doesn't collide**

```powershell
Rename-Item -Path "D:\GDG\README.md" -NewName "README.scorpius.md"
```

- [ ] **Step 2: Scaffold (non-interactive — all flags supplied)**

```powershell
npx create-next-app@latest D:\GDG --ts --app --tailwind --eslint --no-src-dir --import-alias "@/*" --use-npm
```

Expected: dependencies install; create-next-app also runs `git init` and makes a first commit.
`CLAUDE.md`, `docs/`, `README.scorpius.md` do not conflict (create-next-app only checks files it
creates).

- [ ] **Step 3: Restore our README over the generated one**

```powershell
Remove-Item "D:\GDG\README.md"
Rename-Item -Path "D:\GDG\README.scorpius.md" -NewName "README.md"
```

- [ ] **Step 4: Verify the dev server runs**

Run: `npm run dev`
Expected: server on `http://localhost:3000`; the default Next.js page renders. Stop with Ctrl+C.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "chore: scaffold Next.js app, keep project README"
```

### Task A2: Lock down secrets & env template

**Files:** Modify `.gitignore`; Create `.env.local.example`.

- [ ] **Step 1: Append Scorpius ignores to `.gitignore`**

Add at the end of `.gitignore` (create-next-app already ignores `.env*` and `node_modules`):

```
# Scorpius
/data
*.serviceaccount.json
```

- [ ] **Step 2: Create `.env.local.example` (committed template)**

```
# --- Firebase web app (Console > Project settings > Your apps) ---
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# --- Firebase Admin (service account JSON key) ---
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# --- Gemini (aistudio.google.com) ---
GEMINI_API_KEY=

# --- emaktab consented demo account (NEVER commit real values) ---
EMAKTAB_USERNAME=
EMAKTAB_PASSWORD=
```

- [ ] **Step 3: Create `.env.local`** — copy `.env.local.example` to `.env.local` and fill in
prerequisites 1–3 (4–5 later). Confirm `git status` does **not** list `.env.local`.

- [ ] **Step 4: Commit**

```powershell
git add .gitignore .env.local.example
git commit -m "chore: add env template and secret ignores"
```

---

## Task Group B — Firebase wiring

### Task B1: Create the Firestore database

**Files:** none (Firebase Console).

- [ ] **Step 1:** In the Firebase Console for the project, create a **Firestore database** in
production mode, region `eur3` (or nearest).
- [ ] **Step 2:** For the hackathon, set Firestore rules to allow access while developing:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if true; }
  }
}
```

> ⚠️ Open rules are for the hackathon build only. Tighten before any public exposure (tracked
> for M5).

### Task B2: Firebase SDK init modules

**Files:** Create `lib/firebase/client.ts`, `lib/firebase/admin.ts`.

- [ ] **Step 1: Install SDKs**

```powershell
npm install firebase firebase-admin
```

- [ ] **Step 2: Create `lib/firebase/client.ts`**

```ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
```

- [ ] **Step 3: Create `lib/firebase/admin.ts`** (used only by `scripts/`)

```ts
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });

export const adminDb = getFirestore(app);
```

- [ ] **Step 4: Commit**

```powershell
git add lib/firebase package.json package-lock.json
git commit -m "feat: add Firebase client and admin SDK init"
```

---

## Task Group C — Gemini model adapter

### Task C1: Build the model adapter and prove Gemini works

**Files:** Create `lib/ai/model.ts`, `lib/ai/gemini.ts`, `lib/ai/index.ts`,
`app/api/health/route.ts`.

- [ ] **Step 1: Install the Gemini SDK**

```powershell
npm install @google/genai
```

- [ ] **Step 2: Create `lib/ai/model.ts` — the swappable interface**

```ts
/** The language engine behind every Scorpius agent. Gemini today, swappable tomorrow. */
export interface LanguageModel {
  /** Single prompt in, plain text out. */
  ask(prompt: string): Promise<string>;
}
```

- [ ] **Step 3: Create `lib/ai/gemini.ts`**

> If `@google/genai` has changed since this plan was written, confirm the call shape via
> Context7 (`resolve-library-id` → `googleapis/js-genai`) before editing.

```ts
import { GoogleGenAI } from "@google/genai";
import type { LanguageModel } from "./model";

export class GeminiModel implements LanguageModel {
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async ask(prompt: string): Promise<string> {
    const res = await this.client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return res.text ?? "";
  }
}
```

- [ ] **Step 4: Create `lib/ai/index.ts`**

```ts
import { GeminiModel } from "./gemini";
import type { LanguageModel } from "./model";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is missing — set it in .env.local");
}

export const model: LanguageModel = new GeminiModel(process.env.GEMINI_API_KEY);
```

- [ ] **Step 5: Create `app/api/health/route.ts`**

```ts
import { NextResponse } from "next/server";
import { model } from "@/lib/ai";

export async function GET() {
  try {
    const reply = await model.ask("Reply with exactly the word: OK");
    return NextResponse.json({ ok: true, gemini: reply.trim() });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 6: Verify**

Run `npm run dev`, then open `http://localhost:3000/api/health`.
Expected: `{"ok":true,"gemini":"OK"}`. If `ok:false`, read `error` — usually a bad/missing
`GEMINI_API_KEY`.

- [ ] **Step 7: Commit**

```powershell
git add lib/ai app/api package.json package-lock.json
git commit -m "feat: add Gemini model adapter behind a swappable interface"
```

---

## Task Group D — Deploy

### Task D1: Deploy to a live URL

**Files:** none (Vercel CLI).

**Decision:** deploy the web app to **Vercel** for M0 — it is the zero-friction path to a live
Next.js URL tonight. Firestore, Auth, Gemini and Google Cloud remain the backend/AI spine, so
the build is still Google-native. Firebase **App Hosting** is the on-theme migration for Phase 1
if the team wants the host on Google too. *(This deviates from CLAUDE.md §1 "Hosting" — update
that row: "Web app on Vercel; Firebase for Firestore/Auth; App Hosting is the Phase-1 move.")*

- [ ] **Step 1: Deploy**

```powershell
npm install -g vercel
vercel
```

Accept the prompts (link/create project, default settings).

- [ ] **Step 2: Add environment variables** — in the Vercel dashboard → Project → Settings →
Environment Variables, add every key from `.env.local`. Then redeploy: `vercel --prod`.

- [ ] **Step 3: Verify** — open `https://<project>.vercel.app/api/health`.
Expected: `{"ok":true,"gemini":"OK"}`.

- [ ] **Step 4: Update CLAUDE.md** §1 Backend/Hosting row per the Decision note above, and commit.

```powershell
git add CLAUDE.md
git commit -m "docs: record Vercel as the M0 web host (CLAUDE.md §1)"
```

---

## Task Group E — emaktab ingestion

> Needs prerequisite 4. Run order: E1 (inspect) → E2 (implement).

### Task E1: Inspect the emaktab DOM

**Files:** Create `docs/emaktab-selectors.md` (the map E2 consumes).

- [ ] **Step 1:** Using the **Playwright MCP**, navigate to `https://emaktab.uz`, log in with
`EMAKTAB_USERNAME` / `EMAKTAB_PASSWORD` from `.env.local`.
- [ ] **Step 2:** Navigate to, and snapshot the DOM of: (a) grades/marks, (b) timetable,
(c) homework/assignments.
- [ ] **Step 3:** Record in `docs/emaktab-selectors.md`: the login form selectors, the URL of
each page, and the CSS/row selectors to read grades, timetable entries, and homework items.
- [ ] **Step 4: Commit** `docs/emaktab-selectors.md`.

### Task E2: Build and run the ingestion script

**Files:** Create `scripts/ingest-emaktab.ts`.

- [ ] **Step 1: Install tooling**

```powershell
npm install -D playwright tsx
npx playwright install chromium
```

- [ ] **Step 2: Create `scripts/ingest-emaktab.ts`** — fill the `SELECTORS` object from
`docs/emaktab-selectors.md` (Task E1).

```ts
import { chromium } from "playwright";
import { adminDb } from "../lib/firebase/admin";

// Filled from docs/emaktab-selectors.md (Task E1).
const SELECTORS = {
  loginUrl: "https://emaktab.uz/...",
  username: "input[name='login']",
  password: "input[name='password']",
  submit: "button[type='submit']",
  gradesUrl: "https://emaktab.uz/...",
  gradeRow: "...",
  timetableUrl: "https://emaktab.uz/...",
  timetableRow: "...",
  homeworkUrl: "https://emaktab.uz/...",
  homeworkRow: "...",
};

async function main() {
  const user = process.env.EMAKTAB_USERNAME;
  const pass = process.env.EMAKTAB_PASSWORD;
  if (!user || !pass) throw new Error("emaktab credentials missing in .env.local");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(SELECTORS.loginUrl);
  await page.fill(SELECTORS.username, user);
  await page.fill(SELECTORS.password, pass);
  await page.click(SELECTORS.submit);
  await page.waitForLoadState("networkidle");

  await page.goto(SELECTORS.gradesUrl);
  const grades = await page.$$eval(SELECTORS.gradeRow, (rows) =>
    rows.map((r) => r.textContent?.trim() ?? "")
  );

  await page.goto(SELECTORS.timetableUrl);
  const timetable = await page.$$eval(SELECTORS.timetableRow, (rows) =>
    rows.map((r) => r.textContent?.trim() ?? "")
  );

  await page.goto(SELECTORS.homeworkUrl);
  const homework = await page.$$eval(SELECTORS.homeworkRow, (rows) =>
    rows.map((r) => r.textContent?.trim() ?? "")
  );

  await browser.close();

  await adminDb.doc("students/demo-student-1/emaktab/snapshot").set({
    grades,
    timetable,
    homework,
    pulledAt: new Date().toISOString(),
  });

  console.log(
    `Cached: ${grades.length} grades, ${timetable.length} timetable rows, ${homework.length} homework items.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

> The script prints **counts only** — never the credentials, never raw personal data (CLAUDE.md §4).

- [ ] **Step 3: Run it**

```powershell
npx tsx --env-file=.env.local scripts/ingest-emaktab.ts
```

Expected: a `Cached: N grades, …` line with non-zero counts.

- [ ] **Step 4: Verify** — in the Firebase Console, confirm
`students/demo-student-1/emaktab/snapshot` exists with `grades`, `timetable`, `homework`,
`pulledAt`.

- [ ] **Step 5: Commit**

```powershell
git add scripts/ingest-emaktab.ts package.json package-lock.json
git commit -m "feat: emaktab ingestion script caches one account to Firestore"
```

---

## Task Group F — Curriculum extraction

> Needs prerequisites 3 and 5. Place the two PDFs in `data/curriculum/` as `math-9.pdf` and
> `history-9.pdf`.

### Task F1: Build the extraction script

**Files:** Create `scripts/extract-curriculum.ts`.

- [ ] **Step 1: Install the PDF renderer**

```powershell
npm install -D pdf-to-img
```

- [ ] **Step 2: Create `scripts/extract-curriculum.ts`**

```ts
import { pdf } from "pdf-to-img";
import { GoogleGenAI } from "@google/genai";
import { adminDb } from "../lib/firebase/admin";

const EXTRACTION_PROMPT = `You are digitizing a page from an Uzbek school textbook.
Return ONLY valid JSON: {"title": string, "explanation": string, "examples": string[],
"problems": string[]}. Transcribe faithfully; do not invent content. If a field is absent on
this page, use an empty string or empty array.`;

interface ExtractArgs {
  pdfPath: string;
  pages: number[]; // 1-based page numbers for one lesson
  grade: number;
  subject: "math" | "history";
  lessonId: string;
}

async function extractLesson(args: ExtractArgs) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const document = await pdf(args.pdfPath, { scale: 2 });

  const wanted = new Set(args.pages);
  let pageNo = 0;
  const images: { inlineData: { mimeType: string; data: string } }[] = [];
  for await (const page of document) {
    pageNo += 1;
    if (wanted.has(pageNo)) {
      images.push({ inlineData: { mimeType: "image/png", data: page.toString("base64") } });
    }
  }
  if (images.length === 0) throw new Error(`No pages matched ${args.pages} in ${args.pdfPath}`);

  const res = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ text: EXTRACTION_PROMPT }, ...images],
  });

  const raw = (res.text ?? "").replace(/^```json\s*|\s*```$/g, "").trim();
  const lesson = JSON.parse(raw);

  await adminDb
    .doc(`curriculum/${args.grade}/${args.subject}/${args.lessonId}`)
    .set({ ...lesson, grade: args.grade, subject: args.subject, extractedAt: new Date().toISOString() });

  console.log(`Extracted ${args.subject} lesson "${args.lessonId}": "${lesson.title}".`);
}

async function main() {
  // Page ranges below are placeholders — set them after opening each PDF (Task F2, Step 1).
  await extractLesson({
    pdfPath: "data/curriculum/math-9.pdf",
    pages: [/* lesson pages */],
    grade: 9,
    subject: "math",
    lessonId: "quadratic-equations-1",
  });
  await extractLesson({
    pdfPath: "data/curriculum/history-9.pdf",
    pages: [/* lesson pages */],
    grade: 9,
    subject: "history",
    lessonId: "ww2-1",
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

### Task F2: Run extraction on the two demo lessons

- [ ] **Step 1:** Open `data/curriculum/math-9.pdf` and `history-9.pdf`; note the 1-based page
numbers of the first lesson of each demo unit. Fill the two `pages: []` arrays in
`scripts/extract-curriculum.ts`.

- [ ] **Step 2: Run**

```powershell
npx tsx --env-file=.env.local scripts/extract-curriculum.ts
```

Expected: two `Extracted … lesson …` lines.

- [ ] **Step 3: Verify** — in the Firebase Console, confirm `curriculum/9/math/quadratic-equations-1`
and `curriculum/9/history/ww2-1` exist with non-empty `title` and `explanation`. Spot-check the
text against the PDF — it must be faithful, not invented (design principle §2).

- [ ] **Step 4: Commit**

```powershell
git add scripts/extract-curriculum.ts package.json package-lock.json
git commit -m "feat: curriculum extraction pipeline (PDF -> Gemini vision -> Firestore)"
```

---

## Definition of Done — M0

- [ ] App deployed to a live URL; `/api/health` returns `{"ok":true,"gemini":"OK"}`.
- [ ] `lib/ai/` adapter works and is the only path to Gemini.
- [ ] One emaktab account cached at `students/demo-student-1/emaktab/snapshot` in Firestore.
- [ ] At least one Grade-9 Math lesson and one Grade-9 History lesson extracted to
  `curriculum/9/...`, verified faithful to the textbook.
- [ ] No secrets committed; `.env.local` is gitignored; `.env.local.example` is committed.
- [ ] Every task group committed.

When all boxes are checked, M0 is complete → proceed to **M1 (Tracer bullet)**.
