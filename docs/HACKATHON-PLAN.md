# Hackathon Plan — Build with AI: EdTech Hackathon

> Source of truth for *why we win* and *what we build by when*. Facts below are from the
> official GDG event page. Strategy is ours and may be revised — facts may not.

---

## 1. The hackathon (facts)

| | |
|---|---|
| Event | Build with AI: EdTech Hackathon (follows the earlier EdTech Ideathon) |
| Organizer | GDG Tashkent (Google Developer Group) |
| Partners | New Uzbekistan University · **SQB** (commercial bank) |
| Venue | New Uzbekistan University, Tashkent |
| Dates | **23–24 May 2026** (event window 09:00 May 23 → 19:00 May 24, Tashkent time) |
| Themes stamped on the event | **AI · Gemini · Build with AI · Google Cloud** |
| Prize path | Top teams → **Idrock Startup Accelerator** (summer 2026); winners → SQB / SQB Ventures prizes |
| Scale | ~411 RSVPs |

**What this is NOT:** not the National AI Hackathon, not a government event. There is no
Ministry of Education in the room. Any "Ministry alignment" angle from the earlier strategic
brief is **dead** — discard it.

---

## 2. Who judges, and what they reward

The room is **GDG organizers + SQB / SQB Ventures + New Uzbekistan University**. They are
developers, bankers, and an accelerator. They reward, in order:

1. **A real working build** — not slides, not vaporware. Something on screen that responds.
2. **Fundable-startup shape** — clear problem, clear user, a believable path to revenue and
   scale. SQB Ventures and Idrock are literally selecting for their next cohort.
3. **Gemini / Google Cloud usage** — it is a GDG "Build with AI" event. Being Google-native
   is table stakes for judge goodwill.
4. **Team can execute** — a clean demo, a tight pitch, a team that clearly shipped this.

**Therefore the pitch is framed as a startup, not a school project.** The accelerator selection
is the real prize — optimize for "this team should be in the summer cohort."

---

## 3. Positioning — why Scorpius wins this room

- **The problem is universally felt.** emaktab is Uzbekistan's national gradebook; its operator
  Kundalik reports 33M+ users across the region. Every parent and student in that ecosystem
  has felt the pain of a context-free grade. The judges have felt it themselves.
- **The wedge is unique.** Khanmigo and Gemini Guided Learning are not personalized to a
  specific Uzbek child's specific Tuesday lesson. Scorpius is — because it reads real emaktab data.
- **It is not a wrapper.** Lead with the agent layer + knowledge model + curriculum RAG. The
  LLM is one swappable component. (See `docs/ARCHITECTURE.md` § Moat.)
- **The parent layer is the emotional close.** "We teach the parent the lesson too" is novel
  and lands hard with a room of judges who are mostly parents.

**Do NOT** present this as Humopedia. Net-new team framing, net-new name.

---

## 4. The demo (5 minutes, scripted, no live scraping)

All emaktab data is **pre-pulled and cached** before the demo. The browser shows the product;
nothing depends on the venue network mid-pitch.

| Time | Beat |
|------|------|
| 0:00–0:45 | **The hook.** A real emaktab notification: *"Aziza got a 2 in History today."* A grade, no context. Every parent has felt this. |
| 0:45–1:30 | **Scorpius's version of the same event** — a Telegram-style brief in Uzbek: what she struggled with, the lesson it traces back to, a 10-min plan, two conversation starters for the parent. |
| 1:30–3:15 | **Live student flow.** A judge plays Aziza. Opens a lesson → TikTok-style vertical-swipe cards, grounded in her real Grade-9 textbook page. She gets one wrong → Scorpius does **not** give the answer; it asks the next unblocking question. She gets it. The skill bar moves: `P(mastered)` 0.3 → 0.58. |
| 3:15–4:00 | **The second subject.** Switch to Grade-9 Math (quadratics). Same engine, different content pack — shows breadth without shallowness. Photo a homework problem → Socratic walkthrough. |
| 4:00–5:00 | **The close.** "Built in ~34 hours on Gemini and emaktab data. The agents, the knowledge model, and the curriculum index are ours — the model is swappable. With API access this ships to every school family in Uzbekistan. This is a company, not a hackathon project." |

The single most memorable moment is the **parent brief**. Make it beautiful.

---

## 5. Scope — IN vs OUT

### IN (the 34-hour build)
- Next.js web app, Firebase backend, Gemini behind a model adapter.
- emaktab ingestion → cached data for 1–3 consented Grade-9 accounts.
- Curriculum content packs: **Grade 9 Math (one unit — quadratic equations)** and
  **Grade 9 History (one unit)**. ~6 lessons each.
- Agent layer: Lesson Curator, Socratic Tutor, Quiz Generator (see ARCHITECTURE).
- Quiz DSL + card renderer with vertical-swipe deck.
- BKT knowledge tracer with a visible `P(mastered)` bar.
- Parent brief generator (Uzbek text).
- Photo-homework upload → Socratic help.

### OUT — Cut List / Roadmap (parked, not forgotten)
Park these here so nobody builds them mid-hackathon. They are the post-hackathon roadmap and
the "where this goes" slide in the pitch:

- Real-time voice + AI avatar teacher — pitch as roadmap; ship a text/voice mock only if time.
- Live per-question AI image generation — use pre-made/static visuals for the demo.
- All grades 1–12 — only Grade 9 in the build.
- Native Android app — web only.
- Live emaktab scraping during use — demo uses cached data.
- Spaced-repetition scheduler, school/teacher dashboards, payments.

---

## 6. Build timeline

The build runs as **7 milestones (M0–M6)**, each a complete and demoable vertical slice. The
full milestone table, the definition-of-done for each, and the parallel tracks live in the
master plan: **`docs/PROJECT-PLAN.md` § 5**. This section is a pointer so the two never drift.

---

## 7. Top risks & mitigations

| Risk | Mitigation |
|------|-----------|
| emaktab scrape fragile / captcha | Pull and cache **before** the event; demo never hits the live site. |
| Two subjects double the content work | Engine is subject-agnostic; cap to one unit each; build engine once. |
| Gemini latency makes swiping feel slow | Pre-generate the demo lesson's cards; stream; cache aggressively. |
| "It's just a Gemini wrapper" objection | Lead the pitch with the agent layer + data moat (ARCHITECTURE § Moat). |
| Scope creep mid-hackathon | Cut List in § 5 is frozen. New ideas go there, not into code. |
| Demo network failure | Everything demo-critical runs on cached data / local state. |
