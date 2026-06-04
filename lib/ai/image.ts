/**
 * Thin wrapper around OpenAI's image generation API (default model:
 * `gpt-image-2`, with `gpt-image-1` available as an escape hatch via opts).
 * Server-only — never import from a client component.
 *
 *   const { b64 } = await generateImage("clean physics diagram of ...");
 *
 * Returns the raw base64 PNG. The caller decides whether to wrap it as a
 * data URL, upload it, or cache it.
 */

const OPENAI_IMAGE_URL = "https://api.openai.com/v1/images/generations";

export interface GenerateImageOpts {
  /** 1024x1024 (default), 1024x1536 (portrait), 1536x1024 (landscape). */
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  /** "low" is fast & cheap and is the default (best for educational diagrams). */
  quality?: "low" | "medium" | "high";
  /** Defaults to "gpt-image-2". "gpt-image-1" kept as escape hatch. */
  model?: "gpt-image-2" | "gpt-image-1";
}

export interface GenerateImageResult {
  b64: string;
}

export async function generateImage(
  prompt: string,
  opts: GenerateImageOpts = {}
): Promise<GenerateImageResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing — set it in .env.local");
  if (!prompt || prompt.trim().length < 5) throw new Error("prompt too short");

  const res = await fetch(OPENAI_IMAGE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model ?? "gpt-image-2",
      prompt,
      n: 1,
      size: opts.size ?? "1024x1024",
      quality: opts.quality ?? "low",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`image generation failed (${res.status}): ${text.slice(0, 240)}`);
  }

  const data = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("image generation returned no image");
  return { b64 };
}
