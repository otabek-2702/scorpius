# Scorpius

> **Name: Scorpius** — locked 2026-05-22. The sky-scorpion: scattered stars that, connected,
> become a guide. We took the constellation, not the creature. Domain + trademark check pending.

An AI tutor that turns **emaktab.uz** from a passive gradebook into a personalized Socratic
tutor — and a parent intelligence layer.

Built for the **Build with AI: EdTech Hackathon** — GDG Tashkent · New Uzbekistan University ·
23–24 May 2026.

---

## The one-liner

emaktab tells a parent *"your child got a 2 today."* Scorpius tells them **why**, traces it to the
exact lesson, and hands the student a 10-minute personalized, swipeable lesson to fix it —
Socratically, in Uzbek.

## How it works

1. **Connect** — student/parent links their emaktab account (consented). Scorpius pulls grades,
   timetable, homework, and the lesson tree.
2. **Detect** — a knowledge-tracing model finds which skills are weak and which mistakes repeat.
3. **Curate** — an agent locates the exact textbook lesson and generates a personalized card
   sequence calibrated to that student.
4. **Teach** — one question at a time, TikTok-style vertical swipe. Socratic — guides the
   student to the answer, never just hands it over.
5. **Brief the parent** — a daily Uzbek summary that *also teaches the parent the lesson*, so
   they can ask their child about it at dinner.

## Stack

Next.js (App Router, TypeScript) · Firebase (Firestore, Auth, Cloud Functions, Hosting) ·
Gemini 2.5 behind a model adapter · BKT knowledge tracing · curriculum RAG.

## Live

- **Production:** https://scorpius.uz
- **Waitlist (QR target):** https://scorpius.uz/gdg
- **Pitch deck:** `docs/pitch/index.html` (open in Chrome, press F for fullscreen) · PDF backup at `docs/pitch/Scorpius-Pitch.pdf`

## Team — start here

| File | Read this when |
|------|----------------|
| **`docs/HANDOFF-FOR-CTO.md`** | **First thing if you just got added to this repo.** What's built, how to run it, what's pending, conventions. |
| **`docs/STATE-2026-05-24.md`** | Current state snapshot — pitch day. What's live, what shipped today, what's next 24h. |
| **`docs/TEAM-HANDOFF.md`** | Day-1 handoff (Checkpoint 2 brief). Still useful for stack-mastery pointers. |
| **`docs/pitch/speaker-script-uzbek.md`** | Amirsaid's pitch script — Uzbek lines + Q&A pack. |
| **`docs/Scorpius-Checkpoint-2.pdf`** | Day-1 build state, one printable brief. |
| `docs/CHECKPOINT-2.html` | Same brief, browser-viewable source. |

## Docs

| File | What's in it |
|------|--------------|
| `CLAUDE.md` | Project constitution — locked decisions, conventions, hackathon mode |
| `docs/PROJECT-PLAN.md` | The master plan — product surfaces, milestones, post-hackathon phases |
| `docs/HACKATHON-PLAN.md` | Judging strategy, demo script, 34-hour build plan, cut list |
| `docs/ARCHITECTURE.md` | System design, the agent layer, data model, quiz DSL |
| `docs/UX-DESIGN.md` | Design system — tokens, type scale, motion, Apple-mode craft pass |
| `docs/LEARN-MODE.md` | Pedagogy engine — knowledge tracing, personalization, feedback |
| `docs/EMAKTAB-DATA.md` | Data extraction notes — what we pull, what stays local |

## Status

**Day 2 — Pitch day (2026-05-24, 12:00):** live on https://scorpius.uz, 8 surfaces shipped (added `/personalizing` and `/gdg`), Firestore waitlist with live counter, editorial Paul-Graham-style landing, Brilliant-style `/learn` (LEVEL pill + HOZIRGI badge + bottom-sheet), 9-slide HTML pitch deck with QR CTA. Clean `main`. See `docs/STATE-2026-05-24.md` for the full state.

**Day 1 — Checkpoint 2 (2026-05-23, 17:30):** 7 surfaces shipped, 12 card types, 3 AI models wired (Gemini 2.5 Flash · OpenAI gpt-5-mini · gpt-image-1), 30 commits, clean `main`. See `docs/Scorpius-Checkpoint-2.pdf` for the full state.
