"use client";

import { BookOpen, Trash2 } from "lucide-react";
import { formatTs, useLabNotebook } from "@/lib/labNotebook";

/** Lab Notebook panel — renders the list of measurements the student took
 *  inside the current sim. Shown directly below the sim canvas inside the
 *  SimulationCard. Empty state nudges exploration. */
export function LabNotebookPanel() {
  const { entries, clear } = useLabNotebook();

  return (
    <div className="mt-4 overflow-hidden rounded-[16px] border border-void-500 bg-void-700/40">
      <header className="flex items-center justify-between gap-2 border-b border-void-500 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5 text-antares-700" />
          <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-void-200">
            Labaratoriya daftari
          </span>
          {entries.length > 0 && (
            <span className="font-mono text-[10.5px] tabular-nums text-void-300">
              {entries.length}
            </span>
          )}
        </div>
        {entries.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-void-300 transition hover:text-void-100"
          >
            <Trash2 className="h-3 w-3" />
            Tozalash
          </button>
        )}
      </header>

      {entries.length === 0 ? (
        <div className="flex items-center justify-center px-4 py-6 text-center">
          <p className="text-[12.5px] leading-relaxed text-void-300">
            Sim bilan ishlang — sizning o&apos;lchovlaringiz shu yerda yig&apos;iladi.
          </p>
        </div>
      ) : (
        <ul className="max-h-[180px] divide-y divide-void-500 overflow-y-auto">
          {entries.map((e) => (
            <li
              key={e.id}
              className="grid grid-cols-[64px_1fr] items-baseline gap-3 px-4 py-2"
            >
              <span className="font-mono text-[10.5px] tabular-nums text-void-300">
                {formatTs(e.ts)}
              </span>
              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[12px] font-bold text-antares-700">
                    {e.label}
                  </span>
                  <span className="font-mono text-[13px] font-semibold tabular-nums text-void-100">
                    {e.value}
                  </span>
                </div>
                {e.context && (
                  <p className="mt-0.5 truncate text-[11.5px] text-void-300">{e.context}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
