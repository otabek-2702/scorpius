"use client";

import { useState } from "react";
import { SIM_REGISTRY } from "../sims";
import type { Card } from "@/lib/lesson";

type CompareType = Extract<Card, { type: "compare-and-decide" }>;

export function CompareDecideCard({ card, onComplete }: { card: CompareType; onComplete?: () => void }) {
  const [picked, setPicked] = useState<"A" | "B" | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const Sim = SIM_REGISTRY[card.sim];
  if (!Sim) return <div className="text-amber-300">Sim "{card.sim}" not registered.</div>;

  function submit() {
    if (!picked) return;
    setSubmitted(true);
    onComplete?.();
  }

  return (
    <div className="w-full max-w-[680px] rounded-[32px] border border-void-500 bg-void-800 p-6 sm:p-8">
      <h3 className="text-xl font-semibold text-void-100">{card.heading}</h3>
      <p className="mt-2 text-sm text-void-200">{card.questionUz}</p>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(["A", "B"] as const).map((key) => {
          const sc = key === "A" ? card.scenarioA : card.scenarioB;
          const isPicked = picked === key;
          const isCorrect = submitted && key === card.correctScenario;
          // Container is a <div>, NOT a <button> — the sim inside renders its own
          // <button> material chips, and a button cannot nest a button (invalid DOM
          // + hydration error). Selection lives in an explicit sibling button below.
          return (
            <div
              key={key}
              className={`rounded-2xl border p-4 text-left transition ${
                isPicked ? "border-antares-500 bg-antares-500/10" : "border-void-500 bg-void-700"
              } ${isCorrect ? "border-green-500 bg-green-500/10" : ""}`}
            >
              <p className="text-sm font-semibold text-void-100">{sc.titleUz}</p>
              <div className="mt-3"><Sim config={sc.simConfig} /></div>
              <button
                type="button"
                onClick={() => !submitted && setPicked(key)}
                disabled={submitted}
                className={`mt-3 w-full rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                  isPicked ? "border-antares-500 bg-antares-500/20 text-void-50" : "border-void-500 bg-void-800 text-void-200"
                }`}
              >
                {isPicked ? "✓ Tanlandi" : "Buni tanlayman"}
              </button>
            </div>
          );
        })}
      </div>
      {!submitted ? (
        <button onClick={submit} disabled={!picked} className="mt-4 w-full rounded-2xl bg-antares-500 px-4 py-3 font-semibold text-white disabled:opacity-40">Tanlovni tasdiqla</button>
      ) : (
        <div className="mt-4 rounded-2xl bg-green-500/10 p-4 text-green-100">{card.reveal}</div>
      )}
    </div>
  );
}
