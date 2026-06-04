/**
 * Vision adapter — sends an image + a structured-output prompt to gpt-5.1 and
 * returns the parsed JSON. Mirrors the pattern already used in
 * scripts/extract-curriculum.ts (askVision), lifted into a reusable function
 * so API routes (and other scripts) don't each reinvent the chat-completions
 * shape.
 *
 * Only the prompt is variable; the image bytes come from the caller. The
 * prompt is fixed server-side at every callsite — there is no path for a user
 * to inject prompt content here.
 */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-5.1";

export interface ExtractFromImageOpts {
  /** Base64-encoded image data URL (e.g. `data:image/png;base64,...`). */
  imageDataUrl: string;
  /** The full instruction prompt. Must tell the model to return JSON-only. */
  prompt: string;
  /** Override default model. Vision-capable models only. */
  model?: string;
}

/**
 * Send the image + prompt; parse the response as JSON.
 * Throws on network errors, non-2xx OpenAI responses, and JSON-parse failures.
 */
export async function extractFromImage<T>(opts: ExtractFromImageOpts): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model ?? DEFAULT_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: opts.prompt },
            { type: "image_url", image_url: { url: opts.imageDataUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI vision ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  const raw = text
    .replace(/^```json\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(raw) as T;
}

/** The structured-output type that the `/api/homework/extract` endpoint returns. */
export interface HomeworkExtraction {
  isProblem: boolean;
  subject: "math" | "physics" | "history" | "language" | "other" | null;
  grade: number | null;
  topicUz: string | null;
  problemSummaryUz: string;
  studentHintUz: string;
}

/** The prompt the homework-extract endpoint sends. Kept here so it's
 *  versioned with the type it produces. */
export const HOMEWORK_EXTRACTION_PROMPT = `You are a curriculum-aware vision model for Scorpius, an Uzbek K-12 tutor.
Examine the image. If it shows a textbook problem, homework page, or exercise,
extract structured info about the problem. If the image is not a school problem
(a cat photo, a blank page, a screenshot of social media), say so honestly.

Return ONLY this JSON object (no markdown fences, no commentary):

{
  "isProblem": boolean,
  "subject": "math" | "physics" | "history" | "language" | "other" | null,
  "grade": number | null,
  "topicUz": string | null,
  "problemSummaryUz": string,
  "studentHintUz": string
}

Rules:
- "grade" is your best guess (1-12) based on the problem difficulty; null if unsure.
- "topicUz" is a short Uzbek topic name like "EKUB", "Kasr amallari", "Arximed kuchi",
  "Bo'luvchilar", "Suvning bug'lanishi". null if not a problem.
- "problemSummaryUz" is ONE Uzbek sentence describing what the student is being asked.
  If isProblem is false, briefly describe what the image shows instead.
- "studentHintUz" is ONE Uzbek sentence with a gentle, non-spoiler nudge for the first step
  the student should take. Do NOT give away the answer. If isProblem is false, an empty string.
- Use polite Uzbek (siz form). Keep all answers concise.`;
