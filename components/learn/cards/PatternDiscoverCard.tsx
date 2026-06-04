"use client";

import { useState } from "react";
import { SIM_REGISTRY } from "../sims";
import type { Card } from "@/lib/lesson";

type PatternType = Extract<Card, { type: "pattern-discover" }>;

export function PatternDiscoverCard({ card, onComplete }: { card: PatternType; onComplete?: () => void }) {
  const [run, setRun] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const Sim = SIM_REGISTRY[card.sim];
  if (!Sim) return <div className="text-amber-300">Sim "{card.sim}" not registered.</div>;

  const value = card.paramValues[run] ?? card.paramValues[0];

  function submit() {
    if (picked === null) return;
    setSubmitted(true);
    onComplete?.();
  }

  return (
    <div className="w-full max-w-[560px] rounded-[32px] border border-void-500 bg-void-800 p-6 sm:p-8">
      <h3 className="text-xl font-semibold text-void-100">{card.heading}</h3>
      <div className="mt-3 flex gap-2 text-xs">
        {card.paramValues.map((v, i) => (
          <button key={i} onClick={() => setRun(i)} className={`rounded px-3 py-1 ${run === i ? "bg-antares-500 text-white" : "bg-void-700 text-void-200"}`}>
            {card.paramName}={v}
          </button>
        ))}
      </div>
      <div className="mt-5"><Sim config={{ [card.paramName]: value }} /></div>
      <p className="mt-4 text-sm text-void-200">Qaysi qoidaga ergashadi?</p>
      <div className="mt-2 space-y-2">
        {card.patternOptions.map((opt, i) => (
          <button
            key={i}
            onClick={() => !submitted && setPicked(i)}
            disabled={submitted}
            className={`block w-full rounded-2xl border px-4 py-3 text-left ${
              picked === i ? "border-antares-500 bg-antares-500/10" : "border-void-500 bg-void-700"
            } ${submitted && i === card.correctIndex ? "border-green-500 bg-green-500/10" : ""}`}
          >{opt}</button>
        ))}
      </div>
      {!submitted ? (
        <button onClick={submit} disabled={picked === null} className="mt-4 w-full rounded-2xl bg-antares-500 px-4 py-3 font-semibold text-white disabled:opacity-40">Tasdiqlash</button>
      ) : (
        <div className="mt-4 rounded-2xl bg-green-500/10 p-4 text-green-100">Formula: {card.revealFormulaUz}</div>
      )}
    </div>
  );
}
