# Architecture — Scorpius

> The technical design. The point of this document: show that Scorpius is a **system**, not a
> Gemini wrapper. The LLM is one swappable component inside a pipeline that is ours.

---

## 1. System overview

```
┌──────────────────────────────────────────────────────────────┐
│  emaktab.uz / Kundalik   (national gradebook)                  │
└───────────────┬────────────────────────────────────────────────┘
                │  consented, user-authorized pull (cached)
                ▼
┌──────────────────────────────────────────────────────────────┐
│  emaktab Sync        normalize → grades, timetable, homework   │
└───────────────┬────────────────────────────────────────────────┘
                ▼
┌──────────────────────────────────────────────────────────────┐
│  Student Knowledge Model                                       │
│   • Knowledge Tracer (BKT)  → P(mastered) per skill            │
│   • Engagement signals      → hesitation, repeated mistakes    │
│   • Profile                 → grade, age, interests            │
└───────────────┬────────────────────────────────────────────────┘
                ▼
┌──────────────────────────────────────────────────────────────┐
│  Curriculum RAG     Grade-9 Math + History, pre-indexed         │
│   • lesson chunks + figures   • skill graph (prereqs)           │
└───────────────┬────────────────────────────────────────────────┘
                ▼
┌──────────────────────────────────────────────────────────────┐
│  Agent Orchestrator   routes the request to the right agent    │
└──┬──────────┬──────────┬──────────┬───────────────────────────┘
   ▼          ▼          ▼          ▼
 Lesson    Socratic    Quiz      Parent
 Curator   Tutor       Generator Briefer
   │          │          │          │
   └──────────┴──────────┴──────────┘
                ▼
        Model Adapter  →  Gemini 2.5  (swappable)
                ▼
        Next.js UI  —  vertical-swipe card deck
```

---

## 2. The agent layer (this is the product)

Each agent = **our prompt + our logic + our data**, calling the model adapter for language.
The agents are what make Scorpius more than an API call.

| Agent | Input | Output | Owns |
|-------|-------|--------|------|
| **emaktab Sync** | account credentials (consented) | normalized grades / timetable / homework | the scrape + normalize logic |
| **Knowledge Tracer** | interaction events | updated `P(mastered)` per skill | the BKT math (no LLM) |
| **Lesson Curator** | student state + lesson + textbook chunks | an ordered sequence of lesson cards (DSL) | pedagogy routing — stuck → prerequisite first |
| **Socratic Tutor** | a question / a photo of homework + student state | the next unblocking question, never the answer | the "never give the answer" guarantee |
| **Quiz Generator** | a skill + difficulty target | quiz cards in the DSL | calibration to the student's level |
| **Parent Briefer** | recent events + skill deltas | an Uzbek parent summary + conversation starters | tone, literacy level, what to surface |

The **Orchestrator** decides which agent runs. Example logic: a student opens a History
lesson → Lesson Curator checks the Knowledge Tracer → finds a weak prerequisite skill →
inserts a review card before the new material. That decision is *our code*, not the model's.

---

## 3. Data flow — student opens a lesson

```
onLessonOpen(studentId, lessonId):
  1. parallel fetch:
       profile, BKT state for this lesson's skills,
       recent mistakes (7d), pre-indexed lesson content
  2. decide pedagogy:
       stuck skills  (P < 0.40)  → prerequisite review first
       review skills (0.40–0.85) → reinforce
       mastered      (P > 0.85)  → stretch / skip
  3. Lesson Curator → generate ~6 cards via the model adapter
  4. stream cards to the client; render as a vertical-swipe deck
  5. each answer → log an event → Knowledge Tracer updates P(mastered)
```

---

## 4. Knowledge Tracer — Bayesian Knowledge Tracing (BKT)

Classical, interpretable, cheap — no LLM, runs in a Cloud Function. Each curriculum skill has
four parameters: `P(L0)` prior, `P(T)` transit, `P(G)` guess, `P(S)` slip. After every answer,
update `P(mastered)` by Bayes' rule. The result is a number we can **show on screen** — the
mastery bar moving 0.3 → 0.58 is a demo moment. DKT (LSTM-based) is the post-hackathon
upgrade; ship BKT, mention DKT as roadmap.

---

## 5. Curriculum RAG

- **Ingestion pipeline (extract once, cache):** the agent opens a textbook PDF, navigates to
  a lesson via its table of contents, captures the lesson's pages as images, and a vision
  model extracts structured content (text, problems, figures). Run **once per lesson**, then
  cached — runtime never re-pays the OCR cost. For the hackathon, pre-run this on Grade-9
  Math (quadratics) + Grade-9 History (one unit) before the demo.
- **Index:** extracted lessons → markdown chunks + figures, keyed by grade / subject / lesson.
- **Skill graph:** each lesson maps to skills; skills have prerequisite edges. This is what
  lets the Orchestrator say "review the prerequisite first."
- **Storage:** Firestore. The demo corpus is small enough that vector search is optional —
  start with keyword + structured lookup; add Firestore vector search only if it earns its
  keep. Do not over-build retrieval for ~12 lessons.

---

## 6. Quiz DSL — LLM emits structured cards, UI renders templates

The model never emits raw chat text into the lesson surface. It emits **typed cards** as JSON
inside `<CARD>…</CARD>` sentinels so the client can parse them as they stream. JSON over a
custom `///` delimiter: every model is trained on JSON, and it validates with a schema.

```ts
type LessonCard =
  | { type: "intro";      title: string; hookText: string; estMinutes: number }
  | { type: "explainer";  markdown: string; imageId?: string; latex?: string[] }
  | { type: "mcq";        q: string; options: string[]; correctIdx: number;
                          explainEach: string[]; hint: string; skillId: string }
  | { type: "fillBlank";  q: string; accepted: string[]; hint: string; skillId: string }
  | { type: "freeWrite";  q: string; rubric: string[]; minWords: number; skillId: string }
  | { type: "checkpoint"; skillIds: string[]; passThreshold: number };
```

**UX:** vertical-swipe deck (TikTok-style) for quiz cards. Explainer cards **scroll** within
the card — students need time on math; an accidental swipe past a 3-minute explainer is a
rage-quit. Mixed paradigm: scroll *within* a card, swipe *between* cards.

---

## 7. Model adapter — why we are not locked in

All LLM access goes through one interface in `lib/ai/`. Components and agents never call
Gemini directly.

```ts
interface LanguageModel {
  generateCards(prompt: CardPrompt): AsyncIterable<LessonCard>;
  ask(prompt: string, opts?: AskOptions): Promise<string>;
}
```

Implementations: `GeminiModel` (primary — Flash for cards/quizzes, Pro for hard reasoning).
A `ClaudeModel` implementation is the documented fallback for the Orchestrator's deepest
reasoning, post-hackathon. For the 34-hour build, **Gemini only** — keeps it simple, on-theme,
one API key. The adapter is what lets the pitch honestly say "multi-model ready."

---

## 8. Firestore data model

```
students/{studentId}                  profile: name, grade, age, interests, emaktabLinked
students/{studentId}/skills/{skillId}  BKT state: pMastered, pTransit, lastSeenAt
students/{studentId}/events/{eventId}  cardId, correct, latencyMs, hesitated, ts
students/{studentId}/emaktab           cached: grades[], timetable[], homework[], pulledAt

curriculum/{grade}/{subject}/lessons/{lessonId}   chunks[], figures[], skillIds[]
curriculum/{grade}/{subject}/skills/{skillId}     label, prereqSkillIds[]

parents/{parentId}                     linkedStudentIds[], briefPrefs
parents/{parentId}/briefs/{briefId}    studentId, uzbekText, conversationStarters[], ts
```

Keep this in sync with the code. Credentials are **never** stored here in plaintext — see
`CLAUDE.md` § 4.

---

## 9. emaktab ingestion

- **Posture:** user-authorized data access — the parent/student provides *their own* emaktab
  login; the agent acts as their browser, on their behalf. Same legal model as Plaid or a
  password manager. Frame it as "the same data they would see logged in — we just structure
  it for AI." Never call it "scraping" to judges.
- **Mechanism:** Playwright, server-side, per consented account.
- **Hackathon reality:** pull and **cache** 1–3 accounts before the demo. The live demo runs
  entirely on cached Firestore data. No network dependency on stage.
- **Credentials:** encrypted at rest (KMS-style envelope encryption), zero credential logging,
  deleted after the event.

---

## 10. The moat — restated for the pitch

Remove Gemini and replace it with any frontier model. Scorpius still works, because the product is:

1. the **emaktab data signal** — a real student's real grades (proprietary, not a model);
2. the **Knowledge Tracer** — our BKT state per skill;
3. the **Curriculum RAG** — our Uzbek textbook index + skill graph;
4. the **Orchestrator** — our routing logic;
5. the **Quiz DSL + renderer** — our UX system;
6. the **Parent intelligence layer** — our generation pipeline.

A wrapper has none of these. Scorpius is all of them. The model is the engine; the car is ours.
