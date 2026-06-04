"use client";

import { SIM_REGISTRY } from "../sims";
import type { Card } from "@/lib/lesson";

type BuildType = Extract<Card, { type: "build" }>;

export function BuildCard({ card, onComplete }: { card: BuildType; onComplete?: () => void }) {
  const Sim = SIM_REGISTRY[card.sim];
  if (!Sim) return <div className="text-amber-300">Sim "{card.sim}" not registered.</div>;

  return (
    <div className="w-full max-w-[560px] rounded-[32px] border border-void-500 bg-void-800 p-6 sm:p-8">
      <h3 className="text-xl font-semibold text-void-100">{card.heading}</h3>
      <div className="mt-3 rounded-xl border border-antares-500/40 bg-antares-500/10 p-3 text-sm">
        🛠 {card.goalUz}
      </div>
      <p className="mt-2 text-xs italic text-void-400">{card.paletteUz}</p>
      <div className="mt-5"><Sim onComplete={onComplete} config={{ mode: "build" }} /></div>
    </div>
  );
}
