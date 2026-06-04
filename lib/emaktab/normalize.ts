/**
 * Canonical names for the subjects and mark types emaktab returns.
 *
 * Why this exists: emaktab is the source of truth for what subjects a student
 * takes, but it emits the names with inconsistent casing ("ona tili",
 * "Adabiyot", "tarbiya"), localisation variants ("Rus til (n)" instead of
 * "Rus tili"), and the occasional typo. A single canonical pass keeps every
 * surface — sky, parent dashboard, lesson intros — referring to a subject the
 * same way and lets us key the curriculum graph by a stable id.
 *
 * Pure functions only. No I/O, no Firebase, no Playwright.
 */

/** A stable, kebab-case identifier safe for URLs, Firestore keys, and React keys. */
export type SubjectId = string;

/** Override rules for the awkward names emaktab returns. Keys are the raw
 *  string after a trim + lowercase; values are the canonical (display, id). */
const SUBJECT_OVERRIDES: Record<string, { label: string; id: SubjectId }> = {
  "rus til (n)": { label: "Rus tili", id: "rus-tili" },
  "rus tili (n)": { label: "Rus tili", id: "rus-tili" },
  "rus til(n)": { label: "Rus tili", id: "rus-tili" },
  "ona tili": { label: "Ona tili", id: "ona-tili" },
  "ingliz tili": { label: "Ingliz tili", id: "ingliz-tili" },
  "tasviriy san'at": { label: "Tasviriy san'at", id: "tasviriy-sanat" },
  "tasviriy sanat": { label: "Tasviriy san'at", id: "tasviriy-sanat" },
  "jismoniy tarbiya": { label: "Jismoniy tarbiya", id: "jismoniy-tarbiya" },
  "kelajak soati": { label: "Kelajak soati", id: "kelajak-soati" },
  "tabiiy fan": { label: "Tabiiy fan", id: "tabiiy-fan" },
  matematika: { label: "Matematika", id: "math" },
  tarix: { label: "Tarix", id: "history" },
  informatika: { label: "Informatika", id: "informatika" },
  adabiyot: { label: "Adabiyot", id: "adabiyot" },
  geografiya: { label: "Geografiya", id: "geografiya" },
  texnologiya: { label: "Texnologiya", id: "texnologiya" },
  musiqa: { label: "Musiqa", id: "musiqa" },
  tarbiya: { label: "Tarbiya", id: "tarbiya" },
};

/** Title-case helper for the fallback path: capitalises every space-separated
 *  word, preserving apostrophes ("san'at" → "San'at"). */
function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Turn an arbitrary string into a stable kebab-case id (no diacritics, no
 *  apostrophes, hyphenated). */
function slugify(s: string): SubjectId {
  return s
    .toLowerCase()
    .replace(/['`’ʻ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Normalise a single subject name from emaktab into its canonical form. */
export function normalizeSubjectName(
  raw: string | null | undefined
): { label: string; id: SubjectId } {
  const trimmed = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!trimmed) return { label: "", id: "" };
  const key = trimmed.toLowerCase();
  if (SUBJECT_OVERRIDES[key]) return SUBJECT_OVERRIDES[key];
  return { label: titleCase(trimmed), id: slugify(trimmed) };
}

// ---- Mark-type canonicalisation --------------------------------------------

/** The mark types emaktab issues. `other` catches anything new we haven't seen. */
export type MarkKind = "classwork" | "homework" | "test" | "other";

/** Map an emaktab mark-type label to a coarse kind (used by the analytics layer). */
export function markKind(rawType: string | null | undefined): MarkKind {
  const t = (rawType ?? "").trim().toLowerCase();
  if (!t) return "other";
  if (t.includes("uy vazifa")) return "homework";
  if (t.includes("darsda")) return "classwork";
  if (t.includes("nazorat")) return "test";
  return "other";
}

// ---- Inline self-test (runs with `npx tsx lib/emaktab/normalize.ts`) -------

if (process.argv[1] && process.argv[1].endsWith("normalize.ts")) {
  let pass = 0;
  let fail = 0;
  const check = <T,>(label: string, got: T, want: T) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (ok) pass++;
    else fail++;
    console.log(`${ok ? "PASS" : "FAIL"} ${label}` + (ok ? "" : `\n   got:  ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`));
  };

  check("ona tili", normalizeSubjectName("ona tili"), { label: "Ona tili", id: "ona-tili" });
  check("tarbiya", normalizeSubjectName("tarbiya"), { label: "Tarbiya", id: "tarbiya" });
  check("texnologiya", normalizeSubjectName("texnologiya"), { label: "Texnologiya", id: "texnologiya" });
  check("Rus til (n)", normalizeSubjectName("Rus til (n)"), { label: "Rus tili", id: "rus-tili" });
  check("Matematika", normalizeSubjectName("Matematika"), { label: "Matematika", id: "math" });
  check("Tarix", normalizeSubjectName("Tarix"), { label: "Tarix", id: "history" });
  check("Tasviriy san'at", normalizeSubjectName("Tasviriy san'at"), { label: "Tasviriy san'at", id: "tasviriy-sanat" });
  check("Kelajak soati", normalizeSubjectName("Kelajak soati"), { label: "Kelajak soati", id: "kelajak-soati" });
  check("empty", normalizeSubjectName(""), { label: "", id: "" });
  check("null", normalizeSubjectName(null), { label: "", id: "" });
  check("unknown subject fallback", normalizeSubjectName("Astronomiya"), { label: "Astronomiya", id: "astronomiya" });
  check("Uy vazifasi → homework", markKind("Uy vazifasi"), "homework");
  check("Darsda javob → classwork", markKind("Darsda javob"), "classwork");
  check("Nazorat ishi → test", markKind("Nazorat ishi"), "test");
  check("null mark → other", markKind(null), "other");

  console.log(`\n${pass} passed · ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
