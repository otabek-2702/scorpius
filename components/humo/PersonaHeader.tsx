"use client";

import { ChevronDown } from "lucide-react";
import type { Persona } from "@/lib/personas";

interface Props {
  persona: Persona;
  onSwitch: () => void;
}

/** Sticky top header — shows current persona avatar + name + tap-to-switch.
 *  The accent color comes from the persona itself so each chat *feels*
 *  like a different person, not just a chatbot in a different hat. */
export function PersonaHeader({ persona, onSwitch }: Props) {
  return (
    <button
      type="button"
      onClick={onSwitch}
      className="sticky top-0 z-30 flex w-full items-center gap-3 border-b border-void-500 bg-void-900/85 px-5 py-3 backdrop-blur-md transition active:scale-[0.995]"
    >
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[20px]"
        style={{
          background: `${persona.accentColor}1f`,
          boxShadow: `0 0 18px 2px ${persona.accentColor}33`,
        }}
        aria-hidden
      >
        {persona.emoji}
      </span>
      <div className="min-w-0 flex-1 text-left">
        <div className="text-[15.5px] font-semibold leading-tight text-void-100">
          {persona.displayName}
        </div>
        <div className="truncate text-[11.5px] text-void-300">{persona.focusUz}</div>
      </div>
      <ChevronDown className="h-4 w-4 shrink-0 text-void-300" />
    </button>
  );
}
