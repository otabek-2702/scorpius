// components/reels/accents.ts
import type { ReelAccent } from "./reelsData";

/**
 * Per-accent visual identity for a reel. Each reel paints its own bold,
 * near-black stage so the feed feels "every reel different". Values are raw
 * hex/rgba (used in inline styles + canvas), not Tailwind classes, because the
 * stages are gradients and the confetti reads the colors directly.
 */
export interface AccentTheme {
  /** Primary saturated accent. */
  hex: string;
  /** A lighter companion for gradients / highlights. */
  hexSoft: string;
  /** CSS gradient for the reel stage background (dark, vivid). */
  stage: string;
  /** Confetti palette. */
  confetti: string[];
}

export const ACCENTS: Record<ReelAccent, AccentTheme> = {
  teal: {
    hex: "#2dd4bf",
    hexSoft: "#5eead4",
    stage:
      "radial-gradient(120% 90% at 18% 8%, rgba(45,212,191,0.26), transparent 55%), linear-gradient(160deg, #06201d 0%, #07100f 55%, #050807 100%)",
    confetti: ["#2dd4bf", "#5eead4", "#99f6e4", "#0d9488", "#fbf9f3"],
  },
  violet: {
    hex: "#a855f7",
    hexSoft: "#c084fc",
    stage:
      "radial-gradient(120% 90% at 82% 10%, rgba(168,85,247,0.28), transparent 55%), linear-gradient(160deg, #1b0a2e 0%, #120920 55%, #07040d 100%)",
    confetti: ["#a855f7", "#c084fc", "#e9d5ff", "#7e22ce", "#fbf9f3"],
  },
  emerald: {
    hex: "#34d399",
    hexSoft: "#6ee7b7",
    stage:
      "radial-gradient(120% 90% at 20% 12%, rgba(52,211,153,0.24), transparent 55%), linear-gradient(160deg, #07221a 0%, #08130f 55%, #050807 100%)",
    confetti: ["#34d399", "#6ee7b7", "#a7f3d0", "#059669", "#fbf9f3"],
  },
  gold: {
    hex: "#e8a21a",
    hexSoft: "#f4b63e",
    stage:
      "radial-gradient(120% 95% at 80% 8%, rgba(232,162,26,0.30), transparent 55%), linear-gradient(160deg, #2a1c04 0%, #1a1203 55%, #0a0702 100%)",
    confetti: ["#e8a21a", "#f4b63e", "#fde68a", "#b45309", "#fbf9f3"],
  },
  blue: {
    hex: "#3b7bd1",
    hexSoft: "#60a5fa",
    stage:
      "radial-gradient(120% 90% at 18% 10%, rgba(59,123,209,0.28), transparent 55%), linear-gradient(160deg, #0a1a30 0%, #08111f 55%, #04070d 100%)",
    confetti: ["#3b7bd1", "#60a5fa", "#bfdbfe", "#1d4ed8", "#fbf9f3"],
  },
};

/** Uzbek labels for the subject pill. */
export const SUBJECT_LABEL: Record<string, string> = {
  fizika: "Fizika",
  kimyo: "Kimyo",
  biologiya: "Biologiya",
  matematika: "Matematika",
  astronomiya: "Astronomiya",
};
