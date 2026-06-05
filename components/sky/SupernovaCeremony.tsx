"use client";

import { useEffect, useState } from "react";
import type { Supernova } from "@/lib/supernova";

/** The Supernova cinematic overlay.
 *
 *  Three beats over ~5 seconds:
 *   - 0.0–1.2s: dimmed stars rush inward (collapse), gold core ignites
 *   - 1.2–3.0s: core blooms — radial gradient flare, particle shockwave
 *   - 3.0–5.0s: name + date typeset over the bloom, "Davom etish" appears
 *
 *  Pure SVG + a few `transform` keyframes. No deps. Full-screen z-50 modal.
 *  The user can dismiss earlier by tapping anywhere after the bloom settles.
 */
export function SupernovaCeremony({
  supernova,
  onDismiss,
}: {
  supernova: Supernova;
  onDismiss: () => void;
}) {
  const [phase, setPhase] = useState<"collapse" | "bloom" | "name">("collapse");

  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase("bloom"), 1200);
    const t2 = window.setTimeout(() => setPhase("name"), 3000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  // 8 incoming star points laid out around a circle — they shrink into the core.
  const STARS = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2;
    return {
      x: 200 + 160 * Math.cos(angle),
      y: 200 + 160 * Math.sin(angle),
      delay: i * 80,
    };
  });

  return (
    <div
      role="dialog"
      aria-label="Supernova ceremony"
      onClick={phase === "name" ? onDismiss : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center bg-void-950/95 backdrop-blur-sm"
      style={{ animation: "fadeIn 280ms ease" }}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes coreSwell {
          0%   { transform: scale(0.4); opacity: 0.55; }
          55%  { transform: scale(1.05); opacity: 1; }
          75%  { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.02); opacity: 1; }
        }
        @keyframes coreGlow {
          0%   { filter: blur(28px); opacity: 0.4; }
          55%  { filter: blur(48px); opacity: 1; }
          100% { filter: blur(36px); opacity: 0.85; }
        }
        @keyframes starCollapse {
          0%   { transform: translate(0, 0); opacity: 0.85; }
          100% { transform: translate(var(--dx), var(--dy)); opacity: 0; }
        }
        @keyframes nameIn {
          0%   { opacity: 0; transform: translateY(8px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes shockwave {
          0%   { transform: scale(0.4); opacity: 0.55; }
          100% { transform: scale(3.2); opacity: 0; }
        }
      `}</style>

      <div className="relative h-[420px] w-[420px]">
        <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full">
          <defs>
            <radialGradient id="core-rad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff7d7" stopOpacity={1} />
              <stop offset="30%" stopColor="#fbd362" stopOpacity={0.95} />
              <stop offset="65%" stopColor="#e8a21a" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#e8a21a" stopOpacity={0} />
            </radialGradient>
            <radialGradient id="shock-rad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#e8a21a" stopOpacity={0} />
              <stop offset="80%" stopColor="#e8a21a" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#e8a21a" stopOpacity={0} />
            </radialGradient>
          </defs>

          {/* Glow halo behind the core */}
          {phase !== "collapse" && (
            <circle
              cx="200"
              cy="200"
              r="120"
              fill="url(#core-rad)"
              style={{ animation: "coreGlow 1.8s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
            />
          )}

          {/* The collapsing stars — only during the collapse beat */}
          {phase === "collapse" &&
            STARS.map((s, i) => {
              const dx = 200 - s.x;
              const dy = 200 - s.y;
              return (
                <circle
                  key={i}
                  cx={s.x}
                  cy={s.y}
                  r="4"
                  fill="#fbf9f3"
                  opacity="0.9"
                  style={{
                    ["--dx" as string]: `${dx}px`,
                    ["--dy" as string]: `${dy}px`,
                    animation: `starCollapse 1.1s cubic-bezier(0.6, 0, 0.1, 1) ${s.delay}ms forwards`,
                  }}
                />
              );
            })}

          {/* Shockwave ring during bloom */}
          {phase !== "collapse" && (
            <circle
              cx="200"
              cy="200"
              r="60"
              fill="url(#shock-rad)"
              style={{
                transformOrigin: "200px 200px",
                animation: "shockwave 1.8s ease-out forwards",
              }}
            />
          )}

          {/* The bright supernova core */}
          {phase !== "collapse" && (
            <circle
              cx="200"
              cy="200"
              r="60"
              fill="url(#core-rad)"
              style={{
                transformOrigin: "200px 200px",
                animation: "coreSwell 1.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
              }}
            />
          )}
        </svg>

        {/* Name overlay — appears in the third beat */}
        {phase === "name" && (
          <div
            className="absolute inset-x-0 bottom-0 px-6 text-center"
            style={{ animation: "nameIn 480ms cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
          >
            <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.18em] text-antares-300">
              Supernova
            </p>
            <h2
              className="mt-2 text-[1.6rem] font-medium leading-tight text-void-100"
              style={{ fontFamily: '"Newsreader", Georgia, serif', letterSpacing: "-0.01em" }}
            >
              <em className="not-italic">{supernova.name.split("'ning")[0]}</em>
              <em className="italic text-antares-300">&apos;ning supernovasi</em>
            </h2>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-void-300">
              {supernova.whenLabel}
            </p>
          </div>
        )}
      </div>

      {/* Dismiss button — only after the name has appeared */}
      {phase === "name" && (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute bottom-[max(36px,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 rounded-full bg-antares-500 px-7 py-3 text-[14px] font-semibold text-void-100 shadow-[0_4px_22px_-6px_rgba(232,162,26,0.55)] transition hover:bg-antares-300 active:scale-[0.97]"
        >
          Davom etish
        </button>
      )}
    </div>
  );
}
