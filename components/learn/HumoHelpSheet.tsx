"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles, X } from "lucide-react";
import { ensureAnonymousUser } from "@/lib/auth";
import { loadProfile } from "@/lib/profile";
import type { TutorContext } from "@/lib/personas";

/** Inline Humo help sheet — opens within the lesson, no navigation.
 *
 *  Two entry points trigger it:
 *   - "Humo'dan so'rash" button on SimulationCard (passes simSnapshot)
 *   - "Humo'dan so'rash" button under a wrong MCQ answer (passes recentMistake)
 *
 *  The sheet auto-sends an opening user-style turn that frames the question
 *  ("Yordam bering — bu masala bilan qiynalayapman") so the streaming
 *  reply lands instantly. Future turns the student types themselves.
 *
 *  Uses /api/humo with the new `context` field (Phase 3 wiring). */

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

export function HumoHelpSheet({
  open,
  onClose,
  context,
  openingPromptUz,
}: {
  open: boolean;
  onClose: () => void;
  /** Sim snapshot, mastery summary, or recent mistake context — sent to the LLM. */
  context: TutorContext;
  /** First user-side prompt to send automatically when the sheet opens.
   *  E.g. "Bu savol bilan qiynalayapman, yordam bering." */
  openingPromptUz: string;
}) {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const sentRef = useRef(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // On mount, get the uid for rate-limit keying.
  useEffect(() => {
    void ensureAnonymousUser().then(setUid);
  }, []);

  // First open: auto-send the framing message so the student sees a response
  // immediately, no cold-start typing. Subsequent opens reuse the existing
  // thread (kept in component state). Reset thread when closed-then-reopened
  // with a different mistake/sim context.
  useEffect(() => {
    if (!open) {
      sentRef.current = false;
      setMessages([]);
      return;
    }
    if (sentRef.current) return;
    sentRef.current = true;
    void send(openingPromptUz, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-scroll to the bottom on every new message.
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(content: string, history: ChatTurn[]) {
    if (!content.trim() || streaming) return;
    const userTurn: ChatTurn = { role: "user", content };
    const placeholder: ChatTurn = { role: "assistant", content: "", streaming: true };
    const next: ChatTurn[] = [...history, userTurn, placeholder];
    setMessages(next);
    setStreaming(true);
    setText("");

    try {
      const res = await fetch("/api/humo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(uid ? { "X-Scorpius-Uid": uid } : {}),
        },
        body: JSON.stringify({
          personaId: "scorpius",
          messages: next.slice(0, -1).map(({ role, content }) => ({ role, content })),
          profile: loadProfile() ?? null,
          context,
        }),
      });
      if (!res.ok || !res.body) {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            role: "assistant",
            content: "Hozir javob berib bo'lmadi. Internetni tekshirib qayta urinib ko'ring.",
          };
          return copy;
        });
        setStreaming(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistant = "";
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload) as { delta?: string };
            if (parsed.delta) {
              assistant += parsed.delta;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = {
                  role: "assistant",
                  content: assistant,
                  streaming: true,
                };
                return copy;
              });
            }
          } catch {
            /* malformed chunk — skip */
          }
        }
      }
    } finally {
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant" && last.streaming) {
          copy[copy.length - 1] = { ...last, streaming: false };
        }
        return copy;
      });
      setStreaming(false);
    }
  }

  if (!open) return null;
  // Skip the auto-opener turn from the visible list — it's framing, not
  // something the student would have typed.
  const visible = messages.slice(1);

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <button
        type="button"
        aria-label="Yopish"
        onClick={onClose}
        className="absolute inset-0 bg-void-100/35 backdrop-blur-[2px]"
      />
      <div
        className="rise-in relative mt-auto mx-auto w-full max-w-[520px] rounded-t-[24px] border border-void-500 bg-void-950 shadow-[0_-12px_48px_-12px_rgba(20,18,14,0.18)]"
        style={{ height: "72vh" }}
      >
        <header className="flex items-center gap-2 border-b border-void-500 px-5 py-3">
          <Sparkles className="h-4 w-4 text-antares-700" />
          <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-antares-700">
            Humo · sokratik yordam
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="ml-auto grid h-8 w-8 place-items-center rounded-full text-void-300 transition hover:bg-void-700 hover:text-void-100"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div
          ref={scrollerRef}
          className="scrollbar-none flex-1 overflow-y-auto px-4 py-3"
          style={{ height: "calc(72vh - 124px)" }}
        >
          {visible.length === 0 && streaming && (
            <div className="flex items-center gap-2 px-2 py-3 text-[13px] text-void-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Humo o&apos;ylamoqda…
            </div>
          )}
          <ul className="flex flex-col gap-2.5">
            {visible.map((m, i) => (
              <li
                key={i}
                className={
                  "flex " + (m.role === "user" ? "justify-end" : "justify-start")
                }
              >
                <div
                  className={
                    "max-w-[85%] whitespace-pre-wrap break-words rounded-[14px] px-3.5 py-2.5 text-[14.5px] leading-[1.45] " +
                    (m.role === "user"
                      ? "bg-antares-500 text-void-100"
                      : "bg-void-800 text-void-100")
                  }
                  style={
                    m.role === "assistant"
                      ? { borderLeft: "3px solid var(--color-antares-500)" }
                      : undefined
                  }
                >
                  {m.content}
                  {m.streaming && (
                    <span className="ml-1 inline-block h-3 w-1.5 animate-pulse rounded-sm bg-void-200 align-middle" />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-void-500 px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-3">
          <div className="flex items-end gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(text, messages);
                }
              }}
              placeholder="Savolingizni yozing…"
              disabled={streaming || !uid}
              className="min-h-[42px] flex-1 rounded-[14px] border border-void-500 bg-void-800 px-3.5 py-2 text-[14.5px] text-void-100 outline-none transition-colors placeholder:text-void-400 focus:border-antares-500 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => void send(text, messages)}
              disabled={streaming || !uid || text.trim().length === 0}
              aria-label="Yuborish"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-antares-500 text-void-100 transition hover:bg-antares-300 active:scale-[0.94] disabled:bg-void-700 disabled:text-void-400"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
