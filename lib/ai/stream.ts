/**
 * Streaming chat wrapper around OpenAI chat completions (`stream: true`).
 *
 * Returns an async iterator yielding token deltas as plain strings. The
 * caller (typically the `/api/humo` route handler) re-encodes the deltas
 * as SSE events for the browser. We do the parsing here so a future
 * Gemini/OpenRouter streaming backend can implement the same iterator
 * contract without the route handler changing.
 */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-5-mini";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamChatOpts {
  messages: ChatMessage[];
  /** Override the default `gpt-5-mini`. Keep mini for the chat surface —
   *  it's fast, cheap, and the prompt does the heavy lifting. */
  model?: string;
  /** Abort signal — caller can cancel an in-flight stream when the user
   *  navigates away or sends a new message. */
  signal?: AbortSignal;
}

/** Yields one delta string per token chunk from OpenAI's SSE stream.
 *  Throws on auth / network errors before yielding the first delta. */
export async function* streamChat(opts: StreamChatOpts): AsyncIterableIterator<string> {
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
      stream: true,
      messages: opts.messages,
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI stream ${res.status}: ${body.slice(0, 300)}`);
  }
  if (!res.body) {
    throw new Error("OpenAI stream: empty body");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are newline-delimited. Each line is either `data: {...}`
      // or `data: [DONE]`. Multi-byte UTF-8 splits across chunks → we only
      // commit complete lines and keep the trailing partial in the buffer.
      let newlineIdx;
      while ((newlineIdx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const parsed = JSON.parse(payload) as {
            choices?: { delta?: { content?: string } }[];
          };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // Malformed chunk — skip it. The model occasionally emits
          // partial JSON at backpressure boundaries.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
