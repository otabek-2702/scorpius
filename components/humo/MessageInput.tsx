"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Send } from "lucide-react";

interface Props {
  disabled: boolean;
  onSend: (text: string) => void;
  /** Optional starter chips shown above the composer when the conversation
   *  is empty. Lowers the cold-start barrier — 12yo doesn't know what to ask. */
  starters?: string[];
}

export function MessageInput({ disabled, onSend, starters }: Props) {
  const [text, setText] = useState("");
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  function send() {
    const trimmed = text.trim();
    if (trimmed.length === 0 || disabled) return;
    onSend(trimmed);
    setText("");
    // Reset textarea height
    if (taRef.current) taRef.current.style.height = "auto";
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function autoresize() {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(160, ta.scrollHeight) + "px";
  }

  return (
    <div className="sticky bottom-0 z-20 border-t border-void-500 bg-void-900/90 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
      {starters && starters.length > 0 && (
        <div className="mb-2 flex gap-2 overflow-x-auto pb-0.5">
          {starters.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                if (disabled) return;
                onSend(s);
              }}
              className="whitespace-nowrap rounded-full border border-void-500 bg-void-800/70 px-3 py-1.5 text-[12.5px] font-medium text-void-200 transition hover:border-void-400 hover:text-void-100 active:scale-[0.97]"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            autoresize();
          }}
          onKeyDown={onKey}
          rows={1}
          placeholder="Savolingizni yozing…"
          disabled={disabled}
          className="min-h-[44px] flex-1 resize-none rounded-[18px] border border-void-500 bg-void-800 px-4 py-2.5 text-[15px] leading-[1.4] text-void-100 outline-none transition-colors placeholder:text-void-400 focus:border-antares-500 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={send}
          disabled={disabled || text.trim().length === 0}
          aria-label="Yuborish"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-antares-500 text-void-100 transition hover:bg-antares-300 active:scale-[0.94] disabled:bg-void-700 disabled:text-void-400"
        >
          <Send className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
        </button>
      </div>
    </div>
  );
}
