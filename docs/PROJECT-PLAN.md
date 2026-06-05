# Scorpius — Project Plan

> **The master plan.** If another doc conflicts with this one, this file wins.
> Name: **Scorpius** — locked 2026-05-22.
> Companions: `CLAUDE.md` (working rules) · `docs/ARCHITECTURE.md` (technical design) ·
> `docs/HACKATHON-PLAN.md` (pitch, judging, demo script).

---

## 1. What Scorpius is

An AI tutor that turns **emaktab.uz** (Kundalik) from a passive gradebook into a personalized
Socratic tutor and a parent intelligence layer. It reads a student's real grades, timetable
and homework, finds the exact lesson in the Uzbek 1–12 curriculum, and teaches it one
swipeable card at a time — grounded in the textbook, taught far beyond it.

Built for the *Build with AI: EdTech Hackathon* (GDG Tashkent, 23–24 May 2026). After the
hackathon: a full-time **B2C** company — parents subscribe.

## 2. The product — 6 surfaces, 1 engine

| # | Surface | What it does | In hackathon? |
|---|---------|--------------|---------------|
| 1 | **Onboarding & Interest Discovery** | landing page → signup (name, grade, age) → TikTok-style interest swipe (sport, heroes, games, music). Builds the interest profile that personalizes lessons. | ✅ lean |
| 2 | **Learn** *(main)* | grade event → motivating notification → opens → agent finds the exact curriculum lesson → personalized lesson, one-question swipe UI | ✅ deep |
| 3 | **Homework** | upload a homework photo → Socratic help, never just the answer | ✅ |
| 4 | **Snap & Solve** | capture any problem → adaptive walkthrough (same engine as Homework, a second entry point) | ⏳ Phase 1 |
| 5 | **Voice Tutor** | talking tutor in Uzbek — friend + tutor | 🔸 stretch |
| 6 | **Parent** | stats, grades, feedback + teaches the parent the lesson so they can ask their child | ✅ brief only |

**The engine under all six — the moat, not a wrapper:**
emaktab data layer · knowledge tracing (BKT) · mistake & hesitation detection ·
interest/context personalization · curriculum agent (1–12, on demand) · quiz DSL + renderer.
Full technical design in `docs/ARCHITECTURE.md`.

## 3. Design principles (locked)

1. **Extract once, retrieve on demand.** The agent opens a textbook, finds the lesson,
   screenshots its pages, a vision model extracts structured content — **once per lesson,
   cached.** Runtime retrieves instantly. On-demand and lesson-by-lesson, but never re-paying
   the OCR cost on every open.
2. **Textbook decides WHAT; the agent owns HOW.** The textbook is the curriculum guardrail —
   no hallucinated content. The agent teaches beyond it: story, the student's interests,
   clean advanced explanation.
3. **Personalize on performance + interest — not "learning styles."** Adapt to what a student
   demonstrably struggles with, their pace, and their interests. Do **not** build fixed
   "visual/auditory learner" tags — debunked science, and a judge will catch it.
4. **Incremental vertical slices.** Each phase ships a complete thin path that runs. One
   feature or one quality bump at a time. Ugly-but-working first, then improve.

## 4. Method — how we run it

- **Vertical slices, not horizontal layers** — data → logic → UI in every phase
  (global CLAUDE.md §4).
- **Definition of Done:** it runs, it's demoed, it's verified. Never "should work."
- **Every milestone is a fallback** — if time runs out, the last finished milestone is still
  a working product.
- **Compound engineering:** every corrected mistake is logged to `CLAUDE.md` §8 so it never
  repeats.

## 5. Hackathon structure — 7 milestones

Each milestone is a complete, demoable vertical slice.

| # | Milestone | Window | Done when… |
|---|-----------|--------|------------|
| **M0** | Skeleton | now → 23 May 09:00 | Next.js + Firebase deployed · Gemini adapter returns text · emaktab login works + 1 account cached · 2 demo units extracted |
| **M1** | Tracer bullet | D1 AM | 1 student → 1 cached lesson → cards render → you can swipe a full lesson |
| **M2** | The loop | D1 PM | quiz card answered → BKT mastery bar moves · wrong answer → Socratic hint, never the answer |
| **M3** | Real entry | D1 night | landing → signup → interest onboarding → notification → opens the right lesson · Math + History both work |
| **M4** | Modes | D2 AM | Homework mode (photo → Socratic) + Parent brief screen working |
| **M5** | Polish + stretch | D2 midday | animations · Uzbek copy · 3 demo profiles · responsive mobile + WebView APK · vision slide · Voice Tutor *if* core is solid |
| **M6** | Pitch | D2 PM | deck + script + demo video + 3 timed dry runs · full demo runs 3× with no crash |

Once M1 lands, work runs as parallel tracks: **Content** (lessons, QA) · **Frontend** (swipe
UI, onboarding) · **Agents/Backend** (curator, tutor, BKT) · **Pitch** (deck, video, script).

## 6. Product macro-phases (after the hackathon)

Each phase = one feature or one quality bump. Start easy, compound.

| Phase | When | Adds |
|-------|------|------|
| **1.0** | May 25–31 | harden the hackathon build; fix what judges exposed; polished intro video; launch the beta (§7) |
| **1.1** | June | full **Grade 9** — all subjects, real content QA |
| **1.2** | — | **Voice Tutor** to production (voice-only first) |
| **1.3** | — | **Snap & Solve** + Parent app polish |
| **1.4** | — | **Grades 8 & 10** |
| **2** | Idrock, autumn 2026 | all 12 grades · video avatar · **Kundalik data partnership** (real API, stop scraping) |

Each Phase 1.x is shippable alone — put it in front of real students, learn, then build the next.

## 7. Cross-cutting deliverables

**Intro / demo video.** A rough screen-recorded demo video is part of **M6** (most hackathons
expect one with the submission). A polished **60–90s motion intro video** — next-gen tutor,
feature montage, upbeat music — is a **Phase 1.0** marketing deliverable.

**Mobile.** The web app is built **mobile-first / responsive** — it must work in a phone
browser. A thin **WebView APK** wrapper ships in M5 so the pitch can honestly say "web +
Android." One web app, two shells — not a second codebase.

**Beta testing & traction — read carefully.**
Goal: real student feedback. But honesty beats a big number — accelerator judges (Idrock /
SQB Ventures) *will* ask "when did you test? show the feedback."
A product built during a 34-hour hackathon **cannot** truthfully be called "tested with 50+
children over several days" — that timeline does not exist, and a fabricated traction claim
that collapses under one follow-up question is the fastest way to lose an accelerator.
Do this instead:
- **Before the pitch:** get a *small, real* test — even a prototype shown to 5–15 students at
  a learning centre or via a Telegram group. True, quotable feedback. Pitch line: *"We tested
  with N students this week — here's what they said."*
- **As a committed plan:** line up the 50-student beta for **Phase 1.0** (week of May 25) —
  named Telegram channels + 2–3 learning centres that have agreed. Pitch line: *"Our
  50-student beta launches Monday across 3 centres."*
- **Rule:** every number said on stage must be one you can prove on the spot.

## 8. What M0 needs from you (inputs checklist)

M0 — the skeleton — is blocked until I have:

1. **Firebase project** — create one at console.firebase.google.com (e.g. `sabaq-hackathon`);
   enable Firestore, Authentication, Hosting. Send me the web `firebaseConfig` object.
2. **Gemini API key** — from Google AI Studio (aistudio.google.com).
3. **emaktab account** — the school-64 / `vshahobiddinov` login. **Do not paste it in chat** —
   it goes in `.env.local` (I'll give you the exact keys to fill in).
4. **Curriculum PDFs** — Grade-9 Mathematics + Grade-9 History textbooks. A folder path on
   disk or links. Only those two are needed for the demo.
5. **Deploy target** — recommended: Firebase Hosting (on-theme, fast).

Items 1 and 2 unblock the scaffold — send those first. Credentials (item 3) always go in
`.env.local`, never in chat or git.

## 9. Open items (decide soon)

- ~~Final project name~~ — **locked: Scorpius** (2026-05-22).
- The **"33M-token corpus"** — what exactly is it? Needed to design the Voice Tutor.
- **API budget** band — affects how aggressively we use vision / image / voice APIs.
- **Rotate all credentials after the hackathon** — the Gemini key, the Firebase service-account
  key, and the emaktab login passed through dev chat; regenerate them before any public launch.
