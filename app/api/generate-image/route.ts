import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { generateImage, type GenerateImageOpts } from "@/lib/ai/image";
import { adminDb } from "@/lib/firebase/admin";

/**
 * POST /api/generate-image
 * Body: { prompt: string, size?: ..., quality?: ..., model?: "gpt-image-2" | "gpt-image-1" }
 * Returns: { src: "data:image/png;base64,...", cached: boolean }
 *
 * Caches the generated image to Firestore at `images/{hash(prompt+opts)}` so a
 * second request for the same prompt is instant. The cache key includes size,
 * quality, AND model — so different variants (and legacy gpt-image-1 entries)
 * never collide with each other.
 */
export async function POST(req: Request) {
  let body: {
    prompt?: string;
    size?: GenerateImageOpts["size"];
    quality?: GenerateImageOpts["quality"];
    model?: GenerateImageOpts["model"];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const prompt = (body.prompt ?? "").trim();
  if (prompt.length < 5) {
    return NextResponse.json({ error: "prompt too short" }, { status: 400 });
  }
  const size = body.size ?? "1024x1024";
  const quality = body.quality ?? "low";
  const model = body.model ?? "gpt-image-2";

  // Hash includes the variant — different size/quality means different cache key.
  const hash = crypto
    .createHash("sha256")
    .update(`${prompt}|${size}|${quality}|${model}`)
    .digest("hex")
    .slice(0, 32);
  const ref = adminDb.doc(`images/${hash}`);

  // Cache lookup. Treat Firestore errors as a cache miss, not a hard fail.
  try {
    const snap = await ref.get();
    if (snap.exists) {
      const data = snap.data() as { b64?: string };
      if (data.b64) {
        return NextResponse.json({ src: `data:image/png;base64,${data.b64}`, cached: true });
      }
    }
  } catch {
    /* fall through to live generation */
  }

  let b64: string;
  try {
    const out = await generateImage(prompt, { size, quality, model });
    b64 = out.b64;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "image generation failed" },
      { status: 502 }
    );
  }

  // Persist for next time. If Firestore is unavailable, still serve the image.
  try {
    await ref.set({
      b64,
      prompt,
      size,
      quality,
      model,
      createdAt: new Date().toISOString(),
    });
  } catch {
    /* swallow — the response still goes back */
  }

  return NextResponse.json({ src: `data:image/png;base64,${b64}`, cached: false });
}
