# DnaModel — Markaziy dogma (DNA → RNA → Protein)

The first Biologiya experiment for Scorpius. The learner builds a short DNA
template strand, watches **transcription** turn it into mRNA base‑by‑base, then
watches **translation** read the mRNA in codons and grow a polypeptide bead by
bead. This is a *timeline / animation* model (not a force integrator), but it
follows the same Model/View + `Property<T>` + single‑rAF discipline as every
other Scorpius sim: the model owns all state and advances on `step(dt)`; the
view only subscribes via `useProperty` and paints.

---

## 1. The biology (this is the real science, not a cartoon)

### 1.1 Strands & directionality

A DNA molecule is two antiparallel strands. We expose:

- **Template (antisense) strand** — the strand RNA polymerase actually reads,
  3′→5′. This is what the learner edits.
- **Coding (sense) strand** — the complement of the template; it has the *same
  sequence as the mRNA* except T↔U. We display it so the learner sees the
  base‑pairing duplex.

We render the template **5′→3′ left→right** for readability and transcribe along
it left→right. (Real polymerase moves 3′→5′ on the template / synthesises mRNA
5′→3′; we keep a single consistent left→right reading frame so the codon the
ribosome reads matches the coding strand the learner sees. This is a presentation
simplification, flagged here — the *base‑pairing chemistry is exact*.)

### 1.2 Base pairing (exact)

DNA ↔ DNA (Watson–Crick):

| Base | Pairs with |
|------|-----------|
| A    | T         |
| T    | A         |
| G    | C         |
| C    | G         |

Transcription (DNA template base → mRNA base). RNA uses **uracil (U)** instead of
thymine (T):

| DNA template | mRNA |
|--------------|------|
| A            | U    |
| T            | A    |
| G            | C    |
| C            | G    |

Consequence used by the model: the mRNA equals the **coding strand** with every
T replaced by U. We compute mRNA directly from the template via the table above.

### 1.3 The genetic code (NCBI Translation Table 1 — verified)

Translation reads mRNA in non‑overlapping triplets (**codons**) 5′→3′. 64 codons
= 61 sense codons → 20 amino acids + 3 stop codons. The code is *degenerate*
(most amino acids have several codons); only Met (AUG) and Trp (UGG) are unique.

- **Start:** `AUG` = Methionine (Met, M). Translation begins at the first AUG.
- **Stop:** `UAA`, `UAG`, `UGA` — no amino acid; release the polypeptide.

The full 64‑codon table is encoded in `data.ts` (`CODON_TABLE`) and was
cross‑checked against the Wikipedia "DNA and RNA codon tables" standard table and
NCBI Translation Table 1. Spot checks the code asserts on load:
`AUG=Met`, `UUU=Phe`, `GGA=Gly`, `UAA=Stop`, `UGG=Trp`, `AUA=Ile`.

A `data.ts` self‑test (`assertCodonTableValid`) verifies: exactly 64 entries,
exactly 3 stops, all 20 standard amino acids present, and the spot checks above.
It throws in development if the table is ever corrupted.

---

## 2. State (all `Property<T>`)

| Property              | Type                | Meaning |
|-----------------------|---------------------|---------|
| `stage`               | `Stage`             | `"build" \| "transcribe" \| "translate" \| "done"` |
| `template`            | `Base[]`            | learner‑editable DNA template (3–10 codons; A/T/G/C) |
| `playing`             | `boolean`           | rAF timeline running |
| `speed`               | `number`            | timeline multiplier (0.5 / 1 / 2) |
| `transcribed`         | `number`            | mRNA bases built so far (0…N) — fractional during a base |
| `ribosome`            | `number`            | codons translated so far (0…) — fractional while a tRNA docks |
| `tRNAArrival`         | `number`            | 0→1 ease of the currently‑docking tRNA |
| `stoppedAtStop`       | `boolean`           | translation halted on a stop codon |

Derived (pure getters, recomputed from `template` + counters — cheap, no extra
state to keep in sync):

- `coding()` — coding strand (`complementDNA` of template).
- `mrna()` — full mRNA (`transcribeBase` of each template base).
- `codons()` — mRNA split into triplets from the **first AUG** (the reading
  frame), each tagged `start | aa | stop | partial`.
- `peptide()` — amino acids placed so far given `ribosome`.
- `mrnaShown` / `codonIndex` / `currentCodon` — what to highlight right now.

The model knows nothing about React, SVG, or pixels.

---

## 3. Animation timeline (`step(dt)`)

One rAF loop in `DnaLab.tsx` calls `model.step(dt)` with `dt` **capped at
0.033 s** (≈30 fps floor) so a long frame can never skip a base. `dt` is scaled
by `speed` inside the loop. Nothing here is a CSS keyframe — every moving thing
is a function of these counters, which advance only in `step`.

### Stage `transcribe`
`transcribed` advances at `RATE_TRANSCRIBE` bases/second:

```
transcribed += dt * RATE_TRANSCRIBE          // clamp to template.length
```

The view eases the newest base in by the fractional part of `transcribed`. When
`transcribed ≥ N`, stage auto‑advances to `translate` (after a short hold).

### Stage `translate`
The ribosome reads one codon at a time. `tRNAArrival` eases 0→1 as a tRNA docks;
when it reaches 1 the amino acid is committed (`ribosome++`) and `tRNAArrival`
resets:

```
tRNAArrival += dt * RATE_TRANSLATE
if tRNAArrival ≥ 1:
    ribosome += 1
    tRNAArrival = 0
    if currentCodon is STOP → stoppedAtStop = true, playing = false, stage = "done"
    if ribosome ≥ codons.length → stage = "done"
```

Translation **starts at the first AUG** and **stops at the first stop codon** in
that frame, exactly like a real ribosome.

### Reduced motion (`snap()`)
`prefers-reduced-motion` → the view calls `snap()` which fast‑forwards the active
stage to completion (sets `transcribed = N`, runs `ribosome` to the stop/end)
with no in‑between frames. Final state is identical to the animated path.

### Constants

```
RATE_TRANSCRIBE = 6     bases / second   (≈0.17 s per base at 1×)
RATE_TRANSLATE  = 1.6   codons / second  (≈0.6 s per amino acid at 1×)
HOLD_AFTER      = 0.45  s   pause on a completed stage before auto‑advance
```

These are *pedagogical pacing* numbers (real transcription is ~40–80 nt/s, real
translation ~15–20 aa/s — far too fast to watch). They affect only how fast the
animation reads; the sequences, pairing, codons and amino acids are biologically
exact. Declared here per the simula‑rasa rule.

---

## 4. Invariants (what the model guarantees)

1. `mrna()[i]` is always `transcribeBase(template[i])` — mRNA length = template
   length, exact complement, T→U.
2. `coding()[i]` is always the DNA complement of `template[i]` (T not U).
3. Codons are read **in frame from the first AUG**; bases before it are the 5′
   UTR (shown dimmed, never translated).
4. The peptide always begins with **Met** (AUG) and never extends past the first
   in‑frame stop codon.
5. Every counter is clamped to its valid range; `step` is idempotent at the end
   of a stage (no overrun, no NaN).
