// components/learn/useLessonBus.tsx
"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { LessonBus } from "@/lib/sim/LessonBus";

const Ctx = createContext<LessonBus | null>(null);

export function LessonBusProvider({ children }: { children: ReactNode }) {
  const bus = useMemo(() => new LessonBus(), []);
  return <Ctx.Provider value={bus}>{children}</Ctx.Provider>;
}

export function useLessonBus(): LessonBus {
  const bus = useContext(Ctx);
  if (!bus) throw new Error("useLessonBus called outside <LessonBusProvider>");
  return bus;
}
