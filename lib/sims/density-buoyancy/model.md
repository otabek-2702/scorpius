# Density / Buoyancy Lab · model.md

> Mandatory physics documentation per the PhET simula-rasa discipline. Every
> sim ships a model.md alongside its Model.ts file. Skipping this = plan failure.
> This is a fully time-integrated buoyancy lab: falling solid blocks of
> learner-chosen size, an immiscible floating oil layer, splash + damped
> bobbing, a rising water level reported in cm, and true-scale labelled force
> vectors.

## Concept

A learner picks a material **and a block size** and a real solid block FALLS
from above the tank, splashes through the surface, and settles to true
Archimedes equilibrium — floating with the correct submerged fraction (with
realistic damped bobbing) or sinking to the floor. Because the learner can
change size, they discover that a *big light* block still floats and a *tiny
dense* block still sinks: **density, not size or weight, decides.** Oil is
immiscible and lighter than water, so it does not drop as a cube — it
accumulates as a **floating liquid layer** on the surface. The rule discovered:

> **ρ_block < ρ_water → floats · ρ_block > ρ_water → sinks**
> and the *amount* submerged when floating is exactly ρ_block / ρ_water.

## State & units

The model works in **SI for the physics** (metres, seconds, kg, N) and exposes
fixed real-world scales so the View can map metres → SVG pixels.

| Symbol | Meaning | Unit |
|--------|---------|------|
| `y` | block centre height, measured upward from tank floor | m |
| `vy` | block vertical velocity (up positive) | m/s |
| `s` (`side`) | block edge length (cube) — **per block** | m |
| `ρ` (`density`) | block density | kg/m³ (stored as g/cm³ in config, ×1000 internally) |
| `ρ_w` | water density = 1000 | kg/m³ |
| `ρ_oil` | oil density = 920 | kg/m³ |
| `g` | gravity = 9.81 | m/s² |
| `m = ρ · s³` | block mass | kg |
| `V = s³` | block volume | m³ |

Block size is a learner-chosen preset: **small 6 cm**, **medium 10 cm**, **large
15 cm**. Tank is `0.50 m` wide × `0.40 m` tall; water rest level `0.24 m`.

## Forces (per block, vertical 1-D)

At every step we compute the submerged depth of the cube given its centre
height `y`, its edge `s`, and the current water surface height `h_water`:

```
bottom         = y - s/2
submergedDepth = clamp(h_water - bottom, 0, s)        // metres of the cube under water
submergedFrac  = submergedDepth / s                    // 0 … 1
V_sub          = submergedFrac · V
```

Forces (up = +):

```
F_gravity   = -m · g                                   // weight, always down
F_buoyancy  = +ρ_w · g · V_sub                         // Archimedes — only the submerged volume
F_drag      = -ζ · c_crit · vy · submergedFrac         // see "Drag model" below
            where c_crit = 2·√(k·m),  k = ρ_w·g·s²,  ζ ≈ 0.5
```

Net acceleration: `a = (F_gravity + F_buoyancy + F_drag) / m`.

### Drag model — honest disclosure

The drag term is a **deliberate simplification**, not physical quadratic drag.
Real fluid drag is roughly `F = ½ ρ_w C_d A v²` (quadratic in speed,
independent of the body's mass). We instead use a **linear damper tuned as a
fixed fraction of critical damping** for the floating spring-mass system:

```
k      = ρ_w · g · s²          // buoyant restoring stiffness of a floating cube
c_crit = 2 · √(k · m)          // critical damping for this block
F_drag = -ζ · c_crit · vy · submergedFrac,   ζ ≈ 0.5
```

Why ζ ≈ 0.5 (slightly underdamped): the block bobs a couple of visible times,
then settles in ~1.5 s — the pedagogically useful behaviour. Why scale by
critical damping rather than a flat constant: it makes **every** block (light or
heavy, small or large) settle in a similar few-bob envelope, instead of light
blocks ringing for 30 cycles. The damper only sets the *transient* (how long the
bob lasts); it does **not** change the equilibrium waterline, which is fixed by
Archimedes. The physics the lesson teaches (float/sink + submerged fraction) is
therefore exact. Active only while submerged (scaled by submergedFrac).

A true quadratic drag (`-c·|vy|·vy·frac`) is a future upgrade; it would change
only the bobbing damping envelope, not the conclusion.

### Equilibrium (closed-form, used for verification)

A floater settles where buoyancy = weight:
`ρ_w · g · (frac · V) = ρ · g · V` → **frac = ρ / ρ_w**, independent of `V`
(hence independent of size). So wood (500/1000) floats 50 % submerged; ice
(920/1000) 92 %. Changing the block size changes `m`, `V`, and the force
*magnitudes* in proportion, but **not** the submerged fraction — this is the
exact statement the size control lets the learner verify. The View's "suvda %"
readout is computed from live geometry and must converge to ρ/ρ_w.

### Sinkers rest on the floor

When a block with ρ > ρ_w reaches the floor (`bottom ≤ 0`) it is clamped:
`y = s/2`, and downward velocity is zeroed (bounce-free stop). It then sits with
the floor normal force silently balancing gravity − buoyancy.

## True-scale force vectors (View)

Both arrows are drawn with **one shared px-per-Newton scale**
(`PX_PER_N`), chosen so a 10 cm wood block's weight (≈ 4.9 N) reads ~46 px.
Because the scale is shared, a floating block's weight and buoyancy arrows are
visibly **equal length** — matching the numeric readout. Gold's weight is huge,
so arrow length is clamped to a max with a `↧` marker and the **true N value is
always printed** next to the arrow. This kills the old fake `34·density` scaling.

## Splash + ripple

When a block's leading face first crosses the surface with downward speed
`|vy| > 0.2 m/s`, the model emits a `Splash` event (position + a strength from
impact speed × size). The View animates expanding ripple rings + parabolic
droplet particles against an animation clock and prunes each splash after
0.9 s. This is cosmetic feedback layered on the real impact detection — it does
not feed back into the dynamics.

## Water level (cumulative displacement) + the displacement readout

Water is conserved: as blocks submerge they push the surface up. Displaced
volume = Σ of every block's submerged volume, spread over the tank's horizontal
cross-section. We model the tank as a unit-depth 2-D slice of depth `s_ref =
0.10 m`, so `A_tank = width · s_ref`:

```
h_water = h_rest + (Σ V_sub_i) / A_tank
```

Solved by fixed-point iteration each step (6 iterations converge tightly).
`levelRise() = h_water − h_rest` is surfaced to the learner in **cm** with the
line "Suv sathi X sm koʻtarildi = botgan hajm" — making Archimedes' insight
(displaced-volume = level rise) visible and numeric.

## Oil — immiscible floating layer (not a cube)

Materials may carry `phase: "liquid"`. Dropping a liquid does **not** spawn a
falling cube; instead a fixed parcel of volume joins `oilHeight`, a floating
layer that the View paints on top of the water surface with a warm translucent
gradient. Physically correct because ρ_oil = 920 < ρ_w = 1000, so oil floats
and, being immiscible, forms a distinct layer rather than mixing. This replaces
the old (wrong) "oil as a solid cube identical to ice" model.

## Integration scheme

**Semi-implicit (symplectic) Euler**, fixed `1/120 s` sub-steps, `dt` clamped to
`1/60 s`, driven by the model clock (a `requestAnimationFrame` loop calling
`step(dt)`):

```
vy += a · dt
y  += vy · dt
```

Symplectic Euler is chosen over explicit Euler because the buoyancy+drag system
is a damped oscillator and symplectic Euler stays stable for it without RK4's
cost — appropriate for many blocks at 60 fps on mobile. Reduced-motion users
get the same model fast-forwarded to equilibrium (no visible animation).

## Inputs

| Property | Type | Notes |
|----------|------|-------|
| `materials` | `MaterialBlock[]` (config) | palette; default 7 real materials |
| `blocks` | `Property<Block[]>` (model) | live solid blocks (id, mat, side, x, y, vy, settled) |
| `waterHeight` | `NumberProperty` (model) | current surface height (m) |
| `oilHeight` | `NumberProperty` (model) | floating oil-layer thickness (m) |
| `splashes` | `Property<Splash[]>` (model) | transient surface splashes |
| `sizePreset` | `Property<BlockSizePreset>` (model) | small / medium / large — next spawn |
| `interactionCount` | `NumberProperty` (model) | distinct spawns; gates lesson progression |

## Real densities (g/cm³ → ×1000 = kg/m³)

| Material | ρ (g/cm³) | Phase | Float / Sink | Settled submerged % |
|----------|-----------|-------|--------------|---------------------|
| Yogʻoch (pine wood) | 0.50 | solid | Float | 50 % |
| Muz (ice) | 0.92 | solid | Float | 92 % |
| Moy (oil) | 0.92 | **liquid** | Floats as a layer | — (surface layer) |
| Kauchuk (rubber) | 1.20 | solid | Sink | floor |
| Alyuminiy (aluminium) | 2.70 | solid | Sink | floor |
| Temir (iron) | 7.87 | solid | Sink | floor |
| Oltin (gold) | 19.30 | solid | Sink | floor |

Densities cross-checked against engineeringtoolbox.com / amesweb material tables
(iron 7.87, aluminium 2.70, gold 19.3; pine ≈ 0.38–0.50; ice 0.917; oil ≈ 0.92).

## Simplifications (declared)

- **1-D vertical dynamics only** — blocks do not tip, rotate, or move
  horizontally. Rotational stability is **explicitly out of scope**: each block
  is treated as a point-mass cube in vertical translation. A real floating cube
  has a metacentric-height stability question (which face floats up); we do not
  model it because the lesson's question is "float or sink, and how deep", not
  rigid-body attitude. This is why we do **not** claim "full rigid-body physics".
- Linear, mass-scaled drag (see "Drag model") rather than quadratic — affects
  only the bobbing transient, never the equilibrium.
- Water + oil treated as a 2-D unit-depth slice for the level-rise computation;
  water incompressible.
- Oil modelled as a pure floating layer (no internal oil dynamics).

## Manifesto arc

Consumed by `predict` → `explore-sandbox` → `pattern-discover` →
`compare-and-decide` cards in the grade-6 density lesson. Interactive-first:
pick a size + material, the block falls, splashes, and settles in real time; the
learner reads the true-scale labelled force vectors, watches the level rise, and
discovers the ρ rule themselves.
