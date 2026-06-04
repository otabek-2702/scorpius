// app/api/voice/prerender/route.ts
import { NextRequest } from "next/server";
import { readCachedMp3, writeCachedMp3 } from "@/lib/ai/voiceCache";
import { synthesizePrerender } from "@/lib/ai/voice";

export const runtime = "nodejs";
export const maxDuration = 30;
const PRERENDER_MODEL = "eleven_v3";

export async function POST(req: NextRequest) {
  let body: { text?: string; voiceId?: string };
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ message: "JSON parse failed" }), { status: 400 }); }
  const text = body.text?.trim();
  const voiceId = body.voiceId?.trim();
  if (!text || !voiceId) return new Response(JSON.stringify({ message: "text + voiceId required" }), { status: 400 });
  if (text.length > 800) return new Response(JSON.stringify({ message: "text too long (max 800 chars)" }), { status: 400 });

  let mp3 = await readCachedMp3(text, voiceId, PRERENDER_MODEL);
  if (!mp3) {
    try { mp3 = await synthesizePrerender({ text, voiceId }); }
    catch (err) { return new Response(JSON.stringify({ message: (err as Error).message }), { status: 502 }); }
    await writeCachedMp3(text, voiceId, PRERENDER_MODEL, mp3);
  }
  return new Response(new Uint8Array(mp3), {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
