// lib/sims/biology/dna/Model.ts
/**
 * DnaModel — the central-dogma timeline lab implementing SimModel.
 *
 * The learner edits a short DNA TEMPLATE strand (STEP 1), then plays the
 * animation: TRANSCRIPTION grows an mRNA strand base-by-base by complementary
 * pairing (STEP 2), and TRANSLATION reads the mRNA in codons, docking a tRNA +
 * committing one amino acid per codon, starting at AUG and stopping at a stop
 * codon (STEP 3). The polypeptide grows bead by bead.
 *
 * Architecture law (AGENTS.md): the model computes, the view paints. ALL state
 * is Property<T>; this file is pure TS, zero React. A single rAF loop in the
 * view calls step(dt) (dt capped at 0.033). This is a TIMELINE model — the
 * "physics" is the deterministic advance of a few counters — but it follows the
 * same Model/View + useProperty + single-rAF discipline. See model.md for the
 * biology, the timeline, and the declared pacing simplifications.
 */
import { Property } from "@/lib/sim/observable/Property";
import type { SimModel } from "@/lib/sim/SimModel";
import {
  type Base,
  type RnaBase,
  complementDNA,
  transcribeBase,
  translateCodon,
  isStopCodon,
  AMINO_ACIDS,
  STOP,
  DEFAULT_TEMPLATE,
  START_CODON,
} from "./data";

/** The guided step flow. */
export type Stage = "build" | "transcribe" | "translate" | "done";

/** A codon in the mRNA reading frame, tagged for the view. */
export interface CodonInfo {
  /** Index within the codon sequence (0-based, from the first AUG). */
  index: number;
  /** The 3 mRNA bases (may be < 3 for a trailing partial codon). */
  bases: RnaBase[];
  /** Joined string, e.g. "AUG". */
  codon: string;
  /** Amino-acid abbr, STOP, or undefined (incomplete trailing codon). */
  aa: string | undefined;
  /** Start of where this codon's bases sit within the full mRNA (base index). */
  mrnaOffset: number;
  kind: "start" | "aa" | "stop" | "partial";
}

/** One placed amino acid in the growing polypeptide. */
export interface PeptideResidue {
  /** Amino-acid abbreviation. */
  aa: string;
  /** Codon that placed it. */
  codon: string;
}

// ---- pacing constants (see model.md §3) ------------------------------------
const RATE_TRANSCRIBE = 6; // mRNA bases / second
const RATE_TRANSLATE = 1.6; // codons / second (tRNA dock → commit)
const HOLD_AFTER = 0.45; // s — pause on a completed stage before auto-advance
const MIN_CODONS = 1; // need at least a start codon to translate
const MAX_BASES = 36; // 12 codons — keeps the strand legible

export class DnaModel implements SimModel {
  // ---- observable state (the view subscribes via useProperty) --------------
  readonly stage = new Property<Stage>("build");
  /** The learner-editable DNA template strand. */
  readonly template = new Property<Base[]>([...DEFAULT_TEMPLATE]);
  readonly playing = new Property<boolean>(false);
  readonly speed = new Property<number>(1);
  /** mRNA bases built so far (fractional during a base). */
  readonly transcribed = new Property<number>(0);
  /** Codons translated so far (integer; tRNAArrival eases the in-flight one). */
  readonly ribosome = new Property<number>(0);
  /** 0→1 ease of the currently-docking tRNA. */
  readonly tRNAArrival = new Property<number>(0);
  /** Translation halted on a stop codon (vs ran out of mRNA). */
  readonly stoppedAtStop = new Property<boolean>(false);
  /** Bumps on every learner edit — gates lesson progression / re-renders. */
  readonly interactionCount = new Property<number>(0);

  /** Internal hold timer between an auto-completed stage and the next. */
  private holdTimer = 0;

  // ============================================================ derived reads
  // (pure functions of template + counters — recomputed on demand, no cached
  //  state to keep in sync. Cheap: strands are ≤ 36 bases.)

  /** Coding (sense) strand = DNA complement of the template (T, not U). */
  coding(): Base[] {
    return this.template.value.map(complementDNA);
  }

  /** Full mRNA = transcribeBase of each template base (A→U, T→A, G→C, C→G). */
  mrna(): RnaBase[] {
    return this.template.value.map(transcribeBase);
  }

  /** Index of the first AUG in the mRNA (the start of the reading frame), or -1. */
  startIndex(): number {
    const m = this.mrna();
    for (let i = 0; i + 3 <= m.length; i++) {
      if (m[i] === "A" && m[i + 1] === "U" && m[i + 2] === "G") return i;
    }
    return -1;
  }

  /**
   * mRNA split into codons from the first AUG. Each codon tagged start/aa/stop/
   * partial. Translation reads only these (5′ bases before AUG are UTR).
   */
  codons(): CodonInfo[] {
    const m = this.mrna();
    const start = this.startIndex();
    if (start < 0) return [];
    const out: CodonInfo[] = [];
    let idx = 0;
    for (let i = start; i < m.length; i += 3) {
      const bases = m.slice(i, i + 3);
      const codon = bases.join("");
      const aa = bases.length === 3 ? translateCodon(codon) : undefined;
      let kind: CodonInfo["kind"];
      if (bases.length < 3) kind = "partial";
      else if (aa === STOP) kind = "stop";
      else if (idx === 0 && codon === START_CODON) kind = "start";
      else kind = "aa";
      out.push({ index: idx, bases, codon, aa, mrnaOffset: i, kind });
      idx++;
      if (kind === "stop") break; // ribosome releases at the first stop
    }
    return out;
  }

  /** The polypeptide placed so far, given the ribosome counter. */
  peptide(): PeptideResidue[] {
    const cs = this.codons();
    const n = Math.min(Math.floor(this.ribosome.value), cs.length);
    const out: PeptideResidue[] = [];
    for (let i = 0; i < n; i++) {
      const c = cs[i];
      if (c.kind === "stop" || c.kind === "partial" || !c.aa || c.aa === STOP) break;
      out.push({ aa: c.aa, codon: c.codon });
    }
    return out;
  }

  /** Whole protein this template would make (for the STEP-1 preview). */
  fullProtein(): PeptideResidue[] {
    const out: PeptideResidue[] = [];
    for (const c of this.codons()) {
      if (c.kind === "stop" || c.kind === "partial") break;
      if (c.aa && c.aa !== STOP) out.push({ aa: c.aa, codon: c.codon });
    }
    return out;
  }

  /** Does this template translate to anything (has a start codon)? */
  hasStart(): boolean {
    return this.startIndex() >= 0;
  }

  /** The codon the ribosome is currently reading (during translate), or null. */
  currentCodon(): CodonInfo | null {
    const cs = this.codons();
    const i = Math.floor(this.ribosome.value);
    return i >= 0 && i < cs.length ? cs[i] : null;
  }

  // ============================================================ strand editing

  /** Replace the base at `i` (cycles A→T→G→C if no value given). */
  setBase(i: number, base?: Base): void {
    if (this.stage.value !== "build") return;
    const t = [...this.template.value];
    if (i < 0 || i >= t.length) return;
    if (base) {
      t[i] = base;
    } else {
      const order: Base[] = ["A", "T", "G", "C"];
      t[i] = order[(order.indexOf(t[i]) + 1) % 4];
    }
    this.template.value = t;
    this.interactionCount.value++;
  }

  /** Append a base to the template (palette tap / drag). */
  addBase(base: Base): void {
    if (this.stage.value !== "build") return;
    if (this.template.value.length >= MAX_BASES) return;
    this.template.value = [...this.template.value, base];
    this.interactionCount.value++;
  }

  /** Remove the last base. */
  removeLast(): void {
    if (this.stage.value !== "build") return;
    if (this.template.value.length === 0) return;
    this.template.value = this.template.value.slice(0, -1);
    this.interactionCount.value++;
  }

  /** Load a ready-made template (seed picker). Returns to the build stage. */
  loadTemplate(bases: Base[]): void {
    this.backToBuild();
    this.template.value = bases.slice(0, MAX_BASES);
    this.interactionCount.value++;
  }

  // ============================================================ stage control

  setSpeed(v: number): void {
    this.speed.value = v > 0 ? v : 1;
  }

  /** Go to the transcription stage and (if playing) start the animation. */
  startTranscription(): void {
    if (this.template.value.length < 3) return;
    this.stage.value = "transcribe";
    this.transcribed.value = 0;
    this.ribosome.value = 0;
    this.tRNAArrival.value = 0;
    this.stoppedAtStop.value = false;
    this.holdTimer = 0;
    this.playing.value = true;
  }

  /** Begin translation (after transcription is complete). */
  startTranslation(): void {
    if (this.codons().length < MIN_CODONS || !this.hasStart()) return;
    this.stage.value = "translate";
    this.transcribed.value = this.mrna().length;
    this.ribosome.value = 0;
    this.tRNAArrival.value = 0;
    this.stoppedAtStop.value = false;
    this.holdTimer = 0;
    this.playing.value = true;
  }

  /** Return to STEP 1 to edit the strand again. */
  backToBuild(): void {
    this.stage.value = "build";
    this.playing.value = false;
    this.transcribed.value = 0;
    this.ribosome.value = 0;
    this.tRNAArrival.value = 0;
    this.stoppedAtStop.value = false;
    this.holdTimer = 0;
  }

  /** Toggle the timeline play state for the current stage. */
  togglePlay(): void {
    if (this.stage.value === "build" || this.stage.value === "done") return;
    this.playing.value = !this.playing.value;
  }

  /** Advance one discrete unit (one base in transcribe, one codon in translate). */
  stepOnce(): void {
    if (this.stage.value === "transcribe") {
      const n = this.mrna().length;
      const next = Math.min(n, Math.floor(this.transcribed.value) + 1);
      this.transcribed.value = next;
      if (next >= n) this.finishTranscription();
    } else if (this.stage.value === "translate") {
      this.tRNAArrival.value = 0;
      this.commitCodon();
    }
  }

  // ============================================================ integration

  step(dt: number): void {
    if (!this.playing.value) return;
    const clamped = Math.min(dt, 0.033) * (this.speed.value > 0 ? this.speed.value : 1);

    if (this.stage.value === "transcribe") {
      this.stepTranscribe(clamped);
    } else if (this.stage.value === "translate") {
      this.stepTranslate(clamped);
    }
  }

  private stepTranscribe(dt: number): void {
    const n = this.mrna().length;
    if (this.transcribed.value < n) {
      this.transcribed.value = Math.min(n, this.transcribed.value + dt * RATE_TRANSCRIBE);
      if (this.transcribed.value >= n) {
        this.transcribed.value = n;
        this.holdTimer = HOLD_AFTER;
      }
    } else {
      // brief hold on a completed strand, then auto-advance to translation
      this.holdTimer -= dt;
      if (this.holdTimer <= 0) this.finishTranscription();
    }
  }

  private finishTranscription(): void {
    this.holdTimer = 0;
    if (this.hasStart() && this.codons().length >= MIN_CODONS) {
      this.startTranslation();
    } else {
      // no AUG → nothing to translate; stop here so the learner sees why
      this.stage.value = "done";
      this.playing.value = false;
    }
  }

  private stepTranslate(dt: number): void {
    const cs = this.codons();
    if (this.ribosome.value >= cs.length) {
      this.playing.value = false;
      this.stage.value = "done";
      return;
    }
    this.tRNAArrival.value += dt * RATE_TRANSLATE;
    if (this.tRNAArrival.value >= 1) {
      this.tRNAArrival.value = 0;
      this.commitCodon();
    }
  }

  /** Commit the codon the ribosome is on; advance, and halt at stop/end. */
  private commitCodon(): void {
    const cs = this.codons();
    const i = Math.floor(this.ribosome.value);
    if (i >= cs.length) {
      this.playing.value = false;
      this.stage.value = "done";
      return;
    }
    const c = cs[i];
    this.ribosome.value = i + 1;
    if (c.kind === "stop" || isStopCodon(c.codon)) {
      this.stoppedAtStop.value = true;
      this.playing.value = false;
      this.stage.value = "done";
      return;
    }
    if (this.ribosome.value >= cs.length) {
      this.playing.value = false;
      this.stage.value = "done";
    }
  }

  // ============================================================ reduced motion

  /**
   * prefers-reduced-motion path: fast-forward the active stage to completion
   * with no in-between frames. Final state is identical to the animated path.
   */
  snap(): void {
    if (this.stage.value === "transcribe") {
      this.transcribed.value = this.mrna().length;
      this.finishTranscription();
      // if it advanced into translate, snap that too
    }
    if (this.stage.value === "translate") {
      const cs = this.codons();
      this.transcribed.value = this.mrna().length;
      // commit codons up to (and including) the first stop, or to the end
      let i = Math.floor(this.ribosome.value);
      while (i < cs.length) {
        const c = cs[i];
        i++;
        this.ribosome.value = i;
        if (c.kind === "stop" || isStopCodon(c.codon)) {
          this.stoppedAtStop.value = true;
          break;
        }
      }
      this.tRNAArrival.value = 0;
      this.playing.value = false;
      this.stage.value = "done";
    }
  }

  // ============================================================ lifecycle

  reset(): void {
    this.backToBuild();
    this.template.value = [...DEFAULT_TEMPLATE];
    this.interactionCount.value = 0;
  }

  dispose(): void {
    this.stage.dispose();
    this.template.dispose();
    this.playing.dispose();
    this.speed.dispose();
    this.transcribed.dispose();
    this.ribosome.dispose();
    this.tRNAArrival.dispose();
    this.stoppedAtStop.dispose();
    this.interactionCount.dispose();
  }
}

/** Convenience: amino-acid metadata lookup re-exported for views. */
export { AMINO_ACIDS };
