"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { PERSONAS, type PersonaId } from "@/lib/personas";

interface Props {
  current: PersonaId;
  onPick: (id: PersonaId) => void;
  onClose: () => void;
}

/** Bottom-sheet persona picker. Same pattern as SkyView.StarSheet — scrim
 *  + slide-up panel + Escape closes. Each persona card shows the avatar in
 *  a tinted halo + name + focus + tagline. */
export function PersonaPicker({ current, onPick, onClose }: Props) {
  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = orig;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Yopish"
        onClick={onClose}
        className="absolute inset-0 bg-void-950/45 backdrop-blur-[2px]"
      />
      <div className="rise-in absolute inset-x-0 bottom-0 mx-auto w-full max-w-[480px] rounded-t-[28px] border border-void-500 bg-void-900 px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_48px_-12px_rgba(0,0,0,0.5)]">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-void-500" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Yopish"
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-void-300 transition hover:bg-void-700 hover:text-void-100"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-[1.1rem] font-semibold text-void-100">
          Bugun kim bilan suhbatlashasiz?
        </h2>
        <p className="mt-1 text-[12.5px] text-void-300">
          Har bir yo&apos;ldosh — Scorpius platformasidagi AI o&apos;qituvchi, mashhur shaxs uslubida.
        </p>

        <ul className="mt-4 flex flex-col gap-2 pb-1">
          {Object.values(PERSONAS).map((p) => {
            const active = p.id === current;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onPick(p.id)}
                  className={
                    "flex w-full items-center gap-3 rounded-[16px] border px-3.5 py-3 text-left transition active:scale-[0.99] " +
                    (active
                      ? "border-antares-500 bg-antares-50/10"
                      : "border-void-500 bg-void-800/70 hover:border-void-400")
                  }
                >
                  <span
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[22px]"
                    style={{
                      background: `${p.accentColor}26`,
                      boxShadow: `0 0 16px 2px ${p.accentColor}33`,
                    }}
                    aria-hidden
                  >
                    {p.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-[15.5px] font-semibold leading-tight text-void-100">
                        {p.displayName}
                      </div>
                      {active && (
                        <span className="rounded-full bg-antares-500/15 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-antares-700">
                          Hozir
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-[12px] text-void-300">
                      {p.focusUz}
                    </div>
                    <div className="mt-0.5 truncate text-[12.5px] text-void-200">
                      {p.taglineUz}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
