"use client";

import { useState } from "react";
import { SIM_REGISTRY } from "../sims";
import type { Card } from "@/lib/lesson";

type ChallengeType = Extract<Card, { type: "challenge" }>;

export function ChallengeCard({ card, onComplete }: { card: ChallengeType; onComplete?: () => void }) {
  const [tries, setTries] = useState(0);
  const [won, setWon] = useState(false);
  const Sim = SIM_REGISTRY[card.sim];
  if (!Sim) return <div className="text-amber-300">Sim "{card.sim}" not registered.</div>;

  function onWin() {
    setWon(true);
    onComplete?.();
  }
  function onTry() { setTries((n) => n + 1); }

  return (
    <div className="w-full max-w-[560px] rounded-[32px] border border-void-500 bg-void-800 p-6 sm:p-8">
      <h3 className="text-xl font-semibold text-void-100">{card.heading}</h3>
      <div className="mt-3 rounded-xl border border-antares-500/40 bg-antares-500/10 p-3 text-sm text-antares-100">
        🎯 {card.goalUz}
      </div>
      <div className="mt-5"><Sim config={{ ...card.config, onWin, onTry }} onComplete={onWin} /></div>
      <p className="mt-3 text-xs text-void-400">Urinishlar: {tries} {won && "· ✓ qoyiluvchi!"}</p>
    </div>
  );
}
