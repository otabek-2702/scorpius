# Learn Mode — the adaptive learning engine

> Codename **"Mastering v0.1"**. The pedagogy engine behind the Learn surface.
> Complements `ARCHITECTURE.md` (agents, quiz DSL) and `UX-DESIGN.md` (card UX).
> v0.1 · 2026-05-22.

## 1. The goal — mastery, not exposure

A lesson is not "done" when the cards are swiped. It is done when the student **masters**
the skill — `P(mastered) ≥ 0.85` on the Knowledge Tracer. Every choice below serves that.

## 2. The pipeline

```
emaktab grade event  →  motivating notification
  →  Curriculum RAG: find the exact lesson (grade · subject · topic)
  →  Lesson Curator: build a personalised card sequence
  →  Teach: expert-professor, concise, "eureka" cards — interest-themed
  →  Quiz: end-of-lesson check, fully covered by what was taught (§9)
  →  Knowledge Tracer (BKT): update P(mastered)
  →  mastery reached  →  the skill's star ignites
```

## 3. Content — cached for the demo, adaptive in production

- **Demo path (on stage):** every demo lesson's cards and visuals are **pre-built and
  cached** in Firestore. Zero live generation on stage — no latency, no failure (CLAUDE.md §1).
- **Production path:** the Lesson Curator generates cards **adaptively, in real time**, from
  the curriculum and the student's state.
- **Pre-build ahead:** while the student works card N, the engine generates cards N+1, N+2
  and their visuals **in the background** — the next swipe is always instant. Stream +
  look-ahead; never a spinner mid-lesson.

## 4. The agents

| Agent | Job |
|-------|-----|
| **Lesson Curator** | curriculum lesson + student state → ordered card sequence; picks interest-themed examples; guarantees quiz coverage (§9) |
| **Tutor** | teaches a card / handles "I'm stuck" — expert-professor, Socratic, never just the answer |
| **Quiz Generator** | builds the end-of-lesson quiz strictly from the taught content |
| **Knowledge Tracer** | BKT — updates `P(mastered)`; decides mastered / needs-review |
| **Visual agent** | generates or fetches the figure for a card (§6) |

The agents improve from feedback (§8) — the "reinforcement-learning-style" loop: not literal
RL training, but a feedback signal that reshapes future choices.

## 5. Personalization — interests become the lesson

At onboarding the student picks interests (football, superheroes, space…). The Lesson Curator
uses them as the **concrete material of the teaching**:
- Worked examples are framed in the interest ("a superhero carries 3 crates each trip…").
- Analogies connect the new concept to something the student already cares about.
- Not decoration — it is how an abstract idea becomes graspable. Same skill, the student's
  own world.

## 6. Visual explanations

- Model: **`gpt-image-2`** (state-of-the-art) for generated diagrams; procedural / SVG for
  charts and math figures where exactness matters.
- Demo: visuals **pre-generated and cached**. Production: generated **one card ahead** of the
  student so they appear with no lag.
- A visual is generated only when it genuinely aids understanding — not on every card.

## 7. Teaching style — expert professor, "eureka", concise

- Teach like the **best professor a student ever had**: warm, precise, never padded.
- **Concise** — every card earns its place; the shortest honest path to the idea.
- **Eureka mode** — structure each concept so the student *arrives* at the insight (a
  question → a worked example → the reveal), rather than being told it flat.
- Grounded: the textbook decides *what* is correct; the agent owns *how* it is taught
  (PROJECT-PLAN design principle).

## 8. The feedback loop — self-improving

Every example / explainer card carries optional **like / dislike** controls (lucide icons,
unobtrusive). Tapping is optional — most students won't, and that is fine.
- **Dislike** → the engine re-teaches that chunk a different way (new example, new angle)
  and avoids that pattern for this student next time.
- **Like** → reinforces that style / interest-framing for this student.
- Signals also aggregate across students to improve the Curator's default choices.
The product gets measurably better the more it is used.

## 9. Quiz-coverage guarantee

The end-of-lesson quiz must be **fully answerable from what was taught**. The Lesson Curator
and Quiz Generator share the lesson's skill list: every quiz question maps to a skill that
was explicitly taught, with an example shown. Nothing tests an off-card concept. If a student
still can't answer, the failure is *teaching* — the Tutor + re-teach loop handles it. A
coverage self-check runs before a lesson is served.

## 10. Icons

Use **`lucide-react`** — one consistent, clean line-icon style — everywhere. Emoji only as a
genuine last resort when no icon fits. Never mix icon styles.

## 11. Build phasing

- **Hackathon (M1–M2):** the demo lessons run fully on **cached** cards + visuals. The
  Curator / Tutor / Quiz agents are real and run live for the *interactive* parts (homework
  help, "I'm stuck"); the core demo lesson is pre-built for safety.
- **Phase 1:** real-time adaptive generation + background pre-build for every lesson.
- **Phase 2:** cross-student feedback aggregation; richer real-time visual generation.
