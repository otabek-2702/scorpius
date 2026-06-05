# Handoff for CTO — Zaynobiddin

> **You just got added to this repo (Day 2 of GDG Build with AI EdTech Hackathon, 2026-05-24).
> Read this doc top to bottom — it gets you productive in 20 min.** Everything below is true at
> the time of the first `git push`. As things change, the source of truth is the code +
> `docs/STATE-*.md` snapshots, not this file.

---

## 1. What is Scorpius (60 sec)

**Product:** an AI tutor that turns emaktab.uz grades into personal lessons — one per topic the
student misses, in Uzbek, on phone, Socratic, 8 minutes.

**Why we win:**
- emaktab tells parents "your child got a 2." It does **nothing** with that data.
- We read it (grades, syllabus, homework), find the gap, and ship a personal lesson.
- Parents also get a **daily Uzbek brief** — what the child learned, how to ask about it.

**Live:** https://scorpius.uz · **Waitlist (QR target):** https://scorpius.uz/gdg

**Brand:** "Scorpius*" with a YC-style footnote — *the constellation. Separate stars become a
guide only when connected. We connect knowledge the same way: one star per topic, one lesson
per gap.*

**Locked design system:** cream `#fbf9f3` ground · ink `#1a1813` text · gold `#e8a21a` accent
(rationed) · Newsreader serif for editorial headlines · Inter for body · JetBrains Mono for
eyebrows. Light theme. Apple-mode restraint, no AI-slop.

---

## 2. Run it locally (10 min)

```bash
git clone https://github.com/tolipovmurodjon/random-name.git
cd random-name
npm install
cp .env.local.example .env.local       # then fill in the values from Murodjon
npm run dev                            # → http://localhost:3000
```

**Required env vars** (`.env.local`, never commit):

| Key | Where it comes from | Used by |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` + 5 more `NEXT_PUBLIC_FIREBASE_*` | Firebase console → Project settings → Web app | `lib/firebase/client.ts` |
| `FIREBASE_PROJECT_ID` · `FIREBASE_CLIENT_EMAIL` · `FIREBASE_PRIVATE_KEY` | Firebase console → Service accounts → Generate key (JSON) | `lib/firebase/admin.ts` |
| `OPENAI_API_KEY` | OpenAI dashboard | `lib/ai/openai.ts`, `lib/ai/image.ts` |
| `EMAKTAB_USERNAME` · `EMAKTAB_PASSWORD` | The consented test student account | `scripts/extract-emaktab.ts` (dev-only) |
| `GEMINI_API_KEY` | aistudio.google.com — **not usable from Uzbekistan**, kept as adapter fallback | `lib/ai/gemini.ts` |

**Ask Murodjon** (`@murodjon` on Telegram) for the actual values — he has them.
**Never commit `.env.local`.** It's gitignored.

**Smoke test once running:** open `http://localhost:3000` → editorial landing renders →
Boshlash → onboarding → /personalizing (cycling AI messages) → /learn (constellation with
HOZIRGI badge) → tap the gold star → bottom sheet → Boshlash → lesson cards.

---

## 3. Stack — exact versions matter

| Layer | Tech | Notes |
|---|---|---|
| Framework | **Next.js 16.2.6** (App Router, Turbopack) | This is **not the Next.js you know** — async `searchParams: Promise<...>`, all server components by default. Read `node_modules/next/dist/docs/` before writing routes. See `AGENTS.md`. |
| UI | **React 19.2.4** + **Tailwind v4** | Tailwind uses `@theme` blocks in `app/globals.css` for token-based styling. Never inline hex; use `bg-antares-500` etc. |
| Fonts | Geist Sans · Geist Mono · **Newsreader** (editorial serif) | Loaded via `next/font/google` in `app/layout.tsx` |
| State | React hooks + `localStorage` | No global store — profile, lesson progress, ignite flags all in `localStorage` per `lib/profile.ts` |
| Backend | **Firebase Firestore** + **firebase-admin 13** | Server writes via `lib/firebase/admin.ts` (lazy-init Proxy, see §5 caveat). Client reads via `lib/firebase/client.ts`. |
| AI | **OpenAI gpt-5-mini** (text) + **gpt-image-1** (images) + **gpt-5.1 vision** (curriculum extraction) | All gated through `lib/ai/model.ts` interface — swap providers by env var. Gemini is **wired but unusable from UZ** (billing blocked); OpenAI is the prod provider. |
| Auth | None yet | Onboarding stores name + grade in `localStorage`. Real auth (Google + emaktab cred check) is in the post-pitch backlog. |
| Build | Vercel (production) | `vercel.json` declares `framework: nextjs` explicitly — **don't delete this**, Vercel auto-detect was failing without it and serving only `/public` files. |
| Scraping | Playwright 1.60 + `scripts/extract-emaktab.ts` | Dev-only. Full-year run for the test account already ran: 843 grades, 199 days, 4 quarters. Output in Firestore at `students/demo-student-1/emaktab/snapshot`. |

---

## 4. File map — where to look for what

```
app/
  page.tsx                     # editorial landing (Paul-Graham style + YC footnote)
  layout.tsx                   # root layout, font imports, metadata
  globals.css                  # design tokens (cream/gold/ink) + animations
  onboarding/page.tsx          # 8-step student profile capture
  personalizing/page.tsx       # post-onboarding "AI personalization" wow moment
  learn/page.tsx               # constellation home (uses SkyView)
  learn/lesson/page.tsx        # lesson deck (uses LessonDeck)
  homework/page.tsx            # Socratic homework walkthrough
  parent/page.tsx              # daily Uzbek brief for parents
  gdg/page.tsx                 # waitlist (QR-code target for pitch)
  api/ask/route.ts             # live AI tutor — POST {question} -> answer
  api/generate-image/route.ts  # gpt-image-1 with SHA-keyed Firestore cache
  api/health/route.ts          # health probe (currently fails — uses Gemini; non-critical)
  api/waitlist/route.ts        # POST stores signup, GET returns count

components/
  onboarding/OnboardingFlow.tsx     # 8 steps, the final one routes to /personalizing
  sky/SkyView.tsx                   # Brilliant-style constellation w/ HOZIRGI badge + sheet
  learn/LessonDeck.tsx              # vertical-snap card deck, locks until answered
  learn/cards.tsx                   # the 12 card-type renderers
  learn/sims/BrachistochroneSim.tsx # the SVG cycloid race (the wow lesson)
  homework/HomeworkFlow.tsx         # photo upload + Socratic walkthrough
  parent/ParentDashboard.tsx        # the brief view
  nav/BottomNav.tsx                 # frosted bottom tabs
  gdg/WaitlistForm.tsx              # phone/grade/parent-or-student + live counter

lib/
  lesson.ts                    # the typed Card DSL — 12 card variants
  curriculum.ts                # subject + topic graph (unit data)
  curriculum/subjects.generated.ts  # codegen'd from the emaktab snapshot
  sky.ts                       # SkyStar layout (Scorpius constellation positions)
  profile.ts                   # localStorage save/load for student profile
  parent.ts                    # mock parent snapshot for the dashboard
  emaktab.ts                   # typed loader for the emaktab Firestore snapshot
  emaktab/normalize.ts         # canonical subject names ("Ona tili" etc.)
  ai/model.ts                  # the LanguageModel interface — DON'T LEAK OPENAI/GEMINI SPECIFICS
  ai/openai.ts · ai/gemini.ts  # adapter implementations
  ai/image.ts                  # gpt-image-1 wrapper
  firebase/client.ts           # browser SDK init
  firebase/admin.ts            # server SDK init (lazy Proxy — see §5)

scripts/
  extract-emaktab.ts           # Playwright scraper for full-year diary
  extract-curriculum.ts        # PDF → gpt-5.1 vision → Firestore curriculum
  sync-curriculum-subjects.ts  # codegen subjects from snapshot
  seed-emaktab.ts              # seed a known-good snapshot
  check-firebase.ts            # quick connectivity probe
  check-curriculum.ts          # validate curriculum docs

docs/
  HANDOFF-FOR-CTO.md           # this doc
  STATE-2026-05-24.md          # current state snapshot (pitch day)
  TEAM-HANDOFF.md              # Day-1 team handoff (still useful)
  CHECKPOINT-2.html            # Day-1 brief, source
  Scorpius-Checkpoint-2.pdf    # Day-1 brief, printable
  PROJECT-PLAN.md              # the master plan
  HACKATHON-PLAN.md            # judging strategy, demo script, cut list
  ARCHITECTURE.md              # system design, agent layer, data model
  UX-DESIGN.md                 # design tokens, motion, Apple-mode v1.3
  LEARN-MODE.md                # pedagogy, knowledge tracing, BKT formula
  EMAKTAB-DATA.md              # what we pull from emaktab, what stays local
  M0-BUILD-PLAN.md             # the original M0 skeleton plan
  cust-dev-form.md             # the Mom Test customer-dev survey spec
  emaktab-outreach.md          # Uz + En letter to emaktab.uz
  beta-tester-message.md       # Telegram blast templates
  pitch/index.html             # the 3-min pitch deck (HTML, arrow-key nav, fullscreen)
  pitch/Scorpius-Pitch.pdf     # PDF backup of the deck
  pitch/speaker-script-uzbek.md # Amirsaid's line-by-line script + Q&A pack

public/
  qr-gdg.png                   # 720x720 QR -> scorpius.uz/gdg
  pitch/index.html             # served copy of the pitch deck

CLAUDE.md, AGENTS.md           # rules for AI agents that touch this repo
vercel.json                    # framework: nextjs — DO NOT DELETE
next.config.ts                 # empty for now, room to grow
tailwind via @tailwindcss/postcss   # no separate tailwind.config — using v4 @theme
```

---

## 5. Caveats — things that will trip you up

1. **`lib/firebase/admin.ts` is a lazy Proxy, not an eager singleton.** Initializing Firebase
   Admin at module load made `next build` fail when it statically analyzed API routes that
   transitively imported this module (cert() threw because env vars don't exist at build
   time). The Proxy defers init until first method call.

2. **The Proxy also strips BOM + CRLF** from `FIREBASE_PROJECT_ID` and `FIREBASE_CLIENT_EMAIL`.
   Why: when I pushed env vars via `vercel env add` through PowerShell streams on Windows, the
   values got a UTF-8 BOM and CRLF embedded. Firebase Admin rejects those as "illegal
   characters in metadata." If you re-push env vars from a clean shell (macOS/Linux/WSL), this
   sanitizer becomes unnecessary — but leave it as belt-and-suspenders.

3. **Gemini is blocked in Uzbekistan.** Google AI billing is unavailable. The adapter is still
   there (`lib/ai/gemini.ts`) so we can swap if we ever get billing, but production runs on
   OpenAI. `/api/health` currently returns 500 because it hits Gemini — non-critical, fix on
   the post-pitch sweep.

4. **`vercel.json` is required.** Without `{"framework": "nextjs"}`, Vercel autodetected this
   as a static site and served only `/public/*` files — every Next.js route returned 404. Took
   2 hours to debug pre-pitch. Don't remove it.

5. **Deployment Protection on Vercel must stay OFF.** When ON, all URLs (including custom
   domain) return 401 or 404. We disabled it pre-pitch. Check
   `https://vercel.com/ghosts-projects-0d9af52d/scorpius/settings/deployment-protection`.

6. **scorpius.uz DNS lives at EKSIZ.** A record points to `76.76.21.21` (Vercel). The other
   subdomains (`mail.`, `ftp.`, `webmail.`) point to `45.138.159.4` — that's email infra,
   don't touch.

7. **Real per-user kundalik integration is NOT shipped.** The demo loads a pre-cached snapshot
   from one consented test account. The Playwright scraper (`scripts/extract-emaktab.ts`)
   works but it's dev-time only — Vercel serverless can't run Playwright. Production needs a
   worker service (see §6 below).

8. **Solo-on-main convention.** We've been pushing to `main` directly through the hackathon.
   Post-pitch: switch to PR + review. Murodjon's global rules say "feature branches + PR
   only" — let's enforce that going forward.

9. **No double-quotes in PowerShell git commit here-strings.** PowerShell mangles them and the
   message words become bogus pathspecs. Use plain text or single quotes. (Bash heredocs are
   fine.)

---

## 6. What's pending — post-pitch backlog

In rough priority order:

### Backend
- **Real kundalik/emaktab integration on a server.** Murodjon's Humopedia Oracle box (Ubuntu
  24.04 ARM, 4 cores, 24 GB RAM, IP `130.61.104.240`) is available. The plan:
  1. Wrap `scripts/extract-emaktab.ts` in a small Express server with one endpoint:
     `POST /fetch-emaktab {username, password}` → triggers Playwright, returns `{snapshotId}`
  2. Frontend POSTs creds → server scrapes → writes snapshot to Firestore at
     `students/{uid}/emaktab/snapshot` → frontend reads it
  3. Two-phase fetch: latest week first (fast, returns in 2s), then full year in background
  4. Encrypt creds in transit + at rest. Auth between Vercel and Oracle via shared secret.
- **Replace `localStorage` profile with Firebase Auth** (Google sign-in + email). Persist
  profile to `users/{uid}` in Firestore.
- **Move `/api/health` off Gemini** to a real ping.
- **BKT knowledge-tracing engine** — formula is specified in `docs/ARCHITECTURE.md §4`.
  Currently `/learn` uses lit/dim binary state; production should compute `P(mastered)` per
  topic and surface it visually.

### Product
- **ElevenLabs voice narration** on intro/story/explainer cards. Card DSL already has `voice?`
  fields. Cache to Firestore `voices/{sha}` like images.
- **Snell's-law refraction simulation** as a second wow lesson (parallels Brachistochrone).
- **Onboarding rewrite** — friendlier name + `@username` flow with availability check,
  Google sign-in button, kundalik creds step with privacy text + skip option, blurred
  empty-state on `/learn` when no emaktab connected.
- **5+ Grade-6 physics topics** imported from infoedu.uz curriculum as "Tez orada" stars in
  the constellation (signals roadmap, doesn't need real lessons today).
- **Parent brief generator** — one route that summarises last 7 days through the model
  adapter, Uzbek tone. Spec in `docs/TEAM-HANDOFF.md §5 task D`.

### Infra
- **Re-push Vercel env vars** from a non-Windows shell to clean the BOM/CRLF (the code-side
  sanitizer is a workaround; native-clean values are better hygiene).
- **CI/CD**: GitHub Actions → ESLint + Type check on PR. No tests yet — add Jest/Vitest as
  the codebase grows.
- **Monitoring**: Vercel Analytics is off. Turn it on for traffic. Sentry for errors.

### Documentation
- **ARCHITECTURE.md** is from M0 era — refresh it with the actual shipped surfaces and the
  Card DSL.
- **Post-pitch retro doc** — what worked, what didn't, what we'd do differently.

---

## 7. Conventions

- **Commits:** Conventional Commits-ish (`feat:`, `fix:`, `chore:`, `docs:`). One commit per
  concern. Always include why-this-change in the body, not just what changed.
- **Co-author tag for AI work:** lines committed with help from Claude/another AI agent
  should include `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` (or whichever
  model). It's an honest signal of authorship.
- **No double quotes in PowerShell here-string commit messages** (see caveat #9).
- **Match nearby code style** before adding new code. Don't import a React pattern into
  Compose, don't paste a Java pattern into Kotlin. (Mostly relevant once we touch the
  post-pitch mobile app.)
- **No dead code.** Don't comment-out blocks "for later." Git remembers.
- **Smallest diff wins.** No new abstractions until built 3 times.
- **Verify before declaring done.** "Should work" is not done — run it, screenshot it.
- **Per the global rules in `CLAUDE.md`:** never read/write/commit `*.jks`, `*.keystore`,
  `.env*`, `serviceAccount*.json`, or anything matching `*secret*`/`*token*`/`*password*`/
  `*credential*`. Never push to `main` directly post-hackathon (feature branches + PR).

---

## 8. Where to ask questions

- **Murodjon Tolipov** — founder, build owner. Telegram: `@murodjon`. Email:
  `murodjontolipov.dev@gmail.com`.
- **Amirsaid** — team lead, pitcher.
- **Zaynobiddin (you)** — CTO. Welcome aboard.

When you're stuck on something specific, open an issue on the repo with a `question` label and
tag Murodjon. Don't @-everyone in chat for technical questions — use the repo.

---

## 9. First-day checklist for Zaynobiddin

- [ ] Clone the repo, get `.env.local` from Murodjon, run `npm install && npm run dev`
- [ ] Walk every surface in the browser (15 min — see §2 smoke test)
- [ ] Read `docs/STATE-2026-05-24.md` for current state (5 min)
- [ ] Read `docs/PROJECT-PLAN.md` and `docs/ARCHITECTURE.md` (20 min)
- [ ] Pick ONE thing from §6 above and tell Murodjon "I'll take this" before writing code
- [ ] Open a feature branch (`zayn/<short-thing>`), PR when ready, review by Murodjon

Welcome aboard. The system is ready for you. Make it better.
