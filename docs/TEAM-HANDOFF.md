# Scorpius — Team Handoff

> **Read this top to bottom before you write a line of code.** It tells you what we're building, how to run it, the stack you need to master, and the exact tasks each person can pick up in the next 24 hours.
>
> Companion docs (read order): this file → `CHECKPOINT-2.html` (the brief) → `PROJECT-PLAN.md` (the master plan) → `ARCHITECTURE.md` (the system) → `UX-DESIGN.md` (the design system).

---

## 1 · What we're building (60 seconds)

**Scorpius** is an AI tutor that turns **emaktab.uz** (Uzbekistan's national gradebook) from a passive grade screen into a personal tutor. It reads a student's real grades, finds the lesson in the Uzbek 1–12 curriculum, and teaches it one swipeable card at a time — grounded in the textbook, taught beyond it.

**Brand metaphor:** a constellation. Every topic is a star. Master a topic — your star ignites. Over time the student's sky fills in.

**One-line pitch:** *"AI tutor that turns emaktab grades into personal lessons — one swipeable card at a time, grounded in the Uzbek textbook, taught beyond it."*

---

## 2 · How to run it locally

```powershell
# 1. install
npm install

# 2. create .env.local from the template
Copy-Item .env.local.example .env.local
# then fill in:
#   GEMINI_API_KEY=                    (aistudio.google.com)
#   OPENAI_API_KEY=                    (platform.openai.com)
#   NEXT_PUBLIC_FIREBASE_*             (Firebase Console > Project settings)
#   FIREBASE_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY  (service account JSON)
#   EMAKTAB_USERNAME / EMAKTAB_PASSWORD  (only for the ingestion script)

# 3. dev server (Turbopack, fast HMR)
npm run dev
# → http://localhost:3000

# 4. health check (verifies the model adapter is wired)
# open http://localhost:3000/api/health
# expect: {"ok":true,"gemini":"OK"}

# 5. (optional) re-pull emaktab data — needs real credentials
npx tsx --env-file=.env.local scripts/extract-emaktab.ts

# 6. (optional) re-extract a curriculum lesson from a PDF
npx tsx --env-file=.env.local scripts/extract-curriculum.ts
```

**Where to start clicking:** `/onboarding` → `/learn` → tap a topic → swipe through the cards. Then `/learn/lesson?topic=brachistochrone` for the physics simulation.

> **Secrets posture (non-negotiable):** `.env.local` is gitignored. Never paste keys in chat. Never log credentials. Rotate every key after the hackathon.

---

## 3 · The stack you need to master (priority order)

### 3.1 — Next.js 16 (App Router) *— most important*

**This is not the Next.js you remember.** Read `node_modules/next/dist/docs/` before writing route code.

Three conventions that have changed and matter to us:

1. **`searchParams` is a Promise.** Every page that reads query params must `await` them:
   ```ts
   export default async function Page({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
     const { topic } = await searchParams;
     // ...
   }
   ```
   See `app/learn/lesson/page.tsx` for the pattern we use.

2. **Server components by default.** Add `'use client'` only when the file uses state, effects, or browser APIs. The big interactive pieces (`LessonDeck`, `OnboardingFlow`, `BrachistochroneSim`) are client; everything else is server.

3. **API routes live in `app/api/*/route.ts`** and export `GET` / `POST`. See `app/api/ask/route.ts` for the canonical shape (validate input → call adapter → return `NextResponse.json`).

### 3.2 — React 19

Only what we actually use:
- `useState`, `useEffect`, `useMemo`, `useRef`, `useCallback` — same as React 18.
- We do **not** use Server Actions, `use(promise)`, or the new form features yet — they're open territory for whoever needs them.

### 3.3 — Tailwind v4

`@theme` in `app/globals.css` defines our design tokens (cream + gold + ink + Antares accent). **Never use raw Tailwind palette classes** (`bg-slate-800`, `text-orange-500`) in product code. Always use the semantic token (`bg-surface`, `text-ink-soft`, `text-gold`). Read `docs/UX-DESIGN.md §1` for the full token set and the rationale.

### 3.4 — The Card DSL

`lib/lesson.ts` defines a TypeScript discriminated union of 12 card variants:

| Type | Locks scroll? | Use it for |
|---|---|---|
| `intro` | no | first card — title + hook + estimated minutes |
| `explainer` | no | prose teaching content (supports inline scroll if long) |
| `mcq` | **yes** | multiple choice with hint + per-answer explainer |
| `discover` | **yes** | "select all that apply" from a pool |
| `sequence` | **yes** | arrange in order |
| `sort` | **yes** | two-bucket sort (A vs B) |
| `numberline` | **yes** | tap correct points on a 0–N line |
| `simulation` | **yes** | renders from `SIM_REGISTRY` — e.g. `brachistochrone` |
| `diagram` | no | AI-generated or cached image with caption |
| `story` | no | narrative beat with serif accent (the "Newton overnight" moment) |
| `ask` | no | free-text question → live Socratic reply |
| `done` | no | completion card — ignites the star in the sky |

**How to author a new lesson** (5 minutes once you've seen it):

1. Open `lib/lesson.ts`, find `brachistochroneLesson` — copy it as a template.
2. Write your 6–8 cards: open with `intro`, ask a hooking `mcq`, drop a `simulation` or `diagram`, tell a `story`, give an `explainer`, close with a `mcq` review + `ask` + `done`.
3. Register it: `export const LESSONS_BY_ID = { boluvchi, brachistochrone, your-new-lesson }`.
4. Add a star for it on the sky surface: `components/sky/SkyView.tsx`. Use Brachistochrone's MAXSUS card as the visual template.
5. Open `/learn/lesson?topic=your-new-lesson` — it just works. No build step, no Firestore write.

### 3.5 — The Model Adapter

Single interface, multiple backends:

```ts
// lib/ai/model.ts
export interface LanguageModel {
  ask(prompt: string): Promise<string>;
}
```

Implementations live in `lib/ai/gemini.ts`, `lib/ai/openai.ts`. The configured model is exported from `lib/ai/index.ts` — picks the first available key in this order: `OPENAI_API_KEY` → `OPENROUTER_API_KEY` → `GEMINI_API_KEY`.

**To add a new capability (voice, video):** add a new file (`lib/ai/voice.ts`), expose a typed function, wrap it in an API route under `app/api/`, cache the result to Firestore using the SHA-256 pattern from `lib/ai/image.ts`. That's the pattern. Don't deviate.

### 3.6 — Firestore caching pattern (study this — you will reuse it)

Look at `app/api/generate-image/route.ts` + `lib/ai/image.ts`. The pattern:

1. Hash the input deterministically: `sha256(prompt + size + quality)`.
2. Check `images/{hash}` in Firestore. If present, return cached. If not, generate.
3. Store result with the input hash as the document ID.

Use the same pattern for voice (`voices/{sha}`), parent briefs (`briefs/{studentId}-{weekStart}`), and any other expensive AI output.

---

## 4 · File map

| Directory | Owns |
|---|---|
| `app/` | routes (server-rendered by default) + API endpoints |
| `app/api/ask/` · `generate-image/` · `health/` | live LLM + image + health endpoints |
| `lib/lesson.ts` | the Card DSL + every authored lesson + the registry |
| `lib/ai/` | model adapter, OpenAI/Gemini wrappers, image generator |
| `lib/firebase/` | Firebase Admin SDK init (server-only); browser-side SDK if needed |
| `lib/emaktab/` | typed reader + subject/mark normaliser for the cached export |
| `components/learn/` | lesson deck, card templates, sim registry |
| `components/learn/sims/` | individual simulation components (`BrachistochroneSim`, …) |
| `components/sky/` | the constellation home surface |
| `components/onboarding/` | the 8-step profile wizard |
| `components/homework/` | Socratic homework walkthrough |
| `components/parent/` | parent dashboard (stub — waiting for the brief generator) |
| `components/nav/` | bottom nav |
| `scripts/` | `extract-emaktab.ts`, `extract-curriculum.ts`, `seed-*.ts` |
| `data/` | gitignored — cached emaktab JSON, extracted PDFs |
| `docs/` | every plan, spec, brief |
| `public/` | static assets (icons, fonts if any) |

---

## 5 · The next 24 hours — pick one, ship it

Each task is sized for one person, ≤6 hours, ships independently. Use feature branches if you want; main is also fine (we're solo-pushing). One commit per task, conventional message.

### Task A · ElevenLabs voice narration *(highest impact, ~4h)*

The DSL already has `voice?: string` on `intro`, `explainer`, `diagram`, `story` cards. Wire the rest:

- [ ] `lib/ai/voice.ts` — async `generateVoice(text: string, voiceId?: string): Promise<{ b64: string; mime: string }>` calling ElevenLabs `/v1/text-to-speech/{voice_id}` with `eleven_multilingual_v2` (Uzbek-capable).
- [ ] `app/api/voice/route.ts` — POST `{ text, voiceId? }` → SHA-cached in Firestore `voices/{hash}` (mirror `generate-image`).
- [ ] `components/learn/cards.tsx` — add a small play button on cards that have `voice`. Use the HTML5 `<audio>` element with `data:audio/mpeg;base64,...`.
- [ ] Add `ELEVENLABS_API_KEY` to `.env.local.example`.
- [ ] Walk through the Brachistochrone lesson end-to-end with sound. Verify the cache hit on the second open.

### Task B · Refraction simulation *(eureka moment #2, ~5h)*

Mirror Brachistochrone exactly:

- [ ] `components/learn/sims/RefractionSim.tsx` — show a light ray hitting a water/glass boundary; let the user drag the incidence angle; visualise Snell's law (`n1 sin θ1 = n2 sin θ2`); calculate the critical angle for total internal reflection and show it ignite when crossed.
- [ ] Register it: `SIM_REGISTRY.refraction = RefractionSim` in `components/learn/sims/index.tsx`.
- [ ] Author the lesson in `lib/lesson.ts`: `refractionLesson` with `subject: "physics"`, `subjectLabel: "MAXSUS · FIZIKA"`, 7 cards (intro, mcq, simulation, diagram, story, explainer, done).
- [ ] Add a star to `components/sky/SkyView.tsx` linking to `/learn/lesson?topic=refraction`.

### Task C · Production Vercel deploy *(unblocks the live URL claim, ~1h)*

- [ ] `vercel link` (if not already linked).
- [ ] In the Vercel dashboard → Project → Settings → Environment Variables, add every key from `.env.local` (Production env).
- [ ] `vercel --prod`.
- [ ] Verify `https://<project>.vercel.app/api/health` returns `{"ok":true,...}`.
- [ ] Paste the live URL into `docs/CHECKPOINT-2.html` (the status bar already has the placeholder).

### Task D · Parent brief generator *(the emotional close, ~3h)*

- [ ] `app/api/parent-brief/route.ts` — POST `{ studentId, days?: 7 }` → reads cached emaktab snapshot, calls the model adapter with an Uzbek-tone prompt that returns `{ summary, struggles[], strengths[], conversationStarters[] }`.
- [ ] Cache by `briefs/{studentId}-{weekStart}` (so the same student-week is free on every reload).
- [ ] Wire `components/parent/ParentDashboard.tsx` to call it on mount and render the result.
- [ ] Test with the cached `data/emaktab-export.json`.

### Task E · Visible `P(mastered)` bar *(the demo moment from the pitch, ~2h)*

The BKT formula is in `docs/ARCHITECTURE.md §4` — it's pure math, no LLM:

- [ ] `lib/bkt.ts` — implement the four-parameter Bayesian Knowledge Tracing update (`P(L0)`, `P(T)`, `P(G)`, `P(S)`).
- [ ] Track per-skill mastery in localStorage (post-hackathon we move to Firestore).
- [ ] Render a thin gold-fill bar at the top of each card showing the current `P(mastered)` for the skill being practiced.
- [ ] On `mcq` correct → update and animate the bar from old to new value.

### Task F · One real-student test *(the pitch ammo, ~2h)*

The judges (SQB Ventures, Idrock) will ask "did real kids use it?" — the honest answer ships before the final pitch:

- [ ] Pick 5–15 kids (a Telegram channel, a learning centre, family).
- [ ] Send the live URL (after Task C).
- [ ] Record their quotes verbatim.
- [ ] Add a one-line "We tested with N students this week — here's what they said" to the pitch deck.

---

## 6 · Conventions we keep

Lifted from `CLAUDE.md` — these have earned their place.

1. **Plan before code.** Non-trivial work → plan first, get it approved, then implement.
2. **Smallest diff wins.** Match existing patterns. No new abstractions unless three uses justify it.
3. **Verify before declaring done.** Run the dev server. Click the feature. "Should work" is not done.
4. **One task per session.** If you have multiple, pick one, finish it, commit.
5. **Never invent.** If you're unsure of an API, version, or file location → read the docs, grep the code, or ask.
6. **No dead code.** No commented-out "for later" blocks. Git remembers.
7. **Comments explain why, not what.** If the code needs a comment to explain what it does, rewrite the code.
8. **Conventional commits.** `feat:`, `fix:`, `docs:`, `chore:` — one purpose per commit.
9. **Never commit secrets.** `.env.local` is gitignored. `data/` is gitignored. `*.serviceaccount.json` is gitignored.
10. **Never `--no-verify`.** If a hook fails, fix the underlying issue.

---

## 7 · If you only have 10 minutes

1. Open `docs/CHECKPOINT-2.html` in a browser. Skim it.
2. Open `docs/PROJECT-PLAN.md`. Read §1 and §2.
3. Open `lib/lesson.ts`. Read the `brachistochroneLesson` constant.
4. Open `components/learn/sims/BrachistochroneSim.tsx`. Skim the 280 lines.
5. Pick a task in §5 above. Ship it.

---

*Last updated 2026-05-23 · for Build with AI: EdTech Hackathon, GDG Tashkent.*
