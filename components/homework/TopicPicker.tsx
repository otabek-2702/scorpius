"use client";

import { ChevronRight } from "lucide-react";
import { listWalkthroughs } from "@/lib/homework/walkthroughs";

interface Props {
  /** Called with the picked walkthrough id (a key in HOMEWORK_WALKTHROUGHS). */
  onPick: (id: string) => void;
}

/** Fallback grid shown when the vision call returns isProblem=false, or when
 *  the extracted topic has no walkthrough match. Lets the student pick a
 *  walkthrough manually so the surface still delivers value. */
export function TopicPicker({ onPick }: Props) {
  const items = listWalkthroughs();
  return (
    <div className="flex w-full flex-col gap-2.5">
      {items.map(({ id, lesson }) => (
        <button
          key={id}
          type="button"
          onClick={() => onPick(id)}
          className="group flex items-center gap-3 rounded-[16px] border border-void-500 bg-void-800/60 px-4 py-3.5 text-left transition hover:border-antares-500 hover:bg-void-800 active:scale-[0.99]"
        >
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-antares-700">
              {lesson.subjectLabel}
            </div>
            <div className="mt-1 text-[15.5px] font-semibold leading-snug text-void-100">
              {lesson.title}
            </div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-void-300 transition group-hover:translate-x-0.5 group-hover:text-void-100" />
        </button>
      ))}
    </div>
  );
}
