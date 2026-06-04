// scripts/generate-persona-portraits.ts
/**
 * One-shot: generate persona portraits via gpt-image-2. Writes PNGs to
 * public/personas/{personaId}.png. Run once per persona; re-run only when
 * you want a different vibe.
 *
 * Usage: npx tsx scripts/generate-persona-portraits.ts newton
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

// generateImage(prompt, opts) → { b64: string }  (raw base64 PNG)
import { generateImage } from "../lib/ai/image";

const PROMPTS: Record<string, string> = {
  newton:
    "A warm, weathered Renaissance oil-painting portrait of Isaac Newton at age 35, looking directly at the camera with curious eyes, in his Cambridge study, brass pendulum clock visible on a wooden table behind him, soft warm chiaroscuro lighting, dignified, scholarly. Square 1:1, head and shoulders. Photoreal painted texture. Suitable as a 96px circular avatar.",
  layla:
    "A warm portrait of a young Central Asian Muslim woman scientist at age 32 in a chemistry lab, hijab, white lab coat, looking gently at the camera, periodic table softly behind her, warm window light. Square 1:1, head and shoulders. Suitable as a 96px avatar.",
};

const personaId = process.argv[2];
if (!personaId || !PROMPTS[personaId]) {
  console.error(
    `Usage: tsx scripts/generate-persona-portraits.ts ${Object.keys(PROMPTS).join("|")}`
  );
  process.exit(1);
}

(async () => {
  console.log(`Generating portrait for "${personaId}"…`);
  const { b64 } = await generateImage(PROMPTS[personaId], {
    size: "1024x1024",
    quality: "high",
  });

  const out = resolve(process.cwd(), `public/personas/${personaId}.png`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, Buffer.from(b64, "base64"));
  console.log(`Wrote ${out}`);
})();
