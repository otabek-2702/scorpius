# Lesson Image Prefetch + Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate `gpt-image` latency inside lesson `diagram` cards by pre-baking every static lesson's images as committed `public/lesson-images/*.png` static assets, and by lifting image fetching from per-card `useEffect` to a deck-level parallel prefetch hook. Also upgrade the model to `gpt-image-2` with `quality=low`.

**Architecture:** Build-time pre-bake script generates each diagram once via OpenAI, writes the PNG to `public/lesson-images/{hash}.png`, and patches `lib/lesson.ts` (via `ts-morph` AST edit) to set `src` on the card. At runtime, a new `useLessonImagePrefetch` hook fires in `LessonDeck` and resolves every diagram's image up-front (no-op for pre-baked cards, parallel fetch with cap 3 for any that aren't). `DiagramCard` becomes a pure render of an `ImageState` prop.

**Tech Stack:** Next.js 16, TypeScript, OpenAI `gpt-image-2`, Firestore (existing image cache), `ts-morph` (new — AST editing), `tsx` (already a devDep — runs the scripts).

**Spec:** `docs/superpowers/specs/2026-05-24-lesson-image-prefetch-and-quality-design.md`

---

## Phasing & Independent Shippability

| Phase | Tracks | Independently shippable? | Risk |
|---|---|---|---|
| 1 — Model + cache key upgrade | B | Yes (runtime endpoint compatible with existing UI) | Low |
| 2 — Pre-bake script + first bake of 5 PNGs | A + C | Yes (UI still uses old per-card fetch path; baked PNGs just become unused) | Low |
| 3 — CI verifier + docs/PROMPTS.md | A + B | Yes (no runtime change) | None |
| 4 — Runtime fan-out hook | A | Hook can land before being wired — no behavior change yet | Low |
| 5 — DiagramCard refactor + LessonDeck wiring | A | Yes (after this, prefetch is live; needs Phase 2 PNGs to feel "instant") | Medium |
| 6 — Verify + deploy | — | Final step | — |

Optional Phase 0 (Vitest setup) sits before Phase 4. Skip it if you don't want unit tests; manual verification in Phase 6 covers the same behavior at lower confidence.

---

## Phase 0 (OPTIONAL): Set up Vitest

> Spec §10 calls for unit tests with "Jest + RTL, already configured" — but the repo has no test runner. This phase sets up Vitest (smaller config than Jest, native to Vite/modern Next ecosystem). Skip this whole phase if you don't want unit tests; Phases 4 and 5 each have a manual-verify alternative.

### Task 0.1: Install Vitest + Testing Library

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install deps**

```bash
npm install --save-dev vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

Expected: 5 new devDependencies in `package.json`.

- [ ] **Step 2: Verify install**

```bash
npx vitest --version
```

Expected: prints a version like `1.x.x` or `2.x.x`. No errors.

### Task 0.2: Vitest config + test setup file

**Files:**
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
```

- [ ] **Step 2: Create `vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

### Task 0.3: Add `test` script to package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the script**

Find the `"scripts"` block in `package.json` and add the `test` entry:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 2: Smoke-test the runner**

Create a throwaway `temp.test.ts` at repo root:

```ts
import { describe, it, expect } from "vitest";
describe("smoke", () => {
  it("runs", () => { expect(1 + 1).toBe(2); });
});
```

Run:

```bash
npm test
```

Expected: 1 passed.

- [ ] **Step 3: Delete the smoke test**

```bash
rm temp.test.ts
```

### Task 0.4: Commit Phase 0

- [ ] **Step 1: Stage + commit**

```bash
git add package.json package-lock.json vitest.config.ts vitest.setup.ts
git commit -m "chore: add Vitest + Testing Library for unit tests

Spec docs/superpowers/specs/2026-05-24-lesson-image-prefetch-and-quality-design.md
§10 calls for unit tests; project had no test runner. Vitest because it's
the lightest setup that works well with Next 16 + React 19.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase 1 — Track B: Model + cache key upgrade

### Task 1.1: Upgrade `lib/ai/image.ts` to gpt-image-2 + quality=low default

**Files:**
- Modify: `lib/ai/image.ts`

- [ ] **Step 1: Read current contents to confirm line numbers**

```bash
cat lib/ai/image.ts
```

Expected: see the existing `GenerateImageOpts` interface and `generateImage` function from spec §7.1.

- [ ] **Step 2: Edit `GenerateImageOpts` interface**

Replace lines 13–18 of `lib/ai/image.ts` (the `GenerateImageOpts` interface):

```ts
export interface GenerateImageOpts {
  /** 1024x1024 (default), 1024x1536 (portrait), 1536x1024 (landscape). */
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  /** "low" is fast & cheap and is the default (best for educational diagrams). */
  quality?: "low" | "medium" | "high";
  /** Defaults to "gpt-image-2". "gpt-image-1" kept as escape hatch. */
  model?: "gpt-image-2" | "gpt-image-1";
}
```

- [ ] **Step 3: Edit the `fetch` body inside `generateImage`**

Find this block in `generateImage`:

```ts
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      n: 1,
      size: opts.size ?? "1024x1024",
      quality: opts.quality ?? "medium",
    }),
```

Replace with:

```ts
    body: JSON.stringify({
      model: opts.model ?? "gpt-image-2",
      prompt,
      n: 1,
      size: opts.size ?? "1024x1024",
      quality: opts.quality ?? "low",
    }),
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: exit 0, no output.

### Task 1.2: Update `/api/generate-image` route to accept `model` + use it in cache key

**Files:**
- Modify: `app/api/generate-image/route.ts`

- [ ] **Step 1: Update the POST body type**

In `app/api/generate-image/route.ts`, find the `body` variable declaration near the top of `POST`:

```ts
  let body: { prompt?: string; size?: GenerateImageOpts["size"]; quality?: GenerateImageOpts["quality"] };
```

Replace with:

```ts
  let body: {
    prompt?: string;
    size?: GenerateImageOpts["size"];
    quality?: GenerateImageOpts["quality"];
    model?: GenerateImageOpts["model"];
  };
```

- [ ] **Step 2: Default `quality` to `"low"` and read `model`**

Find these lines:

```ts
  const size = body.size ?? "1024x1024";
  const quality = body.quality ?? "medium";
```

Replace with:

```ts
  const size = body.size ?? "1024x1024";
  const quality = body.quality ?? "low";
  const model = body.model ?? "gpt-image-2";
```

- [ ] **Step 3: Include `model` in the cache hash**

Find:

```ts
  const hash = crypto
    .createHash("sha256")
    .update(`${prompt}|${size}|${quality}`)
    .digest("hex")
    .slice(0, 32);
```

Replace with:

```ts
  const hash = crypto
    .createHash("sha256")
    .update(`${prompt}|${size}|${quality}|${model}`)
    .digest("hex")
    .slice(0, 32);
```

- [ ] **Step 4: Pass `model` to `generateImage` call**

Find:

```ts
    const out = await generateImage(prompt, { size, quality });
```

Replace with:

```ts
    const out = await generateImage(prompt, { size, quality, model });
```

- [ ] **Step 5: Add `model` to the Firestore document**

Find:

```ts
    await ref.set({
      b64,
      prompt,
      size,
      quality,
      createdAt: new Date().toISOString(),
    });
```

Replace with:

```ts
    await ref.set({
      b64,
      prompt,
      size,
      quality,
      model,
      createdAt: new Date().toISOString(),
    });
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```

Expected: exit 0.

### Task 1.3: Build + smoke verify locally

- [ ] **Step 1: Build**

```bash
npm run build
```

Expected: completes with "✓ Compiled successfully" and lists the routes including `ƒ /api/generate-image`.

- [ ] **Step 2: Start dev server in background**

```bash
npm run dev &
```

Wait ~5 seconds for it to bind.

- [ ] **Step 3: Smoke-test the endpoint**

```bash
curl -sS -X POST http://localhost:3000/api/generate-image \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"a simple test circle on white background"}' | head -c 200
```

Expected: response starts with `{"src":"data:image/png;base64,...` or `{"src":...,"cached":true}` if Firestore already has it. NOT an error JSON.

- [ ] **Step 4: Stop dev server**

```bash
# find the npm dev process and kill it (use the PID from step 2 or)
pkill -f "next dev" || true
```

### Task 1.4: Commit Phase 1

- [ ] **Step 1: Stage + commit**

```bash
git add lib/ai/image.ts app/api/generate-image/route.ts
git commit -m "feat: upgrade image gen to gpt-image-2 + quality=low default

- lib/ai/image.ts: add 'model' option, default to 'gpt-image-2'.
  Default quality changes to 'low' (educational diagrams look identical;
  ~60% faster, ~97% cheaper per research notes from brainstorming).
- app/api/generate-image/route.ts: accept model in POST body, include
  in cache hash (legacy gpt-image-1 entries stay untouched, first
  gpt-image-2 call for any prompt regenerates — acceptable one-time).

Spec §7. Track B.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase 2 — Pre-bake script + first bake

### Task 2.1: Install `ts-morph`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
npm install --save-dev ts-morph
```

Expected: `ts-morph` added under `devDependencies`.

### Task 2.2: Add npm script for the pre-bake

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add scripts**

In `package.json` `scripts` block, add:

```json
"prebake:images": "tsx scripts/prebake-lesson-images.ts",
"prebake:images:prune": "tsx scripts/prebake-lesson-images.ts --prune"
```

### Task 2.3: Create the pre-bake script

**Files:**
- Create: `scripts/prebake-lesson-images.ts`
- Create: `public/lesson-images/` (directory — created by script on first run, but we create + add a `.gitkeep` so git tracks the empty dir before the first bake)

- [ ] **Step 1: Create the directory + .gitkeep**

```bash
mkdir -p public/lesson-images
touch public/lesson-images/.gitkeep
```

- [ ] **Step 2: Write `scripts/prebake-lesson-images.ts`**

Create the file with this complete content:

```ts
/**
 * Pre-bake every `diagram` card's image into public/lesson-images/{hash}.png and
 * patch lib/lesson.ts so each card carries the resulting `src`. After a clean
 * run, every static lesson ships with images already cached as static assets —
 * the runtime fan-out hook becomes a no-op for the pre-baked path.
 *
 * Usage:
 *   npm run prebake:images              # bake what's missing
 *   npm run prebake:images -- --force=brachistochrone   # bake a specific lesson
 *   npm run prebake:images:prune        # also delete orphaned PNGs
 *
 * Spec: docs/superpowers/specs/2026-05-24-lesson-image-prefetch-and-quality-design.md §4
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Project, SyntaxKind, type ObjectLiteralExpression } from "ts-morph";
import { generateImage } from "../lib/ai/image";
import { LESSONS_BY_ID } from "../lib/lesson";

const REPO_ROOT = path.resolve(__dirname, "..");
const IMAGES_DIR = path.join(REPO_ROOT, "public", "lesson-images");
const LESSON_FILE = path.join(REPO_ROOT, "lib", "lesson.ts");
const CONCURRENCY = 3;
const SIZE = "1024x1024" as const;
const QUALITY = "low" as const;
const MODEL = "gpt-image-2" as const;

interface WorkItem {
  lessonId: string;
  cardIndex: number;
  prompt: string;
  hash: string;
  expectedSrc: string;
}

function hashPrompt(prompt: string): string {
  return crypto
    .createHash("sha256")
    .update(`${prompt}|${SIZE}|${QUALITY}|${MODEL}`)
    .digest("hex")
    .slice(0, 16);
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function discover(forceLessonId: string | null): Promise<{
  toBake: WorkItem[];
  skipped: number;
  allItems: WorkItem[];
}> {
  const toBake: WorkItem[] = [];
  const allItems: WorkItem[] = [];
  let skipped = 0;
  for (const [lessonId, lesson] of Object.entries(LESSONS_BY_ID)) {
    for (let i = 0; i < lesson.cards.length; i++) {
      const card = lesson.cards[i];
      if (card.type !== "diagram" || !card.prompt) continue;
      const hash = hashPrompt(card.prompt);
      const expectedSrc = `/lesson-images/${hash}.png`;
      const item: WorkItem = { lessonId, cardIndex: i, prompt: card.prompt, hash, expectedSrc };
      allItems.push(item);
      const fileOnDisk = path.join(IMAGES_DIR, `${hash}.png`);
      const isForced = forceLessonId !== null && lessonId === forceLessonId;
      const alreadyDone = card.src === expectedSrc && (await fileExists(fileOnDisk));
      if (alreadyDone && !isForced) {
        skipped++;
        continue;
      }
      toBake.push(item);
    }
  }
  return { toBake, skipped, allItems };
}

async function bakeOne(item: WorkItem): Promise<void> {
  const { b64 } = await generateImage(item.prompt, {
    model: MODEL,
    quality: QUALITY,
    size: SIZE,
  });
  const filePath = path.join(IMAGES_DIR, `${item.hash}.png`);
  await fs.writeFile(filePath, Buffer.from(b64, "base64"));
}

async function bakeAll(items: WorkItem[]): Promise<{ ok: WorkItem[]; failed: { item: WorkItem; err: Error }[] }> {
  const ok: WorkItem[] = [];
  const failed: { item: WorkItem; err: Error }[] = [];
  const queue = [...items];
  const running = new Set<Promise<void>>();
  while (queue.length || running.size) {
    while (running.size < CONCURRENCY && queue.length) {
      const item = queue.shift()!;
      const p = (async () => {
        try {
          await bakeOne(item);
          ok.push(item);
          console.log(`  ✓ ${item.lessonId}[${item.cardIndex}] → ${item.expectedSrc}`);
        } catch (err) {
          failed.push({ item, err: err instanceof Error ? err : new Error(String(err)) });
          console.error(`  ✗ ${item.lessonId}[${item.cardIndex}]: ${err}`);
        }
      })();
      const tracked = p.finally(() => running.delete(tracked));
      running.add(tracked);
    }
    if (running.size) await Promise.race(running);
  }
  return { ok, failed };
}

/**
 * Patch lib/lesson.ts to inject/replace the `src` field on each baked diagram
 * card. Uses ts-morph AST so we don't touch comments or formatting.
 *
 * Sanity guard: only touches diagram cards whose `prompt` matches our work
 * item's prompt; refuses to write the file if the diff would touch anything
 * else.
 */
async function patchLessonFile(items: WorkItem[]): Promise<void> {
  if (items.length === 0) return;
  const project = new Project({ tsConfigFilePath: path.join(REPO_ROOT, "tsconfig.json") });
  const sf = project.addSourceFileAtPath(LESSON_FILE);

  let edits = 0;
  sf.forEachDescendant((node) => {
    if (node.getKind() !== SyntaxKind.ObjectLiteralExpression) return;
    const obj = node as ObjectLiteralExpression;
    const typeProp = obj.getProperty("type");
    if (!typeProp || typeProp.getKind() !== SyntaxKind.PropertyAssignment) return;
    const typeInit = (typeProp as ReturnType<ObjectLiteralExpression["getPropertyOrThrow"]>)
      .asKindOrThrow(SyntaxKind.PropertyAssignment)
      .getInitializer();
    if (!typeInit || typeInit.getText() !== `"diagram"`) return;

    const promptProp = obj.getProperty("prompt");
    if (!promptProp) return;
    const promptInit = promptProp
      .asKindOrThrow(SyntaxKind.PropertyAssignment)
      .getInitializer();
    if (!promptInit) return;

    // Trim outer quotes and unescape — works for both single-line and template strings.
    let promptText = promptInit.getText().trim();
    if (promptText.startsWith('"') && promptText.endsWith('"')) {
      promptText = JSON.parse(promptText) as string;
    } else if (promptText.startsWith("`") && promptText.endsWith("`")) {
      promptText = promptText.slice(1, -1);
    }

    const matching = items.find((it) => it.prompt === promptText);
    if (!matching) return;

    const existingSrc = obj.getProperty("src");
    const srcLiteral = `"${matching.expectedSrc}"`;
    if (existingSrc) {
      existingSrc
        .asKindOrThrow(SyntaxKind.PropertyAssignment)
        .setInitializer(srcLiteral);
    } else {
      // Insert `src` immediately after `prompt`
      const promptIndex = obj.getProperties().indexOf(promptProp);
      obj.insertPropertyAssignment(promptIndex + 1, {
        name: "src",
        initializer: srcLiteral,
      });
    }
    edits++;
  });

  if (edits !== items.length) {
    throw new Error(
      `expected to patch ${items.length} diagram cards but matched ${edits}; refusing to write lib/lesson.ts`,
    );
  }

  await sf.save();
  console.log(`\n  patched ${edits} diagram card(s) in lib/lesson.ts`);
}

async function prune(allItems: WorkItem[]): Promise<number> {
  const expectedFiles = new Set(allItems.map((it) => `${it.hash}.png`));
  const filesOnDisk = await fs.readdir(IMAGES_DIR).catch(() => [] as string[]);
  let removed = 0;
  for (const f of filesOnDisk) {
    if (f === ".gitkeep") continue;
    if (!f.endsWith(".png")) continue;
    if (!expectedFiles.has(f)) {
      await fs.unlink(path.join(IMAGES_DIR, f));
      console.log(`  pruned ${f}`);
      removed++;
    }
  }
  return removed;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const forceArg = args.find((a) => a.startsWith("--force="));
  const forceLessonId = forceArg ? forceArg.slice("--force=".length) : null;
  const shouldPrune = args.includes("--prune");

  await fs.mkdir(IMAGES_DIR, { recursive: true });

  const { toBake, skipped, allItems } = await discover(forceLessonId);
  console.log(`\ndiscovered ${allItems.length} diagram card(s):`);
  console.log(`  ${skipped} already baked (skipped)`);
  console.log(`  ${toBake.length} to bake\n`);

  if (toBake.length === 0 && !shouldPrune) {
    console.log("nothing to do.");
    return;
  }

  const t0 = Date.now();
  const { ok, failed } = toBake.length ? await bakeAll(toBake) : { ok: [], failed: [] };
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  if (ok.length) await patchLessonFile(ok);

  let pruned = 0;
  if (shouldPrune) pruned = await prune(allItems);

  console.log("");
  console.log(`  ✓ skipped (cached on disk)     ${skipped} card(s)`);
  console.log(`  ✓ generated (new)              ${ok.length} card(s) · ${elapsed}s`);
  console.log(`  ✗ failed                       ${failed.length} card(s)`);
  if (shouldPrune) console.log(`  ⌫ pruned orphan PNGs           ${pruned} file(s)`);
  console.log("");

  if (failed.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Verify it type-checks**

```bash
npx tsc --noEmit
```

Expected: exit 0.

### Task 2.4: First run — bake all 5 PNGs

- [ ] **Step 1: Make sure `.env.local` has `OPENAI_API_KEY`**

```bash
grep -E "^OPENAI_API_KEY=" .env.local && echo "key present" || echo "MISSING — set OPENAI_API_KEY in .env.local before running"
```

Expected: `key present`. If missing, stop and have the user add it.

- [ ] **Step 2: Bake**

```bash
npm run prebake:images
```

Expected output (approximately):
```
discovered 5 diagram card(s):
  0 already baked (skipped)
  5 to bake

  ✓ brachistochrone[6] → /lesson-images/{hash}.png
  ✓ broun[...]         → /lesson-images/{hash}.png
  ✓ arximed[...]       → /lesson-images/{hash}.png
  ✓ tutilish[...]      → /lesson-images/{hash}.png
  ✓ kamalak[...]       → /lesson-images/{hash}.png

  patched 5 diagram card(s) in lib/lesson.ts

  ✓ skipped (cached on disk)     0 card(s)
  ✓ generated (new)              5 card(s) · ~30s
  ✗ failed                       0 card(s)
```

If any fail, surface the error and re-run only the failed lesson with `npm run prebake:images -- --force=<lessonId>`.

- [ ] **Step 3: Inspect the diff to lib/lesson.ts**

```bash
git diff lib/lesson.ts | head -60
```

Expected: 5 hunks, each adding a single `src: "/lesson-images/{hash}.png",` line immediately after a `prompt:` field. NO other changes (no reformatting, no removed lines, no other property edits).

- [ ] **Step 4: Confirm the 5 PNGs exist and look reasonable in size**

```bash
ls -la public/lesson-images/*.png
```

Expected: 5 PNGs, each between 30 KB and 300 KB.

- [ ] **Step 5: Idempotency check — re-run the script**

```bash
npm run prebake:images
```

Expected output:
```
discovered 5 diagram card(s):
  5 already baked (skipped)
  0 to bake

nothing to do.
```

- [ ] **Step 6: Type-check + build**

```bash
npx tsc --noEmit && npm run build
```

Expected: both pass.

### Task 2.5: Commit Phase 2

- [ ] **Step 1: Stage + commit**

```bash
git add scripts/prebake-lesson-images.ts \
        public/lesson-images/ \
        lib/lesson.ts \
        package.json package-lock.json
git commit -m "feat: pre-bake lesson diagram images as static assets

scripts/prebake-lesson-images.ts walks LESSONS_BY_ID, generates every
diagram card's image via gpt-image-2, writes the PNG to
public/lesson-images/{hash}.png, and patches lib/lesson.ts (ts-morph
AST edit) so each card has src set. After this commit, all 5 existing
diagram cards ship with images already cached as Vercel-CDN static
assets — zero gpt-image latency on the hot path.

The script is idempotent (skips cards whose src already points at an
existing PNG), supports --force=<lessonId> to regenerate after editing
a prompt, and --prune to clean orphan PNGs.

Spec §4 + §8.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase 3 — CI verifier + docs/PROMPTS.md

### Task 3.1: Create the CI verifier script

**Files:**
- Create: `scripts/verify-lesson-images.ts`

- [ ] **Step 1: Write the script**

```ts
/**
 * CI guard: fail if any `diagram` card has a `prompt` but no matching
 * public/lesson-images/{hash}.png on disk. Catches "forgot to bake" before
 * deploy.
 *
 * Usage: `npm run verify:images` (and added to `npm run build` chain).
 *
 * Spec: docs/superpowers/specs/2026-05-24-lesson-image-prefetch-and-quality-design.md §8
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { LESSONS_BY_ID } from "../lib/lesson";

const REPO_ROOT = path.resolve(__dirname, "..");
const IMAGES_DIR = path.join(REPO_ROOT, "public", "lesson-images");
const SIZE = "1024x1024";
const QUALITY = "low";
const MODEL = "gpt-image-2";

function hashPrompt(prompt: string): string {
  return crypto
    .createHash("sha256")
    .update(`${prompt}|${SIZE}|${QUALITY}|${MODEL}`)
    .digest("hex")
    .slice(0, 16);
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const problems: string[] = [];
  let checked = 0;
  for (const [lessonId, lesson] of Object.entries(LESSONS_BY_ID)) {
    for (let i = 0; i < lesson.cards.length; i++) {
      const card = lesson.cards[i];
      if (card.type !== "diagram" || !card.prompt) continue;
      checked++;
      const hash = hashPrompt(card.prompt);
      const expectedSrc = `/lesson-images/${hash}.png`;
      const fileOnDisk = path.join(IMAGES_DIR, `${hash}.png`);

      if (card.src !== expectedSrc) {
        problems.push(
          `${lessonId}[${i}]: card.src is ${JSON.stringify(card.src)} but expected ${JSON.stringify(expectedSrc)}. Run \`npm run prebake:images\`.`,
        );
        continue;
      }
      if (!(await fileExists(fileOnDisk))) {
        problems.push(
          `${lessonId}[${i}]: PNG missing on disk at public/lesson-images/${hash}.png. Run \`npm run prebake:images\`.`,
        );
      }
    }
  }
  console.log(`verified ${checked} diagram card(s).`);
  if (problems.length) {
    console.error("");
    for (const p of problems) console.error("  ✗ " + p);
    process.exit(1);
  }
  console.log("  ✓ all baked");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: exit 0.

### Task 3.2: Add `verify:images` npm script

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the script**

In `package.json` `scripts` block:

```json
"verify:images": "tsx scripts/verify-lesson-images.ts"
```

- [ ] **Step 2: Run it**

```bash
npm run verify:images
```

Expected:
```
verified 5 diagram card(s).
  ✓ all baked
```

- [ ] **Step 3: Negative test — temporarily delete one PNG**

Pick the first PNG in `public/lesson-images/`:

```bash
ls public/lesson-images/*.png | head -1
# note the filename, e.g. abc123def456.png
mv public/lesson-images/abc123def456.png /tmp/test-restore.png
npm run verify:images
# Expected: exits non-zero with a "PNG missing" line naming the card
mv /tmp/test-restore.png public/lesson-images/abc123def456.png
npm run verify:images
# Expected: passes again
```

### Task 3.3: Create `docs/PROMPTS.md`

**Files:**
- Create: `docs/PROMPTS.md`

- [ ] **Step 1: Write the file**

```markdown
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
```

### Task 3.4: Commit Phase 3

- [ ] **Step 1: Stage + commit**

```bash
git add scripts/verify-lesson-images.ts docs/PROMPTS.md package.json
git commit -m "feat: CI verifier for lesson images + docs/PROMPTS.md

scripts/verify-lesson-images.ts fails the build if any diagram card has
a prompt but no matching public/lesson-images/{hash}.png — catches
'forgot to bake' before deploy. Exposed as 'npm run verify:images'.

docs/PROMPTS.md codifies the prompt-style discipline the existing 5
prompts follow. Required clauses, avoid list, live example, workflow.
Reads as a recipe for whoever authors the next diagram prompt — human
or future Lesson Curator agent.

Spec §7.3 + §8.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase 4 — Runtime fan-out hook

> If Phase 0 was skipped, do only the hook implementation (Task 4.2) and skip Task 4.1 (test). Manual verification in Phase 6 still validates the behavior.

### Task 4.1 (OPTIONAL — requires Phase 0): Write the failing test for `useLessonImagePrefetch`

**Files:**
- Create: `components/learn/useLessonImagePrefetch.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useLessonImagePrefetch } from "./useLessonImagePrefetch";
import type { Lesson } from "@/lib/lesson";

const promptOnly = (heading: string, prompt: string) =>
  ({ type: "diagram" as const, heading, prompt, caption: "x" });
const baked = (heading: string, prompt: string, src: string) =>
  ({ type: "diagram" as const, heading, prompt, src, caption: "x" });

function makeLesson(cards: Lesson["cards"]): Lesson {
  return { id: "test", subject: "physics", subjectLabel: "TEST", title: "T", cards };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("useLessonImagePrefetch", () => {
  it("does not fetch when every diagram card already has src", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const lesson = makeLesson([
      baked("A", "promptA", "/lesson-images/a.png"),
      baked("B", "promptB", "/lesson-images/b.png"),
    ]);
    const { result } = renderHook(() => useLessonImagePrefetch(lesson));
    await waitFor(() => {
      expect(result.current.get("promptA")?.status).toBe("ready");
      expect(result.current.get("promptB")?.status).toBe("ready");
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches only prompt-only cards; merges with pre-baked ones", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ src: "data:image/png;base64,xxx" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const lesson = makeLesson([
      baked("A", "promptA", "/lesson-images/a.png"),
      promptOnly("B", "promptB"),
    ]);
    const { result } = renderHook(() => useLessonImagePrefetch(lesson));
    await waitFor(() => {
      expect(result.current.get("promptB")?.status).toBe("ready");
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ prompt: "promptB" });
  });

  it("marks failed fetches as error without blocking others", async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url, opts) => {
      const body = JSON.parse(opts.body as string);
      if (body.prompt === "bad") return { ok: false, json: async () => ({ error: "boom" }) };
      return { ok: true, json: async () => ({ src: "data:image/png;base64,xxx" }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    const lesson = makeLesson([promptOnly("A", "good"), promptOnly("B", "bad")]);
    const { result } = renderHook(() => useLessonImagePrefetch(lesson));
    await waitFor(() => {
      expect(result.current.get("good")?.status).toBe("ready");
      expect(result.current.get("bad")?.status).toBe("error");
    });
  });

  it("respects concurrency cap of 3", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight--;
      return { ok: true, json: async () => ({ src: "data:image/png;base64,xxx" }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    const lesson = makeLesson([
      promptOnly("A", "p1"), promptOnly("B", "p2"), promptOnly("C", "p3"),
      promptOnly("D", "p4"), promptOnly("E", "p5"), promptOnly("F", "p6"),
    ]);
    const { result } = renderHook(() => useLessonImagePrefetch(lesson));
    await waitFor(() => {
      expect(result.current.get("p6")?.status).toBe("ready");
    });
    expect(maxInFlight).toBeLessThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run — expect failures**

```bash
npm test components/learn/useLessonImagePrefetch.test.tsx
```

Expected: tests fail with "Cannot find module './useLessonImagePrefetch'". That's the red.

### Task 4.2: Create `useLessonImagePrefetch.ts`

**Files:**
- Create: `components/learn/useLessonImagePrefetch.ts`

- [ ] **Step 1: Write the hook**

```ts
"use client";

import { useEffect, useState } from "react";
import type { Lesson } from "@/lib/lesson";

export type ImageStatus = "idle" | "loading" | "ready" | "error";
export interface ImageState {
  status: ImageStatus;
  src?: string;
}

const CONCURRENCY = 3;

/**
 * Prefetches every `diagram` card's image for a lesson in parallel (cap 3).
 * Returns a Map keyed by the card's prompt string. Cards that already have
 * `src` (pre-baked path) are seeded as ready with no fetch. Cards without
 * `src` go to the network — POST /api/generate-image, Firestore-cached.
 *
 * Mounted at the deck level, BEFORE the lock-gate logic decides which cards
 * to render — so prefetch starts the moment the lesson page mounts, even for
 * cards the student hasn't unlocked yet. Unmounting aborts in-flight fetches.
 *
 * Spec: docs/superpowers/specs/2026-05-24-lesson-image-prefetch-and-quality-design.md §5
 */
export function useLessonImagePrefetch(lesson: Lesson): Map<string, ImageState> {
  const [states, setStates] = useState<Map<string, ImageState>>(() => {
    const initial = new Map<string, ImageState>();
    for (const card of lesson.cards) {
      if (card.type !== "diagram" || !card.prompt) continue;
      initial.set(
        card.prompt,
        card.src ? { status: "ready", src: card.src } : { status: "loading" },
      );
    }
    return initial;
  });

  useEffect(() => {
    const ac = new AbortController();
    const promptsToFetch: string[] = [];
    let prebakedCount = 0;

    for (const card of lesson.cards) {
      if (card.type !== "diagram" || !card.prompt) continue;
      if (card.src) {
        prebakedCount++;
        continue;
      }
      promptsToFetch.push(card.prompt);
    }

    if (promptsToFetch.length === 0) {
      console.info(
        `[scorpius] image prefetch: ${prebakedCount} cards, all pre-baked, nothing to fetch`,
      );
      return () => ac.abort();
    }

    console.info(
      `[scorpius] image prefetch: ${prebakedCount + promptsToFetch.length} cards, ${prebakedCount} pre-baked, ${promptsToFetch.length} fetching`,
    );
    const t0 = Date.now();
    let okCount = 0;
    let failCount = 0;

    async function fetchOne(prompt: string): Promise<void> {
      try {
        const r = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
          signal: ac.signal,
        });
        const data = (await r.json().catch(() => ({}))) as { src?: string; error?: string };
        if (ac.signal.aborted) return;
        if (r.ok && data.src) {
          setStates((prev) => {
            const next = new Map(prev);
            next.set(prompt, { status: "ready", src: data.src });
            return next;
          });
          okCount++;
        } else {
          setStates((prev) => {
            const next = new Map(prev);
            next.set(prompt, { status: "error" });
            return next;
          });
          failCount++;
        }
      } catch (err) {
        if (ac.signal.aborted) return;
        setStates((prev) => {
          const next = new Map(prev);
          next.set(prompt, { status: "error" });
          return next;
        });
        failCount++;
      }
    }

    (async () => {
      const queue = [...promptsToFetch];
      const running = new Set<Promise<void>>();
      while (queue.length || running.size) {
        while (running.size < CONCURRENCY && queue.length) {
          const prompt = queue.shift()!;
          const p = fetchOne(prompt);
          const tracked = p.finally(() => running.delete(tracked));
          running.add(tracked);
        }
        if (running.size) await Promise.race(running);
      }
      if (!ac.signal.aborted) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        console.info(
          `[scorpius] image prefetch: complete · ${elapsed}s · ${okCount}/${okCount + failCount} ok`,
        );
      }
    })();

    return () => ac.abort();
  }, [lesson]);

  return states;
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3 (only if Phase 0 done): Run tests — expect pass**

```bash
npm test components/learn/useLessonImagePrefetch.test.tsx
```

Expected: 4 passed.

### Task 4.3: Commit Phase 4

- [ ] **Step 1: Stage + commit**

```bash
git add components/learn/useLessonImagePrefetch.ts \
        $(test -f components/learn/useLessonImagePrefetch.test.tsx && echo components/learn/useLessonImagePrefetch.test.tsx)
git commit -m "feat: useLessonImagePrefetch — deck-level parallel image prefetch

Walks a Lesson's cards on mount, seeds ready/loading state for every
diagram card, fans out POST /api/generate-image for any that aren't
pre-baked (concurrency cap 3), aborts in-flight on unmount.

Designed to be mounted by LessonDeck BEFORE the lock-gate logic decides
which cards to render — so prefetch starts when the lesson page mounts,
not when each diagram card mounts. With Phase 2 PNGs in place, every
existing card hits the pre-baked branch and the hook does no network.

Spec §5.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase 5 — DiagramCard refactor + LessonDeck wiring

### Task 5.1: Refactor DiagramCard to a pure render of ImageState

**Files:**
- Modify: `components/learn/cards.tsx` (lines ~637–710 — the `DiagramCard` function)

- [ ] **Step 1: Add import at the top of the file**

Find the imports at the top of `components/learn/cards.tsx`. Add this line near the other `@/`-imports:

```ts
import type { ImageState } from "./useLessonImagePrefetch";
```

- [ ] **Step 2: Replace the entire `DiagramCard` function**

Find the function starting `function DiagramCard({` (around line 637) and replace the whole function (everything from `function DiagramCard` through its closing `}` at line ~710) with:

```tsx
/** A "diagram" card — renders an image (pre-baked static asset OR an image
 *  state injected by useLessonImagePrefetch). Pure render — does NOT fetch.
 *  Spec §6. */
function DiagramCard({
  card,
  subjectLabel,
  imageState,
}: {
  card: Extract<Card, { type: "diagram" }>;
  subjectLabel: string;
  imageState?: ImageState;
}) {
  const src = imageState?.src ?? card.src;
  const hasPrompt = Boolean(card.prompt);
  const isError = imageState?.status === "error";
  const isLoading = !src && hasPrompt && !isError;

  return (
    <CardShell>
      <Overline label={`${subjectLabel} · Tasvir`} />
      <h3 className="mt-3 text-[1.3rem] font-semibold leading-snug text-void-100">
        {card.heading}
      </h3>
      <div className="mt-4 overflow-hidden rounded-[18px] border border-void-500 bg-void-700">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={card.caption} className="block w-full" />
        ) : isError ? (
          <div className="flex aspect-video items-center justify-center px-4 text-center text-[13px] text-signal-rethink">
            Tasvirni yaratib bo&apos;lmadi — internetni tekshirib qayta urinib ko&apos;ring.
          </div>
        ) : isLoading ? (
          <div
            className="flex aspect-video items-center justify-center text-[13px] text-void-300"
            style={{
              background:
                "linear-gradient(110deg, rgba(232,162,26,0.05) 0%, rgba(232,162,26,0.18) 50%, rgba(232,162,26,0.05) 100%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.6s linear infinite",
            }}
          >
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Scorpius tasvirni yaratmoqda…
            </span>
          </div>
        ) : null}
      </div>
      <p className="mt-3 text-[14px] leading-relaxed text-void-200">{card.caption}</p>
    </CardShell>
  );
}
```

(Removes the `useState`, `useEffect`, and `fetch` from the old version. `src`, `isError`, `isLoading` derived from props.)

- [ ] **Step 3: Update the call site at the bottom of the file**

Find the switch arm in `LessonCardView` (or wherever `case "diagram":` lives — around line 787):

```tsx
    case "diagram":
      return <DiagramCard card={card} subjectLabel={subjectLabel} />;
```

It needs an `imageState` prop. Find where `LessonCardView` is defined; add `imageState` to its `props` type and pass it through:

In the `LessonCardView` signature (find it near line ~780), update the props type:

```tsx
export function LessonCardView({
  card,
  subjectLabel,
  onComplete,
  imageState,
}: {
  card: Card;
  subjectLabel: string;
  onComplete: () => void;
  imageState?: ImageState;
}) {
```

And update the diagram switch arm:

```tsx
    case "diagram":
      return <DiagramCard card={card} subjectLabel={subjectLabel} imageState={imageState} />;
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: exit 0. If you see "Property 'useEffect' is declared but its value is never read" or similar, remove unused imports from the top of `cards.tsx`. The new `DiagramCard` no longer uses `useEffect` or `useState` — but other cards in the same file probably still do; only remove if truly orphaned.

### Task 5.2: Wire `useLessonImagePrefetch` into `LessonDeck`

**Files:**
- Modify: `components/learn/LessonDeck.tsx`

- [ ] **Step 1: Add the import**

Near the top of `components/learn/LessonDeck.tsx`, add:

```ts
import { useLessonImagePrefetch } from "./useLessonImagePrefetch";
```

- [ ] **Step 2: Call the hook at the top of `LessonDeck`**

Inside `LessonDeck({ lesson })`, right after the existing `useState` calls (around line 17), add:

```ts
  const imageStates = useLessonImagePrefetch(lesson);
```

- [ ] **Step 3: Pass `imageState` per card when rendering `LessonCardView`**

Find the `LessonCardView` render call inside the `lesson.cards.map` (around line 135):

```tsx
              <LessonCardView
                card={card}
                subjectLabel={lesson.subjectLabel}
                onComplete={() => markComplete(i)}
              />
```

Add `imageState` prop:

```tsx
              <LessonCardView
                card={card}
                subjectLabel={lesson.subjectLabel}
                onComplete={() => markComplete(i)}
                imageState={
                  card.type === "diagram" && card.prompt
                    ? imageStates.get(card.prompt)
                    : undefined
                }
              />
```

- [ ] **Step 4: Type-check + build**

```bash
npx tsc --noEmit && npm run build
```

Expected: both pass.

### Task 5.3: Manual smoke verify locally

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: In a browser, open `http://localhost:3000/learn/lesson?topic=broun`**

Open browser DevTools → Network → filter to "generate-image".

Expected:
- Image appears INSTANTLY (no shimmer) — coming from `/lesson-images/{hash}.png`
- ZERO requests to `/api/generate-image` in the Network panel
- Console shows: `[scorpius] image prefetch: 1 cards, all pre-baked, nothing to fetch` (or similar count depending on the lesson)

- [ ] **Step 3: Open `http://localhost:3000/learn/lesson?topic=brachistochrone`**

This lesson has a `mcq` + `simulation` BEFORE the diagram card, but the prefetch hook lives at the deck level — so the diagram should already be cached by the time you reach it.

Expected:
- DevTools Network: still ZERO `/api/generate-image` calls (image was pre-baked, served from `/lesson-images/`)
- Solve the mcq + sim, swipe to the diagram → image shows instantly, no shimmer

- [ ] **Step 4: Stop dev server**

```bash
pkill -f "next dev" || true
```

### Task 5.4: Commit Phase 5

- [ ] **Step 1: Stage + commit**

```bash
git add components/learn/cards.tsx components/learn/LessonDeck.tsx
git commit -m "feat: lift diagram image fetching from per-card to deck-level

DiagramCard becomes a pure render of an ImageState prop — no more
internal useState/useEffect/fetch. LessonDeck mounts
useLessonImagePrefetch once, which seeds 'ready' immediately for all
pre-baked cards and fans out parallel fetches (cap 3) for any that
aren't.

Crucial: the hook lives outside the lock-gate logic, so prefetch starts
the moment the lesson page mounts — not when a locked card finally
unlocks. With Phase 2's pre-baked PNGs in place, every existing diagram
card renders instantly with zero network traffic.

Spec §5 + §6.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase 6 — Verify + deploy

### Task 6.1: Pre-deploy gates

- [ ] **Step 1: Type-check**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: completes; route list includes `/learn/lesson` as a Function (`ƒ`) and `/api/generate-image` as a Function.

- [ ] **Step 3: Verifier check**

```bash
npm run verify:images
```

Expected:
```
verified 5 diagram card(s).
  ✓ all baked
```

- [ ] **Step 4 (only if Phase 0 done): Run tests**

```bash
npm test
```

Expected: all green.

### Task 6.2: Deploy

- [ ] **Step 1: Confirm git author email is the Vercel-linked one**

```bash
git log -1 --pretty=format:"%h %ae %s"
```

Expected: email is `murodjontolipov.dev@gmail.com` (the Vercel-recognized one — see memory `vercel-deploy-gotchas.md`).

- [ ] **Step 2: Deploy**

```bash
vercel --prod --yes
```

Expected: produces a deploy URL and ends with `Aliased: https://scorpius.uz`. If the CLI ECONNRESET'd partway through, the build is usually still running server-side — proceed to step 3 to verify.

- [ ] **Step 3: Verify CDN-served PNGs**

Pick one PNG filename from `public/lesson-images/` and hit it:

```bash
ls public/lesson-images/*.png | head -1
# e.g. abc123def456.png
curl -sSI https://scorpius.uz/lesson-images/abc123def456.png | head -3
```

Expected:
```
HTTP/1.1 200 OK
Content-Type: image/png
```

- [ ] **Step 4: Verify the lesson page**

```bash
curl -sSI https://scorpius.uz/learn/lesson?topic=broun | head -3
```

Expected: `HTTP/1.1 200 OK`.

- [ ] **Step 5: Browser verify on phone**

Open `https://scorpius.uz/learn/lesson?topic=broun` on a phone (hard-refresh / incognito). Expected: image appears instantly, no shimmer. Open DevTools (or chrome://inspect) and confirm no `/api/generate-image` call in Network.

### Task 6.3: Final commit (changelog / readme touch, if needed)

If you maintain a `CHANGELOG.md` or want to update `docs/scorpius-state.md` memory file with the new "image prefetch shipped" state, do it now and commit:

- [ ] **Step 1: (Optional) Update memory state**

Append to `~/.claude/projects/D--GDG/memory/scorpius-state.md` or wherever you track milestones. (This is a memory edit, not a repo edit — uses your standard memory workflow.)

---

## Out of scope (deferred — see spec §13)

These are NOT in this plan. They earn their own spec/plan cycle:

- **Track D — Lesson Curator agent**, live LLM text generation per card, BKT knowledge tracer
- **Streaming PNG endpoint** (`response_format=stream`)
- **SVG-overlay system for Uzbek labels**
- **Telemetry dashboard / analytics layer** beyond the two `console.info` lines in the hook
- **Per-card retry / exponential backoff** in the runtime hook

If during execution you find yourself wanting any of these, stop and write a follow-up spec rather than slipping it in here.
