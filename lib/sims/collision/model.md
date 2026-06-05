# Collision Lab · model.md — Toʻqnashuvlar laboratoriyasi

> Mandatory physics documentation (PhET simula-rasa discipline). The Model.ts
> next to this file matches this document exactly. The View paints; the Model
> computes. All physics here is **analytic and exact** — that is the teaching
> contrast against the matter-js (iterative solver) variant.

## Concept

Two (or more) balls roll on a flat, **frictionless, gravity-free table** and
collide. The learner changes mass, incoming speed, and **elasticity** (the
coefficient of restitution `e`) and watches three invariants drawn live:

- **total momentum** `p = Σ mᵢ vᵢ` — a teal bar; **constant every frame**, even
  across the impact (this is the punchline — if it ever changes length, the
  physics is wrong);
- **total kinetic energy** `KE = Σ ½ mᵢ vᵢ²` — conserved iff `e = 1`, otherwise
  it drops by a known amount at impact (a red "lost-energy" wedge);
- **centre of mass** — a hollow diamond gliding at constant velocity
  `v_cm = p / Σmᵢ` straight through the collision, unaffected by it.

The hero scene: two **equal** balls, A moving into a stationary B with `e = 1`.
A **stops dead**, B leaves at A's exact incoming speed. The momentum bar and the
KE bar are both unchanged — the velocities simply *swap*.

## State & units

Everything is SI (kg, m, m/s, s). The View maps metres → pixels.

| Symbol | Meaning | Unit |
|--------|---------|------|
| `m`  | ball mass | kg |
| `x`  | centre position along the table (1-D) or 2-D vector | m |
| `v`  | velocity (signed in 1-D; vector in 2-D) | m/s |
| `r`  | ball radius (`r = r0 · m^(1/3)`, constant-density disc look) | m |
| `e`  | coefficient of restitution, `0 … 1` | — |
| `p = Σ m v` | total momentum | kg·m/s |
| `KE = Σ ½ m v²` | total kinetic energy | J |

Table is `TABLE_W = 10 m` wide. Balls live on the centre line (`y = 0`) for the
1-D scenes; the 2-D glancing scene uses the full plane. Radius is derived from
mass so a heavier ball *looks* bigger: `r = 0.18 · m^(1/3)` m (clamped). Mass
only affects dynamics through the equations below — the radius is cosmetic and
chosen so equal masses are equal discs.

## The one collision law (powers the whole hand-built model)

**1-D, general restitution `e ∈ [0,1]`** — for masses `m₁, m₂` with
pre-velocities `u₁, u₂` along the line of impact:

```
v₁ = ( m₁·u₁ + m₂·u₂ + m₂·e·(u₂ − u₁) ) / (m₁ + m₂)
v₂ = ( m₁·u₁ + m₂·u₂ + m₁·e·(u₁ − u₂) ) / (m₁ + m₂)
```

Properties (all used as live "story" highlights in the View):

- **`e = 1` (elastic):** KE conserved. Equal mass + target at rest ⇒ `v₁ = 0`,
  `v₂ = u₁` — the hero "stop". Heavy→light gives the light ball up to **2×**
  the incoming speed; light→heavy **bounces the incoming ball back**.
- **`e = 0` (perfectly inelastic):** the balls stick and move together at the
  common velocity `v = (m₁u₁ + m₂u₂)/(m₁+m₂)` = `p / Σm` = `v_cm`.
- **KE lost** when `e < 1` (exact, derived from the formulas above):

```
ΔKE = ½ · (m₁·m₂ / (m₁+m₂)) · (u₁ − u₂)² · (1 − e²)
```

`μ = m₁m₂/(m₁+m₂)` is the reduced mass; `(u₁−u₂)` is the closing speed. This is
the size of the red wedge the learner watches grow as they dial `e` down.

### 2-D circle–circle (the glancing-blow scene)

For two circles in contact, unit normal `n = (c₂ − c₁)/|c₂ − c₁|`, tangent
`t = (−nᵧ, nₓ)`:

1. Project each velocity onto `(n, t)`: `vₙ = v·n`, `v_t = v·t`.
2. **Tangential components are unchanged** (frictionless contact).
3. Collide the **normal scalars** `(v₁ₙ, v₂ₙ)` with the 1-D law above (same `e`).
4. Recompose `v = vₙ·n + v_t·t`.
5. Before resolving, **separate** the overlapping pair: push each centre out
   along `±n` by half the penetration, so they never stick together.

For **equal masses, elastic, one ball initially at rest**, the two balls exit at
**~90°** to each other — a classic result the scene demonstrates with an
impact-parameter (aim) slider.

## Contact detection & integration

**Semi-implicit (symplectic) Euler**, with sub-stepping to prevent tunnelling.
Acceleration is **zero** (flat, frictionless table), so per sub-step:

```
v += a · h        // a = 0  → v unchanged between collisions
x += v · h
```

Each `step(dt)`:

1. Clamp `dt` to `0.033 s`.
2. Split into `SUBSTEPS = 8` equal sub-steps `h = dt/8`. Fast balls cannot
   tunnel through each other because the per-sub-step displacement is small
   relative to the diameters at our speed ranges; we additionally guard with an
   approaching-overlap test rather than an exact-touch test.
3. In each sub-step: integrate positions, then for every pair test
   **contact = `dist ≤ r₁ + r₂` AND approaching** (relative velocity along the
   normal is negative). If so, apply the analytic resolution **once** for that
   contact, then positionally separate the overlap so the pair cannot re-trigger
   on the next sub-step (which would double-resolve and *lose* momentum — the
   classic bug). A short per-pair cooldown also guards re-triggering.
4. Walls: balls reflect off the table ends (`v → −v`) only in free-roam scenes;
   the analytic scenes are framed so the action completes on-screen and walls are
   optional. Wall bounces are perfectly elastic and conserve `|p|` per ball but
   **flip its sign** — so in scenes with walls the *vector* total momentum is not
   invariant (a wall is an external force). The invariant readout is therefore
   only asserted for the **collision** event, and the hero/compare scenes keep
   the relevant ball clear of walls until after impact.

### Why analytic, not iterative

The 1-D/2-D formulas above are the **exact** closed-form solution of
simultaneous conservation of momentum + Newton's restitution equation
`(v₂ − v₁) = −e(u₂ − u₁)`. There is no iteration, no penetration drift, no
energy injection. matter-js (Variant B) solves contacts iteratively
(position + velocity bias, Baumgarte-style), so its momentum/energy **drift
slightly** frame-to-frame — visible in the same live readout. That contrast is a
feature of the lab, not a bug.

## Scenarios (Model.setScenario)

| id | setup | teaches |
|----|-------|---------|
| `equal-mass-stop` | `m₁=m₂=1`, `u₁=+4`, `u₂=0`, `e=1` | **hero** — A stops, B leaves at `u₁` |
| `newtons-cradle` | 5 equal balls touching; pull back N | exactly N swing out (chained equal-mass elastic) |
| `mass-mismatch` | slider morphs `m₁/m₂`, `u₂=0`, `e=1` | heavy→light 2×; light→heavy bounce-back |
| `restitution-dial` | sweep `e: 1→0` | red lost-energy wedge grows; at `e=0` they fuse |
| `perfectly-inelastic` | two blocks, `e=0` | couple & move as one; KE bar shorter |
| `2d-glancing` | aim slider (impact parameter) | equal masses exit ~90° apart |

For Newton's cradle the analytic model resolves the chain by processing pairwise
contacts left-to-right within a sub-step; with all-equal masses and `e=1` the
impulse passes cleanly down the line, so pulling back N balls ejects exactly N —
the emergent, not hand-coded, result.

## Invariants displayed live (proof it is real)

- `p(t) = Σ mᵢ vᵢ` — **must be constant across every collision.** Drawn as a bar
  whose length never changes through impact in any `e`.
- `KE(t) = Σ ½ mᵢ vᵢ²` — constant iff `e = 1`; otherwise steps down by exactly
  `ΔKE` (above) at the impact frame; the lost amount is shown as a red wedge.
- `v_cm = p / Σm` — the centre-of-mass diamond glides at this constant velocity
  straight through the collision (Newton's first law for the system: no external
  force ⇒ the CM does not accelerate).

## Ranges

| Param | Min | Max | Default |
|-------|-----|-----|---------|
| `m₁`, `m₂` | 0.5 kg | 8 kg | 1 kg |
| `u₁` | −6 m/s | +6 m/s | +4 m/s |
| `u₂` | −6 m/s | +6 m/s | 0 m/s |
| `e` | 0 | 1 | 1 |
| impact parameter `b` (2-D) | 0 (head-on) | `r₁+r₂` (miss) | 0.6·(r₁+r₂) |

## Simplifications (declared)

- **No gravity, no friction, no rolling resistance, no air drag** on the table —
  these scenes isolate the collision law. (Variant B / matter-js uses a tiny
  `frictionAir` only to keep its solver from drifting, noted in code.)
- **No rotation / spin.** Balls are treated as point masses with a cosmetic
  radius; tangential friction (which would impart spin) is ignored, consistent
  with the frictionless-contact assumption used in the 2-D normal/tangent split.
- Radius `r = r0 · m^(1/3)` is a **look** (constant-density disc), not a separate
  physical input; only `m` enters the dynamics.
- Wall reflections are perfectly elastic; invariants are asserted only around the
  ball–ball collision event (see "Walls" above).

## Integration constants

`SUBSTEPS = 8`, `dt` clamped to `0.033 s`, per-pair contact cooldown `≈ 2`
sub-steps. Reduced-motion users get the analytic post-collision state applied
immediately (the balls jump to their resolved velocities and a short settle),
since the *result* — swapped velocities, conserved bars — is the lesson, not the
in-flight animation.
