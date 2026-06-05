"use client";

import type { WeeklyPoint, SubjectSummary } from "@/lib/parentData";

/** Weekly-average area chart — 8-week trend of the child's mean mark.
 *  Pure SVG. Renders as a thin band so it sits comfortably in a Panel. */
export function WeeklyTrendChart({ data }: { data: WeeklyPoint[] }) {
  // Vertical range fixed to 2-5 (Uzbek school 1-5 scale; below 2 is rare).
  const VBW = 320;
  const VBH = 96;
  const PAD_X = 8;
  const PAD_TOP = 14;
  const PAD_BOTTOM = 22;
  const innerW = VBW - 2 * PAD_X;
  const innerH = VBH - PAD_TOP - PAD_BOTTOM;
  const Y_MIN = 2;
  const Y_MAX = 5;

  const points = data.map((p, i) => {
    const x = PAD_X + (i / Math.max(1, data.length - 1)) * innerW;
    if (p.avg === null) return { x, y: null as number | null, point: p };
    const y = PAD_TOP + innerH - ((p.avg - Y_MIN) / (Y_MAX - Y_MIN)) * innerH;
    return { x, y, point: p };
  });

  // Build the area path through the points that have a value. Gaps are
  // rendered by closing the area and reopening, but for cleanliness we draw
  // only the contiguous filled segments here — one path per run.
  const lines: string[] = [];
  const areas: string[] = [];
  let run: { x: number; y: number }[] = [];
  function flush() {
    if (run.length === 0) return;
    if (run.length === 1) {
      // Single dot — no line/area to draw.
      run = [];
      return;
    }
    const linePath = run.reduce(
      (acc, p, i) => acc + (i === 0 ? `M ${p.x.toFixed(2)} ${p.y.toFixed(2)} ` : `L ${p.x.toFixed(2)} ${p.y.toFixed(2)} `),
      "",
    );
    lines.push(linePath);
    const areaPath =
      linePath +
      `L ${run[run.length - 1].x.toFixed(2)} ${(PAD_TOP + innerH).toFixed(2)} ` +
      `L ${run[0].x.toFixed(2)} ${(PAD_TOP + innerH).toFixed(2)} Z`;
    areas.push(areaPath);
    run = [];
  }
  for (const p of points) {
    if (p.y === null) {
      flush();
    } else {
      run.push({ x: p.x, y: p.y });
    }
  }
  flush();

  // Y reference lines at 3 and 5.
  const yRefs = [3, 4, 5].map((v) => ({
    v,
    y: PAD_TOP + innerH - ((v - Y_MIN) / (Y_MAX - Y_MIN)) * innerH,
  }));

  return (
    <svg
      viewBox={`0 0 ${VBW} ${VBH}`}
      className="block h-auto w-full"
      role="img"
      aria-label="Haftalik o'rtacha baho — 8 hafta"
    >
      {/* Y reference lines */}
      {yRefs.map((r) => (
        <g key={r.v}>
          <line
            x1={PAD_X}
            y1={r.y}
            x2={VBW - PAD_X}
            y2={r.y}
            stroke="var(--color-void-500)"
            strokeWidth={0.6}
            strokeDasharray="2 3"
          />
          <text
            x={VBW - PAD_X + 2}
            y={r.y + 3}
            fontSize="8"
            fill="var(--color-void-400)"
            fontFamily="ui-monospace, monospace"
          >
            {r.v}
          </text>
        </g>
      ))}

      {/* Filled areas — one per contiguous run */}
      {areas.map((a, i) => (
        <path key={`a${i}`} d={a} fill="var(--color-antares-500)" opacity={0.18} />
      ))}
      {/* Line strokes */}
      {lines.map((l, i) => (
        <path
          key={`l${i}`}
          d={l}
          fill="none"
          stroke="var(--color-antares-500)"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {/* Dots for each known week */}
      {points.map((p, i) =>
        p.y === null ? null : (
          <circle
            key={`d${i}`}
            cx={p.x}
            cy={p.y}
            r={2.2}
            fill="var(--color-antares-500)"
          />
        ),
      )}

      {/* X axis labels — first and last only */}
      {points.length > 0 && (
        <>
          <text
            x={PAD_X}
            y={VBH - 6}
            fontSize="8"
            fill="var(--color-void-300)"
            fontFamily="ui-monospace, monospace"
          >
            {points[0].point.label}
          </text>
          <text
            x={VBW - PAD_X}
            y={VBH - 6}
            fontSize="8"
            fill="var(--color-void-300)"
            fontFamily="ui-monospace, monospace"
            textAnchor="end"
          >
            {points[points.length - 1].point.label}
          </text>
        </>
      )}
    </svg>
  );
}

/** Per-subject mini sparkline — the last ~6 marks as a tight line. */
export function SubjectSparkline({ marks }: { marks: number[] }) {
  if (marks.length === 0) return null;
  const VBW = 72;
  const VBH = 22;
  const PAD = 2;
  const Y_MIN = 2;
  const Y_MAX = 5;
  const innerW = VBW - 2 * PAD;
  const innerH = VBH - 2 * PAD;
  const pts = marks.map((v, i) => {
    const x = PAD + (marks.length === 1 ? innerW / 2 : (i / (marks.length - 1)) * innerW);
    const y = PAD + innerH - ((Math.max(Y_MIN, Math.min(Y_MAX, v)) - Y_MIN) / (Y_MAX - Y_MIN)) * innerH;
    return { x, y, v };
  });
  const d = pts.reduce(
    (acc, p, i) => acc + (i === 0 ? `M ${p.x.toFixed(2)} ${p.y.toFixed(2)} ` : `L ${p.x.toFixed(2)} ${p.y.toFixed(2)} `),
    "",
  );
  return (
    <svg viewBox={`0 0 ${VBW} ${VBH}`} className="block h-[22px] w-[72px]" aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={1.4} fill="currentColor" />
      ))}
    </svg>
  );
}

/** Homework status donut — done vs not-done over the rolling 7 days. */
export function HomeworkDonut({
  done,
  notDone,
}: {
  done: number;
  notDone: number;
}) {
  const total = done + notDone;
  const VBW = 84;
  const VBH = 84;
  const cx = VBW / 2;
  const cy = VBH / 2;
  const r = 32;
  const STROKE = 10;
  const circumference = 2 * Math.PI * r;
  const donePortion = total === 0 ? 0 : (done / total) * circumference;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox={`0 0 ${VBW} ${VBH}`} className="h-[84px] w-[84px]" role="img" aria-label="Uy vazifasi holati">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--color-void-500)"
          strokeWidth={STROKE}
        />
        {total > 0 && (
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--color-signal-correct)"
            strokeWidth={STROKE}
            strokeDasharray={`${donePortion.toFixed(2)} ${(circumference - donePortion).toFixed(2)}`}
            strokeDashoffset={circumference / 4}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        )}
        <text
          x={cx}
          y={cy + 1}
          textAnchor="middle"
          fontSize="18"
          fontWeight={700}
          fill="var(--color-void-100)"
          fontFamily="ui-monospace, monospace"
        >
          {total === 0 ? "—" : `${Math.round((done / total) * 100)}%`}
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          fontSize="8"
          fill="var(--color-void-300)"
          fontFamily="ui-monospace, monospace"
        >
          tugatildi
        </text>
      </svg>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-signal-correct" />
          <span className="text-[13px] text-void-200">
            <span className="font-semibold text-void-100">{done}</span> bajarildi
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-void-500" />
          <span className="text-[13px] text-void-200">
            <span className="font-semibold text-void-100">{notDone}</span> kutmoqda
          </span>
        </div>
      </div>
    </div>
  );
}

/** Subject row used inside the grade table — name, sparkline, average, trend. */
export function SubjectGradeRow({ row }: { row: SubjectSummary }) {
  const avgLabel =
    row.computedAverage !== null
      ? row.computedAverage.toFixed(1)
      : row.reportedAverage ?? "—";
  const trendBadge =
    row.trend === "up"
      ? { sym: "↑", color: "text-signal-correct" }
      : row.trend === "down"
        ? { sym: "↓", color: "text-signal-error" }
        : row.trend === "flat"
          ? { sym: "→", color: "text-void-300" }
          : { sym: "·", color: "text-void-400" };
  // Color the row's accent by the subject's level: green ≥4.5, gold 3.5-4.5,
  // red <3.5. Falls back to neutral when no marks.
  const accent =
    row.computedAverage === null
      ? "text-void-300"
      : row.computedAverage >= 4.5
        ? "text-signal-correct"
        : row.computedAverage >= 3.5
          ? "text-antares-700"
          : "text-signal-error";
  return (
    <div className="grid grid-cols-[1fr_72px_64px] items-center gap-3 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-[14.5px] font-semibold text-void-100">{row.subject}</div>
        <div className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-void-300">
          {row.count} ta baho
          {row.finalMark ? ` · yakuniy: ${row.finalMark}` : ""}
        </div>
      </div>
      <div className={accent}>
        <SubjectSparkline marks={row.recentMarks} />
      </div>
      <div className="text-right">
        <div className={`font-mono text-[1.05rem] font-bold tabular-nums ${accent}`}>
          {avgLabel}
        </div>
        <div className={`text-[10.5px] font-bold ${trendBadge.color}`}>{trendBadge.sym}</div>
      </div>
    </div>
  );
}
