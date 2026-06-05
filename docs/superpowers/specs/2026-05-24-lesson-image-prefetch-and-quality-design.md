# Lesson Image Prefetch + Quality — Design Spec

**Date:** 2026-05-24
**Status:** Approved (sections 1–5 reviewed in brainstorming)
**Owners:** Murodjon (product), Claude (implementation)
**Related:** `docs/LEARN-MODE.md` §3 + §6 + §11, `docs/ARCHITECTURE.md` §5
**Blocks / blocked by:** Implements Phase-1 "background pre-build" intent from `LEARN-MODE.md §11`. Track D (Lesson Curator / live text generation) is a separate spec.

---

## 1. Problem

`gpt-image-1` calls inside lesson `diagram` cards take **10–30s** while the student stares at a shimmer. Today this only happens for ~6 hand-authored diagram cards across all lessons, and only after the student passes any lock-gates in front of them — the `DiagramCard` does its own `useEffect` + `fetch('/api/generate-image')` on mount, and the deck only mounts cards beyond the locked frontier.

Two compounding issues:

- **Latency**: every prompt-only diagram waits for a live OpenAI call.
- **Coverage**: only the demo lesson is genuinely "wired"; other lessons have prompts but they only generate when (and if) the student reaches them.

The fix from `LEARN-MODE.md §3` is "pre-build ahead — while the student works card N, the engine generates cards N+1, N+2 and their visuals in the background — the next swipe is always instant." This spec implements that for images, and goes one step further: bakes every static lesson's diagrams **at build time** so the deploy ships with them already cached as static assets.

## 2. Scope

**In scope (Tracks A + B + C):**

- **A — Prefetch architecture**: build-time pre-bake + runtime client-side fan-out
- **B — Image quality + model**: upgrade `gpt-image-1` → `gpt-image-2`, default `quality=medium` → `quality=low`, add `docs/PROMPTS.md` style guide
- **C — Coverage**: every diagram card in `lib/lesson.ts` (5 cards today) gets a pre-baked PNG shipped as a static asset

**Out of scope (deferred):**

- **D** — Lesson Curator agent, live text generation, BKT knowledge tracer (own spec)
- Streaming-PNG endpoint (`response_format=stream`) — pre-bake covers all current cards; streaming only matters once Track D produces uncached prompts at runtime
- SVG-overlay system for Uzbek labels — current pattern (no labels inside image + Uzbek caption rendered below in the card) already works
- Telemetry dashboard / analytics layer — two `console.info` lines for now
- Per-card retry / exponential backoff — add only if telemetry shows transient failures matter

## 3. Architecture

```
                ┌────────────────────────────────────────────────────┐
                │  BUILD-TIME PRE-BAKE                               │
                │  scripts/prebake-lesson-images.ts                  │
                │  Walks lib/lesson.ts → for each diagram card with  │
                │  prompt + no src, generates via gpt-image-2,       │
                │  writes PNG to public/lesson-images/{hash}.png,    │
                │  patches src into lib/lesson.ts                    │
                └────────────────────────────────────────────────────┘
                                       │ commits PNGs + patched lesson.ts
                                       ▼
                ┌────────────────────────────────────────────────────┐
                │  STATIC ASSETS — public/lesson-images/*.png        │
                │  Vercel-CDN-cached. Browser fetches in parallel.   │
                └────────────────────────────────────────────────────┘
                                       ▲
                                       │ <img src> reads directly
   ┌────────────┐    mount    ┌────────┴───────────┐
   │ LessonDeck │───────────► │ useLessonImage     │
   │            │             │ Prefetch(lesson)   │ ─── fires all card prompts
   └─────┬──────┘             └────────┬───────────┘     in parallel (cap 3)
         │                             │                  for any card that
         │ passes resolved src         │                  still has no src
         ▼                             ▼ (cache miss path)
   ┌────────────┐             ┌────────────────────┐
   │ DiagramCard│             │ POST /api/         │
   │ (renders)  │             │ generate-image     │ ── Firestore image cache
   └────────────┘             │ — gpt-image-2,     │    (already exists)
                              │   quality=low      │
                              └────────────────────┘
```

**Key architectural decisions:**

| Decision | Choice | Why |
|---|---|---|
| Where does pre-bake run? | **Local dev machine** (you run `npm run prebake:images`, PNGs commit to git) | No API key on Vercel build server, no surprise build-time cost, deterministic CI |
| Where do baked PNGs live? | **`public/lesson-images/{hash}.png`** as static assets | One HTTP request, CDN-cached, no Firestore read on hot path, parallel browser loading |
| Runtime fan-out — client or server? | **Client-side**, lifted to `LessonDeck`, not per-`DiagramCard` | Lock-gates would block per-card fetches; deck-level mount starts fetches the moment the lesson opens, before the student reads card 1 |
| Concurrency cap | **3** (build script and runtime hook) | Empirically matches `gpt-image` rate-limit headroom without needing 429-retry logic |
| Cache key | `sha256(prompt + "|" + size + "|" + quality + "|" + model).slice(0, 16)` | Same key in build script, runtime hook, and `/api/generate-image`. Adding `model` ensures `gpt-image-1` legacy cache entries don't get served as `gpt-image-2` responses |

## 4. Build-time pre-bake script

**File:** `scripts/prebake-lesson-images.ts`
**Command:** `npm run prebake:images` (added to `package.json` scripts)

**Algorithm:**

1. **Discover** — import `LESSONS_BY_ID` from `lib/lesson.ts`, walk every lesson and collect every `diagram` card. For each:
   - Compute `hash = sha256(prompt|1024x1024|low|gpt-image-2).slice(0,16)`
   - If `card.src === "/lesson-images/{hash}.png"` AND that file exists on disk → SKIP
   - Otherwise → add `{ lessonId, cardIndex, prompt, hash }` to work queue

2. **Generate** — `Promise.all` with concurrency cap **3**:
   - `generateImage(prompt, { model: "gpt-image-2", quality: "low", size: "1024x1024" })`
   - Write base64 PNG to `public/lesson-images/{hash}.png`

3. **Patch `lib/lesson.ts`** — `ts-morph` AST edit:
   - For every newly baked card, inject `src: "/lesson-images/{hash}.png"` immediately after the `prompt:` property
   - Idempotent: if `src` already exists, replace it; if not, insert
   - Sanity guard: refuse to write the file if the diff touches anything other than `src` fields inside `diagram` card objects

4. **Report**:
   ```
   ✓ skipped (cached on disk)     4 cards
   ✓ generated (new)              2 cards · 14.3s · ~$0.011
   ✗ failed                       0 cards
   ```

**Flags:**
- `--force <lessonId>` — regenerate every diagram in a specific lesson (use after editing a prompt)
- `--prune` — scan `public/lesson-images/` and delete PNGs whose hash isn't referenced by any current `src` field (handles orphaned PNGs after prompt edits)

**Failure handling:**
- One card fails → log + continue + exit non-zero at end (CI fails)
- Card without `src` still ships → runtime fan-out covers it on first viewer (~10s wait once, then cached in Firestore)

**Committed artifacts:**
- `public/lesson-images/*.png` (~50–150 KB each at `quality=low`; ~600 KB total for 5 cards) — committed to git
- `lib/lesson.ts` with `src` fields injected — committed to git

## 5. Runtime fan-out hook

**File:** `components/learn/useLessonImagePrefetch.ts` (new)

**Type:**
```ts
type ImageStatus = "idle" | "loading" | "ready" | "error";
interface ImageState { status: ImageStatus; src?: string }

function useLessonImagePrefetch(lesson: Lesson): Map<string, ImageState>;
// Map key = the diagram card's prompt string (stable identity).
```

**Behavior:**

1. **On mount**, walk `lesson.cards`. For each `type: "diagram"` card with a `prompt`:
   - If `card.src` is already set (pre-baked path) → seed map entry as `{ status: "ready", src: card.src }` — no fetch
   - Otherwise → seed as `{ status: "loading" }`, enqueue for fetch

2. **Concurrency-limited fetch queue**, cap **3**. Inline implementation (~20 LOC, no new dep):

   ```ts
   const queue = [...promptsToFetch];
   const running = new Set<Promise<unknown>>();
   while (queue.length || running.size) {
     while (running.size < 3 && queue.length) {
       const p = fetchOne(queue.shift()!).finally(() => running.delete(p));
       running.add(p);
     }
     await Promise.race(running);
   }
   ```

3. **`fetchOne(prompt)`** calls `POST /api/generate-image` (existing route — Firestore-cached → instant on cache hit, ~5–10s at `quality=low` on miss). Updates map entry to `{ status: "ready", src }` or `{ status: "error" }`.

4. **`AbortController` on unmount** — if student backs out of the lesson mid-fetch, in-flight `gpt-image-2` requests are cancelled. No cost paid, no Firestore write.

5. **No retry logic** — first failure marks errored; existing `DiagramCard` error UI takes over. YAGNI for now.

6. **Telemetry**:
   ```
   [scorpius] image prefetch: 5 cards, 3 pre-baked, 2 fetching
   [scorpius] image prefetch: complete · 2.4s · 2/2 ok
   ```

## 6. DiagramCard refactor

**File:** `components/learn/cards.tsx` — replace existing `DiagramCard` (lines 637–710).

Currently each `DiagramCard` runs its own `useEffect` + `fetch('/api/generate-image')` on mount. After refactor it becomes a pure render of an `ImageState` prop:

```tsx
function DiagramCard({ card, subjectLabel, imageState }: {
  card: Extract<Card, { type: "diagram" }>;
  subjectLabel: string;
  imageState?: ImageState;  // undefined for cards with neither prompt nor src
}) {
  const src = imageState?.src ?? card.src;
  const status: ImageStatus =
    src ? "ready" :
    imageState?.status === "error" ? "error" :
    "loading";
  // ... existing render logic, switched on `status` instead of internal state
}
```

`LessonDeck` (`components/learn/LessonDeck.tsx:16`):

```tsx
export function LessonDeck({ lesson }: { lesson: Lesson }) {
  const imageStates = useLessonImagePrefetch(lesson);  // one line, top of component
  // ... existing logic unchanged
  // when rendering DiagramCard:
  //   <DiagramCard card={card} ... imageState={imageStates.get(card.prompt!)} />
}
```

**Why lift state up:** the deck mounts the hook *before* the lock-gate logic walls off later cards. So prefetch starts for every card in the lesson, even cards still hidden behind an unanswered `mcq`. If state stayed in `DiagramCard`, prefetch couldn't start until that card mounted — same latency we have today.

## 7. Image model + prompt discipline (Track B)

### 7.1 `lib/ai/image.ts`

```diff
- export interface GenerateImageOpts {
-   size?: "1024x1024" | "1024x1536" | "1536x1024";
-   quality?: "low" | "medium" | "high";
- }
+ export interface GenerateImageOpts {
+   size?: "1024x1024" | "1024x1536" | "1536x1024";
+   quality?: "low" | "medium" | "high";
+   model?: "gpt-image-2" | "gpt-image-1";  // gpt-image-1 kept as escape hatch
+ }

  // in the fetch body:
-   model: "gpt-image-1",
+   model: opts.model ?? "gpt-image-2",
-   quality: opts.quality ?? "medium",
+   quality: opts.quality ?? "low",
```

### 7.2 `app/api/generate-image/route.ts`

- Accept optional `model` field on POST body, pass through to `generateImage`
- Default `quality` to `"low"` (same as the library default — keep them aligned)
- Include `model` in the cache hash:
  ```diff
  - .update(`${prompt}|${size}|${quality}`)
  + .update(`${prompt}|${size}|${quality}|${model}`)
  ```
  Legacy `gpt-image-1` cache entries stay untouched but cease to be served; first `gpt-image-2` call for any prompt is a regenerate. Acceptable one-time cost.

### 7.3 `docs/PROMPTS.md` (new, ~1 page)

A short prompt-style guide that codifies what your current 5 prompts already do well:

```
Scorpius diagram prompt template
================================

[Subject context] + [Composition] + [Stylistic constraints] + [Negatives]

Required clauses (every prompt):
  ✓ "no text labels"           → labels never garble; caption text lives in DSL
  ✓ "no watermarks"            → suppresses spurious signatures
  ✓ "textbook physics aesthetic" OR "textbook math aesthetic"
  ✓ "warm cream background"    → visual brand cohesion
  ✓ "vector illustration style" + "soft pencil-line shading"

Avoid:
  ✗ Uzbek text in the prompt (model is unreliable on Uzbek; degrades whole image)
  ✗ Multiple unrelated objects in one image — split into two diagram cards
  ✗ "Realistic" / "photorealistic" — breaks the textbook style
```

The doc reads as a recipe for whoever (human or future Lesson Curator agent) authors the next diagram prompt.

## 8. Coverage (Track C)

**Diagram cards in `lib/lesson.ts` today** (5):

| Lesson | Card heading |
|---|---|
| `brachistochrone` | Sikloid qanday hosil bo'ladi |
| `broun` | Mikroskop ostida nima ko'rinadi |
| `arximed` | Suvda jism: ikki kuch |
| `tutilish` | Uchta jism, bitta soya |
| `kamalak` | Prizma orqali oq nur |

After first `npm run prebake:images` run, every one of these ships with a baked PNG — every existing lesson is "wired", not "demo only." Future diagram cards follow the workflow: add card with prompt → `npm run prebake:images` → commit.

**CI check** (`scripts/verify-lesson-images.ts`): fails the build if any `diagram` card has a `prompt` but no matching `public/lesson-images/{hash}.png` on disk. Added to `npm run build` or a separate `npm run verify`. Catches "forgot to bake" before deploy.

## 9. Failure modes

| Failure | What happens | Recovery |
|---|---|---|
| Pre-bake API call fails | Script logs + exits non-zero; card ships without `src` | Runtime fan-out generates on first viewer (~10s once, cached after) |
| Runtime fetch fails (cache miss + `gpt-image-2` down) | `ImageState.status = "error"` → existing Uzbek error UI | User retry by re-opening lesson; pre-bake + Firestore cache make repeats rare |
| User backs out mid-prefetch | `AbortController` fires; in-flight requests cancelled | Zero cost, zero Firestore write |
| `public/lesson-images/{hash}.png` 404 | Browser shows broken image | `--prune` flag + CI check catch this; re-run prebake |
| Two concurrent requests for same uncached prompt | Both generate, both write same Firestore doc (last-write-wins, same content) | Wasted ~$0.005 once; not worth a request-dedup layer |
| OpenAI rate-limit (429) on bake | Honor `Retry-After`, sleep, retry up to 3× | Concurrency cap of 3 makes 429s rare; surfaced in logs |

## 10. Testing strategy

**Unit / component (Jest + RTL, already configured):**

- `useLessonImagePrefetch.test.tsx`:
  - Lesson where all cards have `src` → hook completes, `fetch` mock NOT called
  - Mixed `src` / `prompt`-only → only `prompt`-only fetched
  - One fetch fails → others still resolve; failed card has `status: "error"`
- `DiagramCard.test.tsx`: render each `ImageState` status, assert correct UI
- **Concurrency cap test**: 6 unbaked diagrams, mock `fetch`, assert never more than 3 in flight

**Manual verification (the rule that matters):**

```
npm run prebake:images
git status                   # 5 PNGs in public/lesson-images/ + patched lesson.ts
npm run dev
# open /learn/lesson?topic=broun
# DevTools Network: NO call to /api/generate-image
# image renders from /lesson-images/{hash}.png on first paint, no shimmer
```

After deploy:

```
curl -sSI https://scorpius.uz/lesson-images/{hash}.png   # 200 OK from Vercel CDN
# visit /learn/lesson?topic=broun on mobile — image appears instant
```

## 11. Files touched

**New:**
- `scripts/prebake-lesson-images.ts`
- `scripts/verify-lesson-images.ts`
- `components/learn/useLessonImagePrefetch.ts`
- `components/learn/useLessonImagePrefetch.test.tsx`
- `docs/PROMPTS.md`
- `public/lesson-images/*.png` (5 PNGs, generated)

**Modified:**
- `lib/ai/image.ts` — add `model` opt, default `gpt-image-2` + `quality=low`
- `app/api/generate-image/route.ts` — accept `model`, include in cache hash, default `quality=low`
- `components/learn/cards.tsx` — `DiagramCard` becomes pure render of `imageState` prop
- `components/learn/LessonDeck.tsx` — wire `useLessonImagePrefetch`, pass `imageState` to each `DiagramCard`
- `lib/lesson.ts` — `src` field injected on each diagram card (done by the bake script)
- `package.json` — add `"prebake:images": "tsx scripts/prebake-lesson-images.ts"` (and `verify:images`)

## 12. Open questions

None remaining. Spec is implementation-ready.

## 13. Out-of-scope decisions, captured for the next spec (Track D)

- Lesson Curator agent — LLM-generates `Card[]` per topic from curriculum + student state
- Knowledge tracer (BKT) — `P(mastered)` per skill; updates after quiz
- Quiz coverage guarantee — coverage self-check before serving a lesson
- Streaming PNG endpoint — `response_format=stream` for dynamic prompts that aren't pre-baked
- Real-time text streaming pattern equivalent to `useLessonImagePrefetch` but for LLM card-body text

These earn their own brainstorm cycle.
