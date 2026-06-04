"use client";

import { useEffect, useRef } from "react";
import type { Persona } from "@/lib/personas";

export interface ChatMessageView {
  role: "user" | "assistant";
  content: string;
  /** Set on the message that is currently streaming (last assistant message
   *  while tokens are arriving). We render a pulsing cursor at the end. */
  streaming?: boolean;
}

interface Props {
  persona: Persona;
  messages: ChatMessageView[];
}

/** Telegram-style message list. Assistant left (with persona avatar +
 *  accent-tinted bubble), user right (gold antares bubble). Auto-scrolls
 *  to bottom on new content unless the user has scrolled up to read history. */
export function MessageList({ persona, messages }: Props) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      stickToBottomRef.current = nearBottom;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  return (
    <div
      ref={scrollerRef}
      className="scrollbar-none flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-3"
    >
      <ul className="flex flex-col gap-2.5">
        {messages.map((m, i) => (
          <li
            key={i}
            className={
              "flex items-end gap-2 " +
              (m.role === "user" ? "flex-row-reverse" : "flex-row")
            }
          >
            {m.role === "assistant" && (
              <span
                className="mb-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[14px]"
                style={{ background: `${persona.accentColor}1f` }}
                aria-hidden
              >
                {persona.emoji}
              </span>
            )}
            <div
              className={
                "max-w-[80%] whitespace-pre-wrap break-words rounded-[18px] px-3.5 py-2.5 text-[15px] leading-[1.45] " +
                (m.role === "user"
                  ? "bg-antares-500 text-void-100"
                  : "bg-void-800 text-void-100")
              }
              style={
                m.role === "assistant"
                  ? { borderLeft: `3px solid ${persona.accentColor}80` }
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
  );
}
