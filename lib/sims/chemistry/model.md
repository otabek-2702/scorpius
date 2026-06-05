# Kimyo laboratoriyasi — Model

`ChemistryModel` (`Model.ts`) implements `SimModel` (`step`, `reset`, `dispose`).
The **model computes** the reaction assembly; the **views paint** (Variant A =
hand-built SVG/canvas, Variant B = 3Dmol.js). All state lives in `Property<T>`.

This is a *molecular assembly* simulation, not a force integrator. There is no
classical equation of motion between atoms (real bond formation is quantum). The
"physics" we model honestly is:

1. **Conservation of mass / atom balance.** Every reaction in `data.ts` is a
   real balanced equation; the number of each element on the left equals the
   right. The view shows this as a live left = right ledger — the core PhET
   "Reactants, Products and Leftovers" teaching point.
2. **Real molecular geometry.** Product atom positions are real VSEPR geometries
   in ångström (H₂O bent 104.5°, CO₂ linear 180°, NH₃ pyramidal 107.3°, SO₂ bent
   119°). Bond lengths are literature values (O–H 0.96 Å, C=O 1.16 Å, …). The
   *shape you see is the true shape of the molecule.*
3. **Real thermochemistry.** ΔH of each reaction (kJ for the written equation,
   298 K, from standard enthalpies of formation) drives the energy-flash
   magnitude and exo/endo color. All eight reactions here are exothermic; the
   flash intensity is scaled by |ΔH| (NaCl/MgO blinding, NH₃ a warm glow, rust a
   slow no-flash warm spread).

## State machine

```
idle ──(gather atoms == a known reaction)──► armed
armed ──(react())──────────────────────────► assembling   (progress 0→1)
assembling ──(progress reaches 1)──────────► product
product ──(reset()/clear)───────────────────► idle
```

- `phase: Property<Phase>` — `"idle" | "armed" | "assembling" | "product"`.
- `progress: Property<number>` — 0..1 assembly fraction (eased into geometry).
- `flash: Property<number>` — 0..1 energy-bloom intensity, rises then decays.
- `tray: Property<TrayAtom[]>` — atoms the user gathered (each a draggable id).
- `matched: Property<Reaction | null>` — the reaction the tray currently equals.

## Atom motion (the assembly animation)

Each scene atom has a **scattered start** `(sx,sy,sz)` and an **assembled target**
`(tx,ty,tz)` = its slot in the product geometry (Å, from `data.ts`). During
`assembling` we drive a single scalar `u = progress ∈ [0,1]` forward in `step`:

```
du/dt = speed / T_assemble        (T_assemble ≈ 1.15 s)
u ← clamp(u + du·dt, 0, 1)
```

`speed ∈ {0.5 (Sekin), 1 (Oddiy), 2 (Tez)}` is a **purely temporal** multiplier on
the assembly clock (`assemblySpeed: Property<number>`). It changes only how fast
`u` advances — the eased path, the final geometry, the bond grow window, the flash
trigger point (`u ≥ 0.62`) and ΔH are all untouched. It is a presentation control,
not a chemistry one: the conservation-of-mass ledger and the true VSEPR product are
identical at every speed. The flash decay `τ` is in real seconds (independent of
`speed`) so a fast assembly still gets a crisp, correctly-timed bloom.

Position is an **eased interpolation** along a gently curved path (not a fake
tween of the *visual* — the model owns `u`, the view reads it):

```
e   = easeInOutCubic(u)                         // smooth start/stop
pos = lerp(start, target, e) + curl(i)·bump(e)  // bump = sin(π·e), a slight arc
```

`curl(i)` is a small per-atom perpendicular offset so atoms swirl in rather than
slide on rails — purely cosmetic, deterministic (seeded by atom index), and
zero at u=0 and u=1 so the final geometry is exact. `easeInOutCubic` and the
bump are closed-form, so the motion is frame-rate independent: the same `u`
always yields the same pose. This is the documented simplification — we ease a
scalar instead of integrating an N-body potential, because the *truth we teach*
is the final geometry + the balance + the energy, not an (unknowable) reaction
trajectory.

**Bonds** fade/grow in over the last 35 % of assembly (`bondProgress =
clamp((u-0.55)/0.45, 0, 1)`) so atoms arrive first, then snap together.

**Energy flash.** Fired once when `u` crosses ~0.62 (atoms make contact):
`flash` jumps to the reaction's `flash` value, then decays
`flash ← flash·exp(-dt/τ)` with `τ ≈ 0.5 s` (slow/rust uses a longer, lower
warm spread). Exo → warm bloom + rising energy bar; endo would be a cool chill
(all current reactions are exo, the machinery supports endo via `exo` flag).

**Ionic reactions** (`kind === "ionic"`): an extra `electronJump: Property<number>`
0..1 animates a valence electron leaping metal → non-metal during the first
40 % of assembly; then the cation radius shrinks and the anion grows as the
cubic lattice packs in (the view scales the rendered radii by ±charge).

## Integration scheme & stability

- One `requestAnimationFrame` loop in the view calls `model.step(dt)`.
- `dt` is clamped to `0.033 s` (cap at ~30 fps worst case) and the integrator is
  a plain forward step on the *bounded* scalar `u` (always clamped to [0,1]), so
  it cannot blow up. No sub-stepping needed — the state is a clamped scalar, not
  a stiff spring.
- **Reduced motion:** `prefersReducedMotion` → the view calls `model.snap()`
  which sets `progress = 1`, fires the flash at low intensity, and jumps to
  `product`. No animation runs.

## Units

| Quantity        | Unit      | Notes                                  |
|-----------------|-----------|----------------------------------------|
| atom positions  | ångström  | real geometry from `data.ts`           |
| ΔH              | kJ        | per balanced equation, 298 K           |
| progress `u`    | unitless  | 0..1 assembly fraction                 |
| flash           | unitless  | 0..1 bloom intensity                   |
| T_assemble      | s         | ≈ 1.15 (slow/rust longer)              |

## ΔHf sources (standard enthalpies of formation, kJ/mol, 298 K)

ΔH_rxn = Σ ΔHf(products) − Σ ΔHf(reactants):

| species | ΔHf | | species | ΔHf |
|---|---|---|---|---|
| H₂O(g) | −241.8 | | CO₂(g) | −393.5 |
| NH₃(g) | −45.9 | | SO₂(g) | −296.8 |
| HCl(g) | −92.3 | | NaCl(s) | −411.2 |
| MgO(s) | −601.6 | | Fe₂O₃(s) | −824.2 |

(Elements in their standard state = 0.) These reproduce the ΔH values hardcoded
in `data.ts` to within rounding; the magnitudes — not 3 sig figs — drive the
visuals.

## Assumptions / simplifications (declared)

- No real reaction kinetics or trajectory — we ease a clamped scalar into the
  true final geometry (see "Atom motion").
- Ionic "lattice" is a small 2×2×2 cubic suggestion, not a full crystal; it
  conveys "extended solid, not a molecule" vs. the covalent ball-and-stick.
- Phase labels (g/s) are omitted from the on-stage equation for legibility; the
  ΔH values above carry the phase that defines them.
- Reaction matching requires the gathered atom multiset to **exactly** equal a
  known reaction's reactant atoms (leftovers do not react) — this is the
  conservation lesson, intentionally strict.
