// components/laboratoriya/labsCatalog.ts
/**
 * labsCatalog — the single source of truth for the multi-subject Laboratoriya hub.
 *
 * Everything the hub renders (subject tabs, big lab cards, quick-experiment
 * cards, "Tez orada" placeholders) is driven from this data so a new lab drops
 * in with one entry and lands under the right subject tab automatically.
 *
 * Each subject owns ONE saturated accent (used for the active tab pill, the card
 * chrome, and the cinematic stage glow). The "kind" field decides the card
 * shape: a "lab" is a big card with a live dark-stage mini-preview, an
 * "experiment" is a compact quick-tajriba tile, and "soon" is a dashed
 * coming-soon placeholder.
 *
 * No React here — this is plain data. The hub maps it to components.
 */
import {
  Atom,
  CircleDot,
  Droplets,
  Eclipse,
  FlaskConical,
  Grid3x3,
  Leaf,
  Microscope,
  Sigma,
  Spline,
  Triangle,
  type LucideIcon,
} from "lucide-react";

/** The four teachable subjects, plus the "all" pseudo-tab. */
export type SubjectId = "fizika" | "kimyo" | "biologiya" | "matematika";
export type TabId = "all" | SubjectId;

/** Per-card kind drives which card component renders the entry. */
export type LabKind = "lab" | "experiment" | "soon";

export interface SubjectMeta {
  id: SubjectId;
  /** Tab label (Uzbek, Latin). */
  label: string;
  /** Saturated accent for tab + chrome + stage glow. */
  accent: string;
  /** Translucent wash of the accent for icon chips / soft fills. */
  soft: string;
}

/** Tab order: Hammasi (all) first, then the four subjects. */
export const SUBJECTS: SubjectMeta[] = [
  { id: "fizika", label: "Fizika", accent: "#2dd4bf", soft: "rgba(45,212,191,0.14)" },
  { id: "kimyo", label: "Kimyo", accent: "#a855f7", soft: "rgba(168,85,247,0.14)" },
  { id: "biologiya", label: "Biologiya", accent: "#34d399", soft: "rgba(52,211,153,0.14)" },
  { id: "matematika", label: "Matematika", accent: "#3b7bd1", soft: "rgba(59,123,209,0.14)" },
];

/** Quick lookup of a subject's accent pair by id. */
export const SUBJECT_BY_ID: Record<SubjectId, SubjectMeta> = SUBJECTS.reduce(
  (acc, s) => {
    acc[s.id] = s;
    return acc;
  },
  {} as Record<SubjectId, SubjectMeta>,
);

export interface CatalogEntry {
  subject: SubjectId;
  kind: LabKind;
  /** Stable key (used as React key + for preview routing). */
  id: string;
  title: string;
  /** One-line Uzbek hook. */
  hook: string;
  /** Destination route. Empty for "soon" entries. */
  href: string;
  /** Accent for this card (usually the subject accent; experiments may differ). */
  accent: string;
  soft: string;
  /** Card icon. */
  icon: LucideIcon;
  /** Optional uppercase tag shown on big lab cards (e.g. "Mexanika"). */
  tag?: string;
  /** Which live mini-preview a big "lab" card paints, if any. */
  preview?: "collision" | "molecule" | "dna";
}

/**
 * The full catalog. Order within a subject is teaching order; the hub renders
 * big "lab" cards first, then "experiment" tiles, then "soon" placeholders.
 *
 * Routes:
 *   • Big subject labs        → /laboratoriya/<subject>
 *   • Biology DNA central-dogma → /laboratoriya/biologiya/dna  (orchestrator builds this route)
 *   • Quick experiments        → /laboratoriya/tajriba/<key>   (existing TajribaViewer)
 */
export const CATALOG: CatalogEntry[] = [
  // ---------------- FIZIKA ----------------
  {
    subject: "fizika",
    kind: "lab",
    id: "fizika",
    title: "Fizika",
    hook: "Ikki shar toʻqnashadi — impuls va energiya jonli.",
    href: "/laboratoriya/fizika",
    accent: "#2dd4bf",
    soft: "rgba(45,212,191,0.14)",
    icon: CircleDot,
    tag: "Mexanika",
    preview: "collision",
  },
  {
    subject: "fizika",
    kind: "experiment",
    id: "density-buoyancy-tank",
    title: "Zichlik va suzish",
    hook: "Suvga tashlab koʻr",
    href: "/laboratoriya/tajriba/density-buoyancy-tank",
    accent: "#3b7bd1",
    soft: "rgba(59,123,209,0.12)",
    icon: Droplets,
  },
  {
    subject: "fizika",
    kind: "experiment",
    id: "prism",
    title: "Prizma",
    hook: "Kamalak hosil qil",
    href: "/laboratoriya/tajriba/prism",
    accent: "#a855f7",
    soft: "rgba(168,85,247,0.12)",
    icon: Triangle,
  },
  {
    subject: "fizika",
    kind: "experiment",
    id: "eclipse",
    title: "Tutilish",
    hook: "Quyosh–Oy–Yer",
    href: "/laboratoriya/tajriba/eclipse",
    accent: "#e8a21a",
    soft: "rgba(232,162,26,0.14)",
    icon: Eclipse,
  },
  {
    subject: "fizika",
    kind: "experiment",
    id: "brownian",
    title: "Broun harakati",
    hook: "Zarralar raqsi",
    href: "/laboratoriya/tajriba/brownian",
    accent: "#2dd4bf",
    soft: "rgba(45,212,191,0.14)",
    icon: Atom,
  },
  {
    subject: "fizika",
    kind: "experiment",
    id: "brachistochrone",
    title: "Eng tez yoʻl",
    hook: "Brakistoxrona",
    href: "/laboratoriya/tajriba/brachistochrone",
    accent: "#e8a21a",
    soft: "rgba(232,162,26,0.14)",
    icon: Spline,
  },

  // ---------------- KIMYO ----------------
  {
    subject: "kimyo",
    kind: "lab",
    id: "kimyo",
    title: "Kimyo",
    hook: "Elementlarni torting, reaksiyani koʻring — H₂O hosil boʻladi.",
    href: "/laboratoriya/kimyo",
    accent: "#a855f7",
    soft: "rgba(168,85,247,0.14)",
    icon: FlaskConical,
    tag: "Reaksiyalar",
    preview: "molecule",
  },

  // ---------------- BIOLOGIYA ----------------
  {
    subject: "biologiya",
    kind: "lab",
    id: "biologiya-dna",
    title: "DNK → Protein",
    hook: "Markaziy dogma — genni oqsilga aylantiring: transkripsiya va translatsiya.",
    href: "/laboratoriya/biologiya/dna",
    accent: "#34d399",
    soft: "rgba(52,211,153,0.14)",
    icon: Microscope,
    tag: "Markaziy dogma",
    preview: "dna",
  },
  {
    subject: "biologiya",
    kind: "soon",
    id: "biologiya-hujayra",
    title: "Hujayra",
    hook: "Tirik hujayra ichida — organoidlar va ularning vazifasi.",
    href: "",
    accent: "#34d399",
    soft: "rgba(52,211,153,0.14)",
    icon: Leaf,
  },
  {
    subject: "biologiya",
    kind: "soon",
    id: "biologiya-fotosintez",
    title: "Fotosintez",
    hook: "Yorugʻlik, suv va CO₂ — barg qanday qand yasaydi.",
    href: "",
    accent: "#34d399",
    soft: "rgba(52,211,153,0.14)",
    icon: Leaf,
  },

  // ---------------- MATEMATIKA ----------------
  {
    subject: "matematika",
    kind: "experiment",
    id: "divisor-grid",
    title: "Boʻluvchilar toʻri",
    hook: "Tub sonlarni top",
    href: "/laboratoriya/tajriba/divisor-grid",
    accent: "#3b7bd1",
    soft: "rgba(59,123,209,0.12)",
    icon: Grid3x3,
  },
  {
    subject: "matematika",
    kind: "soon",
    id: "matematika-funksiya",
    title: "Funksiya grafigi",
    hook: "Parametrlarni surib, egri chiziq qanday oʻzgarishini koʻr.",
    href: "",
    accent: "#3b7bd1",
    soft: "rgba(59,123,209,0.12)",
    icon: Sigma,
  },
];
