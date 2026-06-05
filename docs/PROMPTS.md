# Diagram prompt style guide

> Recipe for authoring `diagram` card prompts in `lib/lesson.ts`. Every prompt
> the human team (or the future Lesson Curator agent) writes should follow
> this template — it's how the existing 5 prompts produce consistent textbook
> aesthetic on `gpt-image-2`.

## Template

```
[Subject context] + [Composition] + [Stylistic constraints] + [Negatives]
```

## Required clauses (every prompt)

- `no text labels` — keeps labels from garbling; the card's `caption` field
  carries the Uzbek narration text beneath the image
- `no watermarks` — suppresses spurious signatures
- `textbook physics aesthetic` OR `textbook math aesthetic` OR
  `textbook biology aesthetic` — keeps style consistent across subjects
- `warm cream background` — visual brand cohesion (matches Scorpius palette)
- `vector illustration style` + `soft pencil-line shading` — proven combo

## Avoid

- ✗ Uzbek text in the prompt (model is unreliable on Uzbek text rendering;
  including it degrades the whole image, not just the labels)
- ✗ Multiple unrelated objects in one image — split into two `diagram` cards
- ✗ "Realistic" / "photorealistic" — breaks the textbook style
- ✗ Color words that conflict with the warm-cream palette (no "neon",
  "fluorescent")

## Live example (sikloid, brachistochroneLesson)

```
"Clean minimal educational physics diagram, side view, warm cream
background. A wheel rolls along a horizontal line from left to right.
A single highlighted point on the rim of the wheel traces a beautiful
arched curve above the line as the wheel rolls. Show the wheel in three
positions along the line with the traced cycloid curve drawn in a single
elegant warm gold stroke. Soft pencil-line shading, no text labels,
no watermarks, vector illustration style, textbook physics aesthetic,
generous whitespace."
```

## Workflow

1. Author the card with `type: "diagram"` + `prompt: "..."` (no `src` yet)
2. Run `npm run prebake:images` — generates the PNG, patches `src` into
   `lib/lesson.ts`
3. Open the generated PNG (`public/lesson-images/{hash}.png`) and confirm it
   matches the educational intent
4. If wrong, edit the prompt, then re-run with
   `npm run prebake:images -- --force=<lessonId>`
5. Commit the new PNG + the patched `lib/lesson.ts`

CI (`npm run verify:images`) blocks any deploy where a `diagram` card has a
`prompt` but no matching baked PNG.
