import { createHash } from "node:crypto";
import { adminDb } from "@/lib/firebase/admin";

function cacheKey(text: string, voiceId: string, model: string): string {
  return createHash("sha256").update(`${voiceId}::${model}::${text}`).digest("hex").slice(0, 32);
}

export async function readCachedMp3(text: string, voiceId: string, model: string): Promise<Buffer | null> {
  const snap = await adminDb.doc(`voiceCache/${cacheKey(text, voiceId, model)}`).get();
  if (!snap.exists) return null;
  const b64 = snap.data()?.base64 as string | undefined;
  return b64 ? Buffer.from(b64, "base64") : null;
}

export async function writeCachedMp3(text: string, voiceId: string, model: string, mp3: Buffer): Promise<void> {
  await adminDb.doc(`voiceCache/${cacheKey(text, voiceId, model)}`).set({
    base64: mp3.toString("base64"),
    voiceId, model, createdAt: new Date(), sizeBytes: mp3.byteLength,
  });
}
