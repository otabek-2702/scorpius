"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Sonning bo'luvchilari — a factor-pair grid lab.
 *
 * The learner sees 12 unit squares and tries to arrange them into a perfect
 * rectangle by choosing a "rows" slider. Some row counts work (1, 2, 3, 4,
 * 6, 12) and some don't (5, 7, 8, 9, 10, 11) — the rectangle becomes ragged.
 * Every time they land on a working row count, the pair (rows × cols) gets
 * recorded in the bottom panel: 1×12, 2×6, 3×4, 4×3, 6×2, 12×1.
 *
 * The whole thing is the lesson — divisors of N are exactly the row counts
 * that produce a clean rectangle, because they pair perfectly with N/rows.
 *
 * Completion: when the user has discovered ≥ 3 distinct factor pairs.
 */

interface Props {
  onComplete?: () => void;
  config?: Record<string, unknown>;
}

const N_DEFAULT = 12;
const VBW = 480;
const VBH = 280;

export function DivisorGridSim({ onComplete, config }: Props) {
  const N = Number((config?.n as number | undefined) ?? N_DEFAULT) || N_DEFAULT;
  const [rows, setRows] = useState<number>(3);
  const foundRef = useRef<Set<number>>(new Set());
  const [, forceRender] = useState(0);
  const completedRef = useRef(false);

  const cols = Math.ceil(N / rows);
  const used = rows * cols;
  const isClean = used === N; // rows divides N exactly

  useEffect(() => {
    if (isClean) {
      foundRef.current.add(rows);
      if (foundRef.current.size >= 3 && !completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
      forceRender((n) => n + 1);
    }
  }, [rows, isClean, onComplete]);

  // Layout: figure out cell size from the canvas
  const padX = 30;
  const padY = 30;
  const usableW = VBW - 2 * padX;
  const usableH = VBH - 2 * padY - 30; // leave room for the readout
  const cellSize = Math.min(usableW / cols, usableH / rows);
  const gridW = cellSize * cols;
  const gridH = cellSize * rows;
  const originX = (VBW - gridW) / 2;
  const originY = padY;

  // Render N filled cells (in row-major order) and (rows*cols − N) faded
  const cells: Array<{ r: number; c: number; filled: boolean }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      cells.push({ r, c, filled: idx < N });
    }
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="overflow-hidden rounded-[18px] border border-void-500 bg-void-700/40">
        <svg
          viewBox={`0 0 ${VBW} ${VBH}`}
          className="block w-full"
        >
          {cells.map((cell, i) => {
            const x = originX + cell.c * cellSize;
            const y = originY + cell.r * cellSize;
            return (
              <rect
                key={i}
                x={x + 1.5}
                y={y + 1.5}
                width={cellSize - 3}
                height={cellSize - 3}
                fill={
                  cell.filled
                    ? isClean
                      ? "#e8a21a"
                      : "#a07142"
                    : "rgba(132, 126, 107, 0.08)"
                }
                stroke={cell.filled ? "#1a1813" : "rgba(132, 126, 107, 0.4)"}
                strokeWidth={1}
                strokeDasharray={cell.filled ? undefined : "2 3"}
                rx={3}
              />
            );
          })}

          {/* Status badge */}
          <g transform="translate(14, 14)">
            <rect
              width={148}
              height={28}
              rx={6}
              fill={isClean ? "rgba(217, 138, 5, 0.95)" : "rgba(242, 239, 230, 0.85)"}
              stroke={isClean ? "#d98a05" : "rgba(132,126,107,0.45)"}
              strokeWidth={1}
            />
            <text
              x={74}
              y={18}
              fontSize={11}
              fontWeight={700}
              fill={isClean ? "#fbf9f3" : "#1a1813"}
              textAnchor="middle"
              letterSpacing="0.02em"
            >
              {isClean
                ? `${rows} × ${cols} = ${N} ✓`
                : `${rows} × ${cols} = ${used} ≠ ${N}`}
            </text>
          </g>
        </svg>
      </div>

      {/* Slider */}
      <div className="rounded-[14px] border border-void-500 bg-void-700/60 p-3">
        <div className="flex items-baseline justify-between">
          <label htmlFor="rows" className="text-[12px] font-semibold text-void-200">
            Qatorlar soni
          </label>
          <span className="font-mono text-[12px] text-void-300">{rows} qator</span>
        </div>
        <input
          id="rows"
          type="range"
          min={1}
          max={N}
          step={1}
          value={rows}
          onChange={(e) => setRows(Number(e.target.value))}
          className="mt-2 w-full accent-antares-500"
        />
      </div>

      {/* Found pairs */}
      <div className="rounded-[14px] border border-void-500 bg-void-700/40 p-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-void-200">
          Topilgan juftliklar · {foundRef.current.size} / 6
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {Array.from(foundRef.current)
            .sort((a, b) => a - b)
            .map((r) => (
              <span
                key={r}
                className="flex h-7 items-center rounded-full bg-antares-500/15 px-3 font-mono text-[12px] font-semibold tabular-nums text-void-100"
              >
                {r} × {N / r}
              </span>
            ))}
          {foundRef.current.size === 0 && (
            <span className="text-[12px] text-void-300">
              Slayderni harakatlantiring — to&apos;g&apos;ri to&apos;rtburchak topsangiz, juftlik bu yerda paydo bo&apos;ladi.
            </span>
          )}
        </div>
      </div>

      <p className="text-[12px] leading-relaxed text-void-300">
        Mukammal to&apos;rtburchakka mos keladigan qatorlar soni — bu{" "}
        <span className="text-void-200">{N} ning bo&apos;luvchilari</span>. Boshqasi —{" "}
        <em>raglan</em> qoldiq qoldiradi.
      </p>
    </div>
  );
}
