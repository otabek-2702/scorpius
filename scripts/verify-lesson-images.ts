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
