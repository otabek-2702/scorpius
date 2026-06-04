import { pdf } from "pdf-to-img";
import { adminDb } from "../lib/firebase/admin";

/**
 * Curriculum extraction (M0 Task F).
 * Renders selected textbook pages to images, has GPT-5.1 (vision) read them, and
 * stores the structured lesson in Firestore.
 *
 *   npx tsx --env-file=.env.local scripts/extract-curriculum.ts
 */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-5.1";

const EXTRACTION_PROMPT = `These are consecutive pages from a Grade 6 Uzbek school textbook.
Extract ONE complete lesson shown in them — prefer the first lesson that appears in full.
Return ONLY valid JSON (no markdown fences), shaped exactly as:
{"title": string, "explanation": string, "examples": string[], "problems": string[]}
Transcribe faithfully in the textbook's own language (Uzbek). Do NOT invent, summarise,
or translate. Use an empty string or empty array for any field absent on these pages.`;

interface LessonSpec {
  pdf: string;
  pages: number[]; // 1-based page numbers covering one lesson
  grade: number;
  subject: string;
  lessonId: string;
}

/** Render only the wanted pages (stop at the last one — never the whole PDF). */
async function renderPages(spec: LessonSpec): Promise<string[]> {
  const document = await pdf(spec.pdf, { scale: 2 });
  const wanted = new Set(spec.pages);
  const maxPage = Math.max(...spec.pages);
  const images: string[] = [];
  let pageNo = 0;
  for await (const page of document) {
    pageNo += 1;
    if (wanted.has(pageNo)) images.push(page.toString("base64"));
    if (pageNo >= maxPage) break;
  }
  return images;
}

async function askVision(apiKey: string, images: string[]): Promise<string> {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: EXTRACTION_PROMPT },
            ...images.map((b64) => ({
              type: "image_url",
              image_url: { url: `data:image/png;base64,${b64}` },
            })),
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}

async function extractLesson(apiKey: string, spec: LessonSpec) {
  const images = await renderPages(spec);
  if (images.length === 0) {
    throw new Error(`No pages ${spec.pages.join(",")} found in ${spec.pdf}`);
  }

  const text = await askVision(apiKey, images);
  const raw = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
  const lesson = JSON.parse(raw);

  await adminDb.doc(`curriculum/${spec.grade}/${spec.subject}/${spec.lessonId}`).set({
    ...lesson,
    grade: spec.grade,
    subject: spec.subject,
    sourcePages: spec.pages,
    extractedAt: new Date().toISOString(),
  });

  console.log(`Extracted ${spec.subject}/${spec.lessonId}: "${lesson.title}" (${images.length} pages)`);
  console.log(`  explanation: ${String(lesson.explanation ?? "").slice(0, 220)}`);
  console.log(`  examples: ${lesson.examples?.length ?? 0} | problems: ${lesson.problems?.length ?? 0}`);
}

// Grade 6 demo lessons — a generous page span; the model picks the first complete lesson.
const LESSONS: LessonSpec[] = [
  { pdf: "data/curriculum/math-6.pdf", pages: [6, 7, 8, 9, 10, 11], grade: 6, subject: "math", lessonId: "lesson-1" },
  { pdf: "data/curriculum/history-6.pdf", pages: [7, 8, 9, 10, 11, 12], grade: 6, subject: "history", lessonId: "lesson-1" },
];

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing — set it in .env.local");

  let ok = 0;
  for (const spec of LESSONS) {
    try {
      await extractLesson(apiKey, spec);
      ok += 1;
    } catch (err) {
      console.error(`FAILED ${spec.subject}/${spec.lessonId}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`Done — ${ok}/${LESSONS.length} lessons extracted.`);
  if (ok === 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
