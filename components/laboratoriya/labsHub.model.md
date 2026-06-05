# Laboratoriya hub — live mini-preview models

The multi-subject hub paints a small, genuinely-live mini-stage inside each big
"lab" card. Per the project architecture law (`AGENTS.md`) motion is driven by
**one** `requestAnimationFrame` loop (`useStageClock`) that produces a monotonic
time `t` (seconds); the previews are pure functions of `(t, reduced)` evaluated
on every frame — never CSS keyframes faking physics. `prefers-reduced-motion`
freezes the clock and the previews snap to a settled frame.

These previews are decorative thumbnails of the full sims (which own their own
`SimModel` + `model.md`). They are documented here for the same simula-rasa
discipline.

---

## 1. Physics preview — 1-D elastic collision (teal)

Two equal masses on a frictionless line. Left ball enters at `u1`, right ball at
rest. The 1-D elastic-collision solution:

    v1 = ((m1 − m2)/(m1 + m2))·u1
    v2 = (2·m1/(m1 + m2))·u1

With `m1 = m2` this gives `v1 = 0`, `v2 = u1` — the classic full momentum
transfer ("Newton's cradle" beat). Total momentum `p = m1·u1` is constant and
drawn as a teal arrow. Positions are closed-form per phase (approach, then
post-impact) and looped over a fixed period, so the preview is deterministic and
cheap yet physically exact. Reduced-motion snaps to the post-collision frame.

(Unchanged from the original single-subject hub.)

## 2. Chemistry preview — H + H + O → H₂O assembly (violet)

Three atoms ease from a scattered start into the **real** bent water geometry:
O at the centre, two H at the H–O–H bond angle of **104.5°** (bonds drawn at
±52.25° from vertical), O–H bond length scaled to the stage. Easing is
decorative (`easeOutCubic`); the geometry is real chemistry. Once bonded the
molecule breathes (a tiny ±3.5 % symmetric bond-length wiggle). Reduced-motion
snaps to the bonded molecule.

(Unchanged from the original single-subject hub.)

## 3. Biology preview — DNA double helix (emerald) — NEW

A B-form DNA double helix rendered as two antiparallel sugar–phosphate backbones
twisting around a shared vertical axis, joined by base-pair rungs.

### Geometry (parametric, real B-DNA proportions)

Sample `N` points evenly along the vertical axis `y ∈ [0, H]`. At each point the
helical phase is

    θ(y, t) = k·y + ω·t

where `k = 2π / pitch` is the spatial twist rate (one full turn per `pitch` of
axis) and `ω` is the angular speed of the on-screen rotation. The two strands are
offset by a constant phase Δ so their backbones sit on opposite sides of the
axis but the minor/major-groove asymmetry of B-DNA reads correctly:

    Strand A:  xA = cx + R·cos(θ)
    Strand B:  xB = cx + R·cos(θ + Δ),   Δ = 0.62π  (≈ B-DNA groove offset)

The horizontal radius `R` is constant; **depth** is encoded by `sin(θ)` mapped to
(a) a perspective x-squash and (b) a front/back z-order + opacity so the strand
nearer the viewer is drawn brighter and on top. There is no fake 3-D engine — it
is the honest projection of a cylinder helix onto the 2-D stage.

A base-pair rung is drawn at every sampled `y`, connecting `(xA, y)` to
`(xB, y)`. Each rung carries one of the four complementary base colours
(A–T, T–A, G–C, C–G) chosen deterministically from the sample index, so the
sequence is stable frame to frame (no flicker). Rungs whose midpoint is on the
**back** half of the cylinder (`cos(θ) < 0` region) are dimmed and drawn first,
giving a correct over/under weave with the front strand.

### Motion

`ω` is constant, so the whole helix rotates rigidly about its axis at a steady
angular rate — a uniform rotation, the simplest honest motion for a rigid helix.
There is no integration to do (rigid body, constant ω): the closed-form pose at
time `t` is exact, evaluated fresh each `rAF` frame. A gentle vertical "breathing"
translation (`±2 px`, period ≈ 6 s) is layered purely as cinematic polish and is
disabled under reduced-motion.

### Reduced motion

The shared clock is frozen (`t = 0`), so `θ = k·y` and the helix renders as a
crisp static double helix at its initial phase. No animation, fully legible.

### Constants

| symbol | meaning | value |
|--------|---------|-------|
| H | axis height (viewBox units) | 132 |
| R | helix radius | 30 px |
| pitch | axis length per full turn | ~52 units (≈2.5 turns shown) |
| Δ | inter-strand phase offset | 0.62π |
| ω | rotation angular speed | 0.9 rad/s |
| N | sampled rungs | 22 |

The numbers are tuned for legibility at thumbnail size; the *relationships*
(two antiparallel backbones, complementary rungs, one accent, honest depth
projection) are faithful to B-DNA.
