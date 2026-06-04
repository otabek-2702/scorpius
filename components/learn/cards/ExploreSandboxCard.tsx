"use client";

import { useEffect, useState } from "react";
import { SIM_REGISTRY } from "../sims";
import type { Card } from "@/lib/lesson";

type SandboxType = Extract<Card, { type: "explore-sandbox" }>;

export function ExploreSandboxCard({ card, onComplete }: { card: SandboxType; onComplete?: () => void }) {
  const [interactions, setInteractions] = useState(0);

  // Fire completion from an effect — never call onComplete (which setStates in
  // LessonDeck) inside this component's render or a setState updater.
  useEffect(() => {
    if (interactions >= card.minInteractions) onComplete?.();
  }, [interactions, card.minInteractions, onComplete]);

  const Sim = SIM_REGISTRY[card.sim];
  if (!Sim) return <div className="text-amber-300">Sim "{card.sim}" not registered.</div>;

  return (
    <div className="w-full max-w-[560px] rounded-[32px] border border-void-500 bg-void-800 p-6 sm:p-8">
      <h3 className="text-xl font-semibold text-void-100">{card.heading}</h3>
      <p className="mt-2 text-sm italic text-void-300">{card.promptUz}</p>
      <div className="mt-5"><Sim config={card.config} onComplete={() => setInteractions((n) => n + 1)} /></div>
      <p className="mt-4 text-xs text-void-400">Sinab koʻrildi: {interactions} / {card.minInteractions}</p>
    </div>
  );
}
