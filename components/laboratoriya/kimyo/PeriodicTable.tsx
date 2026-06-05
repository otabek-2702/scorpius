// components/laboratoriya/kimyo/PeriodicTable.tsx
/**
 * PeriodicTable — the "Davriy jadval" picker.
 *
 * Renders the full 118-element table on the standard 18-column grid (the
 * lanthanide/actinide series detached on rows 8 + 9, the textbook layout).
 * Each cell is tinted by element CATEGORY with a CPK colour swatch + the atomic
 * number Z. Tapping a cell selects that element → the parent shows its Bohr
 * atom in the AtomViewer. The lab/curated elements (the ones that drive real
 * reactions) carry a gold ring and are DRAGGABLE straight into the reaction
 * chamber (same drag contract as the element palette), so a learner can hop
 * from "see the atom" to "use it in a reaction" without leaving the table.
 *
 * Pure presentational — all data comes from periodic.ts; selection + drag are
 * lifted to the parent KimyoLab.
 */
"use client";

import {
  PERIODIC,
  PT_COLS,
  PT_ROWS,
  CATEGORY_UZ,
  CATEGORY_TINT,
  type Category,
  type PTElement,
} from "@/lib/sims/chemistry/periodic";
import { CURATED_ATOMS } from "@/lib/sims/chemistry/data";

const CURATED = new Set(CURATED_ATOMS);

interface Props {
  /** Currently selected element symbol (highlighted). */
  selected: string;
  /** Tap a cell → select that element for the atom viewer. */
  onSelect: (sym: string) => void;
  /** Drag a curated element onto the chamber (HTML5 DnD). */
  onDragElement?: (sym: string) => void;
  onDragEnd?: () => void;
}

export default function PeriodicTable({
  selected,
  onSelect,
  onDragElement,
  onDragEnd,
}: Props) {
  // categories present, in legend order
  const legendCats: Category[] = [
    "alkali", "alkaline", "transition", "post-transition", "metalloid",
    "nonmetal", "halogen", "noble", "lanthanide", "actinide",
  ];

  return (
    <div className="flex w-full flex-col gap-2">
      {/* the grid — scales to fill width; cells are square via aspect-ratio */}
      <div
        className="grid w-full gap-[2px] sm:gap-[3px]"
        style={{
          gridTemplateColumns: `repeat(${PT_COLS}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${PT_ROWS}, minmax(0, 1fr))`,
        }}
        role="grid"
        aria-label="Davriy jadval"
      >
        {PERIODIC.map((el) => (
          <Cell
            key={el.z}
            el={el}
            selected={el.sym === selected}
            curated={CURATED.has(el.sym)}
            onSelect={() => onSelect(el.sym)}
            onDragElement={onDragElement}
            onDragEnd={onDragEnd}
          />
        ))}

        {/* the "*" / "**" placeholders pointing to the La/Ac series rows */}
        <SeriesMarker row={6} col={3} text="57–71" />
        <SeriesMarker row={7} col={3} text="89–103" />
      </div>

      {/* legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-0.5 pt-1">
        {legendCats.map((c) => (
          <span key={c} className="inline-flex items-center gap-1 text-[9.5px] text-void-300">
            <span
              className="inline-block h-2.5 w-2.5 rounded-[3px]"
              style={{ background: CATEGORY_TINT[c] }}
            />
            {CATEGORY_UZ[c]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1 text-[9.5px] text-antares-700">
          <span className="inline-block h-2.5 w-2.5 rounded-[3px] ring-2 ring-antares-500" />
          Laboratoriya elementi (torting)
        </span>
      </div>
    </div>
  );
}

function Cell({
  el,
  selected,
  curated,
  onSelect,
  onDragElement,
  onDragEnd,
}: {
  el: PTElement;
  selected: boolean;
  curated: boolean;
  onSelect: () => void;
  onDragElement?: (sym: string) => void;
  onDragEnd?: () => void;
}) {
  const tint = CATEGORY_TINT[el.cat];
  return (
    <button
      type="button"
      role="gridcell"
      draggable={curated && !!onDragElement}
      onClick={onSelect}
      onDragStart={curated ? () => onDragElement?.(el.sym) : undefined}
      onDragEnd={curated ? onDragEnd : undefined}
      aria-label={`${el.nameUz} (${el.sym}), Z=${el.z}${curated ? " — laboratoriya elementi, kameraga torting" : ""}`}
      aria-pressed={selected}
      title={`${el.nameUz} · Z=${el.z} · ${el.weight}`}
      className={`group relative flex aspect-square min-w-0 flex-col items-center justify-center overflow-hidden rounded-[3px] leading-none transition active:scale-90 ${
        selected ? "z-10 ring-2 ring-white" : curated ? "ring-1 ring-antares-500/80" : ""
      }`}
      style={{
        gridColumnStart: el.col,
        gridRowStart: el.row,
        background: tint,
      }}
    >
      <span
        className="absolute left-[2px] top-[1px] font-mono text-[clamp(4px,0.8vw,7px)] font-semibold text-white/70"
        aria-hidden
      >
        {el.z}
      </span>
      <span
        className="font-serif text-[clamp(7px,1.5vw,13px)] font-bold"
        style={{ color: el.sym === "H" ? "#ffffff" : el.color, textShadow: "0 1px 2px rgba(0,0,0,0.55)" }}
      >
        {el.sym}
      </span>
    </button>
  );
}

function SeriesMarker({ row, col, text }: { row: number; col: number; text: string }) {
  return (
    <div
      className="flex aspect-square items-center justify-center rounded-[3px] border border-dashed border-void-500 bg-void-800/40"
      style={{ gridColumnStart: col, gridRowStart: row }}
      aria-hidden
    >
      <span className="font-mono text-[clamp(4px,0.7vw,7px)] text-void-300">{text}</span>
    </div>
  );
}
