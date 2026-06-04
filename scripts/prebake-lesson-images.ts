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
