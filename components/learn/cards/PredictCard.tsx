"use client";

import { useState } from "react";
import type { Card } from "@/lib/lesson";

type PredictCardType = Extract<Card, { type: "predict" }>;

export function PredictCard({ card, onComplete }: { card: PredictCardType; onComplete?: () => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [num, setNum] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const isCorrect = submitted && (
    card.mode === "choice"
      ? picked === card.correctIndex
      : card.numericAnswer !== undefined && Math.abs(parseFloat(num) - card.numericAnswer) <= card.numericAnswer * (card.tolerancePct ?? 5) / 100
  );

  function submit() {
    if (card.mode === "choice" && picked === null) return;
    if (card.mode === "number" && num === "") return;
    setSubmitted(true);
    onComplete?.();
  }

  return (
    <div className="w-full max-w-[560px] rounded-[32px] border border-void-500 bg-void-800 p-6 sm:p-8">
      <h3 className="text-xl font-semibold text-void-100">{card.heading}</h3>
      <p className="mt-3 text-base text-void-200">{card.prompt}</p>
      {card.mode === "choice" && card.options && (
        <div className="mt-5 space-y-2">
          {card.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => !submitted && setPicked(i)}
              disabled={submitted}
              className={`block w-full rounded-2xl border px-4 py-3 text-left transition ${
                picked === i ? "border-antares-500 bg-antares-500/10" : "border-void-500 bg-void-700"
              } ${submitted && i === card.correctIndex ? "border-green-500 bg-green-500/10" : ""}`}
            >{opt}</button>
          ))}
        </div>
      )}
      {card.mode === "number" && (
        <input
          type="number"
          value={num}
          onChange={(e) => !submitted && setNum(e.target.value)}
          disabled={submitted}
          className="mt-5 w-full rounded-2xl border border-void-500 bg-void-700 px-4 py-3 text-void-100"
          placeholder="Sonni kiriting"
        />
      )}
      {!submitted ? (
        <button onClick={submit} className="mt-5 w-full rounded-2xl bg-antares-500 px-4 py-3 font-semibold text-white">Taxmin qiling</button>
      ) : (
        <div className={`mt-5 rounded-2xl p-4 ${isCorrect ? "bg-green-500/10 text-green-200" : "bg-amber-500/10 text-amber-200"}`}>
          {isCorrect ? "✓ Taxminingizni eslab qoldim. Endi sinab koʻramiz." : card.reveal}
        </div>
      )}
    </div>
  );
}
