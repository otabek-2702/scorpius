import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { streamChat, type ChatMessage } from "@/lib/ai/stream";
import {
  buildSystemPrompt,
  isPersonaId,
  type PersonaId,
  type ProfileHints,
} from "@/lib/personas";

/**
 * POST /api/humo — streaming chat tutor.
 *
 * Body (application/json):
 *   {
 *     personaId: "scorpius" | "xorazmiy" | "newton" | "einstein" | "elon",
 *     messages: ChatMessage[],   // last 20 user+assistant turns
 *     profile?: ProfileHints
 *   }
 *
 * Headers: X-Scorpius-Uid (optional) for per-uid rate limiting.
 *
 * Response: text/event-stream — newline-delimited SSE events.
 *   data: {"delta":"Salom"}
 *   data: {"delta":", men"}
 *   ...
 *   data: [DONE]
 *
 * Errors return JSON 4xx/5xx BEFORE opening the stream so the client can
 * show a friendly toast instead of an empty bubble.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Streaming chats can run long — gpt-5-mini at ~80 tokens/s on a 300-token
// reply needs ~4s, plus first-byte latency. 60s ceiling gives plenty of
// headroom without leaving the function hanging on a hostile prompt.
export const maxDuration = 60;

const MAX_MESSAGES = 20;
const MAX_CONTENT_CHARS = 4000;
const RATE_LIMIT_WINDOW_S = 300; // 5 minutes
const RATE_LIMIT_MAX = 30;

async function checkRateLimit(
  key: string,
): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  const ref = adminDb.doc(`rate-limits/humo/keys/${key}`);
  try {
    const now = Date.now();
    return await adminDb.runTransaction(async (tx) => {
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
  } catch {
    return { ok: true };
  }
}

function jsonError(status: number, error: string, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, message, ...extra }, { status });
}

export async function POST(req: Request) {
  // 1. Parse and validate body
  let body: {
    personaId?: unknown;
    messages?: unknown;
    profile?: ProfileHints | null;
  };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "badJson", "So'rov yuborilmadi");
  }

  if (!isPersonaId(body.personaId)) {
    return jsonError(400, "badPersona", "Noma'lum yo'ldosh");
  }
  const personaId: PersonaId = body.personaId;

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return jsonError(400, "noMessages", "Xabar yuborilmadi");
  }
  const messages: ChatMessage[] = [];
  for (const m of body.messages.slice(-MAX_MESSAGES)) {
    if (
      !m ||
      typeof m !== "object" ||
      !("role" in m) ||
      !("content" in m) ||
      typeof (m as { content: unknown }).content !== "string"
    ) {
      return jsonError(400, "badMessage", "Xabar formati noto'g'ri");
    }
    const role = (m as { role: unknown }).role;
    if (role !== "user" && role !== "assistant") {
      return jsonError(400, "badRole", "Xabar formati noto'g'ri");
    }
    const content = (m as { content: string }).content.slice(0, MAX_CONTENT_CHARS);
    if (content.trim().length === 0) continue;
    messages.push({ role, content });
  }
  if (messages.length === 0) {
    return jsonError(400, "noMessages", "Xabar bo'sh");
  }

  // 2. Rate limit
  const uid = req.headers.get("x-scorpius-uid")?.trim();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const rlKey = uid && uid.length > 8 ? `uid:${uid}` : `ip:${ip}`;
  const rl = await checkRateLimit(rlKey);
  if (!rl.ok) {
    return jsonError(
      429,
      "rateLimit",
      `5 daqiqada ko'p so'rov yubordingiz. Bir oz dam oling.`,
      { retryAfter: rl.retryAfter },
    );
  }

  // 3. Build the messages array sent to the LLM
  const systemPrompt = buildSystemPrompt(personaId, body.profile ?? null);
  const llmMessages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  // 4. Open the upstream stream BEFORE we start writing to the response.
  //    streamChat throws on auth/network failures — those become JSON 502s.
  let iterator: AsyncIterableIterator<string>;
  try {
    iterator = streamChat({ messages: llmMessages });
  } catch (err) {
    console.warn("[humo] streamChat init failed:", err);
    return jsonError(502, "upstream", "Internet xatosi. Qaytadan urinib ko'ring.");
  }

  // 5. Pipe the iterator → SSE response
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of iterator) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`),
          );
        }
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
      } catch (err) {
        console.warn("[humo] stream error:", err);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: "stream", message: "Javob uzilib qoldi" })}\n\n`,
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
