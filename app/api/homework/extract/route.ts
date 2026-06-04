import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { extractFromImage, HOMEWORK_EXTRACTION_PROMPT, type HomeworkExtraction } from "@/lib/ai/vision";
import { findWalkthroughForTopic } from "@/lib/homework/walkthroughs";
import { adminDb } from "@/lib/firebase/admin";

/**
 * POST /api/homework/extract
 * Body: multipart/form-data with one `image` file (image/*, max 5 MB).
 * Headers: `X-Scorpius-Uid` (optional) — student's anon UID for per-uid rate limiting.
 *
 * Flow: validate → SHA cache lookup → vision (gpt-5.1) → topic match → JSON.
 * Cached at `homework-extractions/{sha}` so a repeat upload is instant + free.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vision can take 5-15s on a fresh extraction. The default 10s Hobby timeout
// trips on cold-start + slow vision combos; 30s gives us headroom.
export const maxDuration = 30;

// Stay just under Vercel's default ~4.5 MB serverless body limit. Real uploads
// are downscaled client-side to ≤1600px (≈500 KB JPEG) so this only matters as
// a backstop against accidental huge uploads.
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const RATE_LIMIT_WINDOW_S = 60;
const RATE_LIMIT_MAX = 5;

interface CachedExtraction {
  extraction: HomeworkExtraction;
  createdAt: string;
}

/** Sniff the actual MIME by reading the file's leading bytes. We refuse to
 *  trust the client's claimed Content-Type. */
function sniffImageMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  // WebP: RIFF????WEBP
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  // GIF: GIF87a or GIF89a
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return "image/gif";
  }
  return null;
}

/** Firestore-backed rate limiter. Keyed by uid (or IP if no uid). Stores a
 *  counter doc with the current window's start + count. Best-effort: if
 *  Firestore fails, we fail open (let the request through) — losing a few
 *  free vision calls beats blocking real users when our cache backend wobbles. */
async function checkRateLimit(key: string): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  const ref = adminDb.doc(`rate-limits/homework-extract/keys/${key}`);
  try {
    const now = Date.now();
    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists
        ? (snap.data() as { windowStart: number; count: number })
        : null;
      const windowMs = RATE_LIMIT_WINDOW_S * 1000;
      if (!data || now - data.windowStart > windowMs) {
        tx.set(ref, { windowStart: now, count: 1 });
        return { ok: true as const };
      }
      if (data.count >= RATE_LIMIT_MAX) {
        const retryAfter = Math.ceil((data.windowStart + windowMs - now) / 1000);
        return { ok: false as const, retryAfter: Math.max(1, retryAfter) };
      }
      tx.update(ref, { count: data.count + 1 });
      return { ok: true as const };
    });
    return result;
  } catch {
    return { ok: true };
  }
}

export async function POST(req: Request) {
  // 1. Read the multipart form
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "noImage", message: "Rasm yuklanmadi" },
      { status: 400 }
    );
  }

  const file = form.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "noImage", message: "Rasm yuklanmadi" },
      { status: 400 }
    );
  }
  if (file.size === 0) {
    return NextResponse.json(
      { error: "empty", message: "Rasm bo'sh" },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "tooLarge", message: "Rasm 4 MB dan kichik bo'lsin" },
      { status: 400 }
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffImageMime(bytes);
  if (!mime) {
    return NextResponse.json(
      { error: "badType", message: "Faqat rasm fayli (PNG, JPG, WebP, GIF)" },
      { status: 400 }
    );
  }

  // 2. Rate limit
  const uid = req.headers.get("x-scorpius-uid")?.trim();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const rlKey = uid && uid.length > 8 ? `uid:${uid}` : `ip:${ip}`;
  const rl = await checkRateLimit(rlKey);
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: "rateLimit",
        message: `Bir daqiqada faqat ${RATE_LIMIT_MAX} ta rasm. Biroz kuting.`,
        retryAfter: rl.retryAfter,
      },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  // 3. SHA cache lookup (hash the raw bytes — different MIME on same content
  // produces the same hash, which is what we want)
  const hash = crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 32);
  const cacheRef = adminDb.doc(`homework-extractions/${hash}`);
  try {
    const snap = await cacheRef.get();
    if (snap.exists) {
      const data = snap.data() as CachedExtraction | undefined;
      if (data?.extraction) {
        const matchedWalkthroughId = findWalkthroughForTopic(data.extraction.topicUz);
        return NextResponse.json({
          extraction: data.extraction,
          matchedWalkthroughId,
          cached: true,
        });
      }
    }
  } catch {
    /* cache miss — fall through */
  }

  // 4. Vision call
  const b64 = Buffer.from(bytes).toString("base64");
  const imageDataUrl = `data:${mime};base64,${b64}`;
  let extraction: HomeworkExtraction;
  try {
    extraction = await extractFromImage<HomeworkExtraction>({
      imageDataUrl,
      prompt: HOMEWORK_EXTRACTION_PROMPT,
    });
  } catch (err) {
    console.warn("[homework-extract] vision failed:", err);
    return NextResponse.json(
      { error: "visionFailed", message: "Rasmni o'qib bo'lmadi. Qaytadan urinib ko'ring." },
      { status: 502 }
    );
  }

  // 5. Cache the result (best-effort)
  try {
    await cacheRef.set({
      extraction,
      createdAt: new Date().toISOString(),
    });
  } catch {
    /* swallow — response still goes back */
  }

  // 6. Match topic → walkthrough
  const matchedWalkthroughId = findWalkthroughForTopic(extraction.topicUz);

  return NextResponse.json({
    extraction,
    matchedWalkthroughId,
    cached: false,
  });
}
