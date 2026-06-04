import { pdf } from "pdf-to-img";
import { writeFileSync } from "fs";

/**
 * Transcribes a PDF to plain text via GPT-5.1 vision (one call per page).
 * Used to read PDFs the Read tool can't open (no system poppler here).
 *
 *   npx tsx --env-file=.env.local scripts/read-pdf.ts "<src.pdf>" <out.txt>
 */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-5.1";

async function transcribePage(apiKey: string, base64: string): Promise<string> {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Transcribe ALL text from this page faithfully, in reading order. Output only the transcribed text — no commentary.",
            },
            { type: "image_url", image_url: { url: `data:image/png;base64,${base64}` } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

async function main() {
  const src = process.argv[2];
  const out = process.argv[3];
  if (!src || !out) throw new Error('usage: read-pdf.ts "<src.pdf>" <out.txt>');
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");

  const document = await pdf(src, { scale: 2 });
  const parts: string[] = [];
  let pageNo = 0;
  for await (const page of document) {
    pageNo += 1;
    const text = await transcribePage(apiKey, page.toString("base64"));
    parts.push(`--- Page ${pageNo} ---\n${text}`);
    console.log(`page ${pageNo} transcribed`);
  }
  writeFileSync(out, parts.join("\n\n"), "utf8");
  console.log(`Wrote ${out} (${pageNo} pages).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
