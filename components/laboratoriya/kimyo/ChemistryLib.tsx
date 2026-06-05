// components/laboratoriya/kimyo/ChemistryLib.tsx
/**
 * ChemistryLib — Variant B: the library-powered 3D stage (3Dmol.js@2.5).
 *
 * Same phenomenon as Variant A, rendered as a true 3D ball-and-stick molecule
 * by 3Dmol's WebGL viewer. We do NOT re-implement chemistry — we read the
 * SAME ChemistryModel's eased poses + bonds (ångström) each frame and rebuild
 * the 3Dmol model, so the assembly animation is driven by the identical model
 * clock as Variant A. Once the reaction completes, the user can rotate / zoom
 * the finished molecule (3Dmol's built-in mouse controls).
 *
 * The container DIV MUST have an explicit size + position:relative or 3Dmol
 * renders 0px. Cleanup on unmount: viewer.clear() + el.innerHTML = "".
 */
"use client";

import { useEffect, useRef } from "react";
import { useProperty } from "@/lib/sim/observable/useProperty";
import type { ChemistryModel } from "@/lib/sims/chemistry/Model";
import { ATOMS } from "@/lib/sims/chemistry/data";

// 3Dmol ships its own TS types; import lazily inside the effect to keep it
// client-only and out of the SSR bundle.
type Viewer = {
  addModel: () => Model;
  removeAllModels: () => void;
  setStyle: (sel: object, style: object) => void;
  zoomTo: () => void;
  zoom: (factor: number, animationDuration?: number) => void;
  render: () => void;
  clear: () => void;
  resize: () => void;
  setBackgroundColor: (c: string) => void;
};
type Model = {
  addAtoms: (atoms: AtomLike[]) => void;
  setStyle: (sel: object, style: object) => void;
};
interface AtomLike {
  elem: string;
  x: number;
  y: number;
  z: number;
  bonds?: number[];
  bondOrder?: number[];
}

interface Props {
  model: ChemistryModel;
  /** Monotonic ms clock from the parent rAF loop — forces a re-render tick. */
  clock: number;
}

export default function ChemistryLib({ model, clock }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const readyRef = useRef(false);
  const zoomedRef = useRef(false);

  const phase = useProperty(model.phase);
  const matched = useProperty(model.matched);
  const progress = useProperty(model.progress);
  const tray = useProperty(model.tray);

  // ---- create the viewer once ---------------------------------------------
  useEffect(() => {
    let disposed = false;
    const el = hostRef.current;
    if (!el) return;

    (async () => {
      const $3Dmol = await import("3dmol");
      if (disposed || !hostRef.current) return;
      const viewer = $3Dmol.createViewer(hostRef.current, {
        backgroundColor: "#0b0f14",
        antialias: true,
      }) as unknown as Viewer;
      viewerRef.current = viewer;
      readyRef.current = true;
      drawFrame(viewer, model, true);
    })();

    return () => {
      disposed = true;
      readyRef.current = false;
      const v = viewerRef.current;
      // 3Dmol's GLViewer exposes no dispose() and leaks its WebGL context,
      // window "resize" + document mouseup/touchend listeners, and observers on
      // teardown. We can't reach the listeners, but we MUST deterministically
      // free the GPU context or we hit "too many active WebGL contexts" (black
      // viewer) after enough mount/unmounts. Lose the context first, then clear.
      if (el) {
        const cv = el.querySelector("canvas");
        try {
          cv?.getContext("webgl")?.getExtension?.("WEBGL_lose_context")?.loseContext();
        } catch {
          /* context already gone */
        }
      }
      if (v) {
        try {
          v.clear();
        } catch {
          /* viewer already torn down */
        }
      }
      viewerRef.current = null;
      if (el) el.innerHTML = "";
    };
  }, [model]);

  // ---- re-draw, but only when the scene actually changes -------------------
  // While ASSEMBLING the poses ease every frame, so the clock IS the trigger we
  // want. For idle/armed/product the scene is static — rebuilding on every clock
  // tick is wasted GPU work — so we gate the clock out of the deps unless we are
  // assembling, and otherwise depend ONLY on the inputs that can change the
  // picture (tray/matched/phase/progress).
  const assemblyClock = phase === "assembling" ? clock : 0;
  useEffect(() => {
    const v = viewerRef.current;
    if (!v || !readyRef.current) return;
    // Once the product is fully assembled, stop rebuilding so the user can
    // freely rotate/zoom without us resetting the camera each frame.
    if (phase === "product" && zoomedRef.current) return;
    const firstAssembled = phase === "product" && !zoomedRef.current;
    drawFrame(v, model, false);
    if (firstAssembled) {
      v.zoomTo();
      v.zoom(matched?.kind === "ionic" ? 0.7 : 1.1);
      v.render();
      zoomedRef.current = true;
    }
  }, [assemblyClock, phase, matched, progress, tray, model]);

  // reset the "zoomed" latch when a new reaction starts
  useEffect(() => {
    if (phase === "idle" || phase === "armed" || phase === "assembling") {
      zoomedRef.current = false;
    }
  }, [phase]);

  // ---- keep the WebGL canvas matched to its container -----------------------
  // The stage scales freely (full-width on md, large on lg, fullscreen), so the
  // 3Dmol viewer must re-measure its host or it renders at a stale size. We
  // debounce via rAF and call viewer.resize() + render().
  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === "undefined") return;
    let raf = 0;
    const refit = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const v = viewerRef.current;
        if (!v || !readyRef.current) return;
        // skip 0px frames (e.g. display:none parent) — resizing to 0 is invalid
        if (host.clientWidth < 2 || host.clientHeight < 2) return;
        try {
          v.resize();
          v.render();
        } catch {
          /* viewer torn down mid-resize */
        }
      });
    };
    const ro = new ResizeObserver(refit);
    ro.observe(host);
    const onFs = () => refit();
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [model]);

  return (
    <div className="relative w-full" style={{ aspectRatio: "520 / 360" }}>
      <div
        ref={hostRef}
        className="absolute inset-0 overflow-hidden rounded-[14px]"
        style={{ position: "absolute", background: "#0b0f14" }}
      />
      {/* gentle caption overlays — 3Dmol owns the canvas underneath */}
      {(phase === "idle" || phase === "armed") && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="max-w-[80%] text-center text-[13px] font-medium text-[#5b6b7d]">
            {matched
              ? "“Reaksiya” tugmasini bosing — 3Dmol dvigateli molekulani yigʻadi"
              : "Atomlarni torting yoki reaksiya tanlang — 3D molekula shu yerda paydo boʻladi"}
          </p>
        </div>
      )}
      {phase === "product" && (
        <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white/70 backdrop-blur-sm">
          aylantirib koʻring · sichqoncha bilan torting
        </div>
      )}
    </div>
  );
}

/**
 * Rebuild the 3Dmol model from the ChemistryModel's current eased poses + bonds.
 * For covalent reactions we pass per-atom bonds + bondOrder so 3Dmol draws
 * proper single/double/triple sticks. For ionic, we render packed spheres only
 * (a lattice, not a molecule). `initial` true → also seed the scattered start.
 */
function drawFrame(viewer: Viewer, model: ChemistryModel, initial: boolean): void {
  viewer.removeAllModels();
  const m = viewer.addModel();
  const phase = model.phase.value;

  // pre-reaction: show the gathered tray atoms loosely scattered
  if (phase === "idle" || phase === "armed") {
    const tray = model.tray.value;
    const atoms: AtomLike[] = tray.map((a, i) => {
      const ang = (i / Math.max(1, tray.length)) * Math.PI * 2;
      const ring = tray.length <= 1 ? 0 : 1.8;
      return { elem: a.el, x: Math.cos(ang) * ring, y: Math.sin(ang) * ring * 0.8, z: 0 };
    });
    m.addAtoms(atoms);
    applyStyle(viewer, model, false);
    if (initial) viewer.zoomTo();
    viewer.render();
    return;
  }

  const poses = model.poses();
  const bonds = model.bonds();
  const ionic = model.isIonic();

  // map slot → atom index (poses keep their slot order, but be robust)
  const slotToIndex = new Map<number, number>();
  poses.forEach((p, i) => slotToIndex.set(p.slot, i));

  const atoms: AtomLike[] = poses.map((p) => ({
    elem: p.el,
    x: p.x,
    y: p.y,
    z: p.z,
  }));

  if (!ionic) {
    // attach bonds (only once they've grown enough to read)
    for (const a of atoms) {
      a.bonds = [];
      a.bondOrder = [];
    }
    for (const bd of bonds) {
      if (bd.grow < 0.15) continue;
      const ia = slotToIndex.get(bd.a);
      const ib = slotToIndex.get(bd.b);
      if (ia == null || ib == null) continue;
      atoms[ia].bonds!.push(ib);
      atoms[ia].bondOrder!.push(bd.order);
      atoms[ib].bonds!.push(ia);
      atoms[ib].bondOrder!.push(bd.order);
    }
  }

  m.addAtoms(atoms);
  applyStyle(viewer, model, ionic);
  viewer.render();
}

/** CPK colors + ball-and-stick (covalent) or packed spheres (ionic). */
function applyStyle(viewer: Viewer, model: ChemistryModel, ionic: boolean): void {
  // 3Dmol's Jmol colorscheme matches our CPK palette closely; set per-element
  // sphere scale so big metals don't engulf the frame.
  if (ionic) {
    viewer.setStyle({}, { sphere: { scale: 0.4, colorscheme: "Jmol" } });
  } else {
    viewer.setStyle(
      {},
      {
        sphere: { scale: 0.3, colorscheme: "Jmol" },
        stick: { radius: 0.15, colorscheme: "Jmol" },
      },
    );
  }
  // ensure custom-element colors land even if Jmol lacks one
  for (const el of Object.keys(ATOMS)) {
    viewer.setStyle(
      { elem: el },
      ionic
        ? { sphere: { scale: 0.4, color: ATOMS[el].color } }
        : { sphere: { scale: 0.3, color: ATOMS[el].color }, stick: { radius: 0.15 } },
    );
  }
}
