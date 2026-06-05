# Quyosh tizimi (Solar System) — model.md

A real-time, interactive 3D model of the Solar System rendered with
react-three-fiber. The learner orbits/zooms the whole system, clicks a planet
to read accurate facts, and scrubs an orbital-speed control to watch the inner
planets lap the outer ones — the Keplerian ordering of orbital periods made
physical and visible.

This is the **simula rasa** spec: variables, equations, units, integration, and
every deliberate simplification, written BEFORE the code so the code matches it.

---

## 1. What the learner experiences (discovery arc)

1. **Curiosity / hook** — a glowing Sun, eight shaded worlds gliding on thin
   orbit rings against a real starfield. Nothing to read yet; the motion asks
   the question: *why does the inner planet keep lapping the outer one?*
2. **Explore** — drag to orbit the camera, scroll/pinch to zoom, pan. The system
   is a physical object you can walk around.
3. **Predict / notice** — a speed control (Sekin / Oddiy / Tez) lets the learner
   slow the dance and *see* Merkuriy whip around while Neptun barely creeps.
4. **Discover the pattern** — the readout panel pairs each planet's real orbital
   period with its distance: farther = slower. That IS Kepler's third law,
   surfaced without yet naming a formula.
5. **Formalize** — clicking a planet reveals its real diameter, distance,
   day-length, year-length, and moon count (2026 data).

---

## 2. Coordinate frame & units (the model's internal "scene units")

- Right-handed three.js frame. The **ecliptic plane is the XZ plane**; +Y is the
  orbital north pole. Planets orbit in XZ; the camera looks slightly down from
  +Y so orbits read as ellipses-seen-near-edge-on, like real sky charts.
- **Scene units are dimensionless display units**, NOT km or AU. True scale is
  impossible to render (Neptune is 4.5 billion km out; the Sun is 109 Earths
  wide) so we use an explicit, labelled **stylized scale ("koʻrgazmali
  masshtab")**. See §5.

---

## 3. State variables

Per planet `i` (i = 0..7, Mercury..Neptune):

| symbol        | meaning                                  | unit              |
|---------------|------------------------------------------|-------------------|
| `aᵢ`          | orbit radius (scene units)               | scene units       |
| `rᵢ`          | render radius of the sphere              | scene units       |
| `θᵢ(t)`       | orbital angle (mean anomaly)             | radians           |
| `φᵢ(t)`       | spin angle about the planet's own axis   | radians           |
| `Tᵢ`          | sidereal orbital period (real)           | Earth days        |
| `Dᵢ`          | sidereal rotation period (real)          | Earth hours       |
| `tiltᵢ`       | axial tilt                               | radians           |

Global:

| symbol  | meaning                                       | unit            |
|---------|-----------------------------------------------|-----------------|
| `t`     | simulation time accumulator                   | "model seconds" |
| `S`     | user speed multiplier (0.35 / 1 / 3)          | dimensionless   |
| `dt`    | frame timestep from the rAF clock             | real seconds    |

Position of planet i (in the XZ ecliptic plane), Sun at the origin:

```
xᵢ = aᵢ · cos(θᵢ)
zᵢ = aᵢ · sin(θᵢ)
yᵢ = 0
```

(Orbits are modelled as **circles**, not ellipses — see §6, simplification S3.)

---

## 4. Equations of motion (real RELATIVE rates) + integration

The pedagogical core is that **orbital angular speed is set by the planet's REAL
period**, so the inner planets visibly orbit faster (Kepler ordering preserved).

Angular speed of the orbit (mean motion), in model-radians per model-second:

```
ωᵢ = 2π / (Tᵢ / T_ref) · BASE_ORBIT_RATE
```

where `T_ref` = Earth's period (365.2 d) is the normalizer, so Earth makes one
lap per `1 / BASE_ORBIT_RATE` model-seconds and every other planet's lap time is
in **exact real proportion** to Earth's. Equivalently we precompute

```
ωᵢ = BASE_ORBIT_RATE · 2π · (T_ref / Tᵢ)        // rad per model-second
```

so ω_Mercury / ω_Earth = 365.2 / 88.0 ≈ 4.15, ω_Neptune / ω_Earth ≈ 1/164.8.
Mercury laps ~4× per Earth year; Neptune barely moves. This is the lesson.

Spin (rotation about the planet's own tilted axis):

```
ω_spinᵢ = SPIN_RATE · (D_ref / Dᵢ) · sign(Dᵢ)
```

`D_ref` = Earth's 23.9 h. `sign` is negative for **retrograde rotators**
(Venus, Uranus) so they visibly spin backwards — a real, surprising fact.
Spin is decorative-but-correct-in-direction; its absolute rate is exaggerated
(SPIN_RATE) so spin is visible at all, and this is flagged (S4).

**Integration — semi-implicit (symplectic) Euler**, advanced every frame inside
r3f's `useFrame` (which IS the requestAnimationFrame loop the architecture
mandates):

```
t      ← t + S · dt
θᵢ     ← θᵢ + ωᵢ      · (S · dt)        // accumulate, then wrap to [0, 2π)
φᵢ     ← φᵢ + ω_spinᵢ · (S · dt)
xᵢ,zᵢ  ← aᵢ cos θᵢ , aᵢ sin θᵢ
```

For pure rotation at constant ω this is exact up to floating wrap; there is no
acceleration term (circular orbit ⇒ |ω| constant), so no energy drift. `dt` is
clamped to ≤ 1/30 s to stay stable if a frame is dropped or the tab was hidden.

**prefers-reduced-motion** → the loop is not advanced: `S` is held at 0 after one
layout so the system renders a single, still, correct frame (planets at their
seeded phase offsets, orbit rings drawn). Still beautiful, zero motion.

---

## 5. The stylized scale (stated honestly to the learner)

True ratios span 5 orders of magnitude, so two independent **monotonic,
compressive maps** are used and the UI labels them "koʻrgazmali masshtab"
(illustrative scale), explicitly telling the learner distances/sizes are
compressed and NOT to scale.

- **Orbit radius** `aᵢ`: a gentle power-compression of the real mean distance
  `d_kmᵢ` so order is preserved and rings don't collide:
  `aᵢ = A0 + K · (d_AUᵢ)^0.62`, hand-tuned constants A0, K. Monotonic in real
  distance ⇒ the true *ordering* (Mercury innermost … Neptune outermost) and the
  "farther planets are much farther" intuition survive; only the absolute gaps
  are squeezed.
- **Render radius** `rᵢ`: a compressive map of real diameter
  `rᵢ = clamp( R_MIN , R0 · (diameter_km)^0.4 , R_MAX )` so Jupiter clearly reads
  as the giant and Mercury as the runt, the *ordering of sizes is exactly real*,
  but Jupiter isn't 28× Mercury on screen (it would dwarf everything). The Sun
  is drawn larger than any planet but **far smaller than its true 109× Earth**
  ratio, again flagged as stylized.

These maps only ever **reorder-preservingly compress**; no planet is bigger than
a truly-larger one, none is closer than a truly-closer one. The physics that
teaches (period ordering) is exact; only the canvas geometry is compressed.

---

## 6. Assumptions & deliberate simplifications (write them down)

- **S1 — Coplanar orbits.** All eight orbits lie in one plane (real inclinations
  are < 3.4° except Mercury's 7°; invisible at this scale and they'd just add
  clutter). 
- **S2 — Phases are arbitrary.** Initial `θᵢ(0)` are spread by a fixed seed for a
  pleasing starting tableau; they are NOT today's real ephemeris positions. The
  lesson is about *rates*, not where Mars is tonight.
- **S3 — Circular orbits.** Eccentricities (e ≤ 0.21 for Mercury, < 0.06 for the
  rest) are dropped; orbits are perfect circles. Kepler's 1st/2nd laws are out of
  scope here; the 3rd-law *period↔distance ordering* is what we teach and it is
  preserved because ωᵢ comes from the **real** Tᵢ.
- **S4 — Spin rate exaggerated.** Absolute rotation speed is scaled up (SPIN_RATE)
  so spin is perceptible alongside the much slower orbital motion; only the
  *direction* (prograde vs retrograde) and the *relative* day-lengths are
  faithful, not the spin-to-orbit ratio.
- **S5 — Sizes & distances compressed** per §5; labelled in-UI as stylized.
- **S6 — Lighting is a single point light at the Sun** plus a low ambient term so
  the night sides aren't pure black (real space is darker, but unreadable). The
  Sun itself uses an emissive (self-lit) material + an additive glow sprite to
  fake bloom WITHOUT the postprocessing package (not installed).
- **S7 — Saturn is the only planet drawn with a ring.** (Jupiter/Uranus/Neptune
  have faint rings in reality; omitted as visually negligible.)

The numeric **facts** shown to the learner (diameter km, distance million km,
day length, year length, moon count) are the **REAL NASA values**, independent of
the compressed render geometry. Source: NASA NSSDCA Planetary Fact Sheet; 2026
moon counts from IAU MPC announcements (Saturn 292, Jupiter 101, Uranus 29,
Neptune 18).

---

## 7. Rendering / view (no physics in the view layer)

- `Scene.tsx` owns the `<Canvas>`, lights, `<Stars>`, the Sun, the eight
  `<Planet>` instances, orbit rings (`<Line>`), and `<OrbitControls>`.
- Each `<Planet>` advances its own `θ, φ` inside `useFrame` from the shared model
  constants — useFrame is the integration loop; there are NO CSS keyframes.
- Selection (clicked planet) and speed/ring/label toggles are React state lifted
  to `KoinotLab.tsx`, passed down as props; the readout panel is plain DOM in the
  light app chrome. The 3D layer never reaches into the panel and vice-versa,
  beyond these props/callbacks.

---

## 8. Verification checklist (what "correct" means here)

- Inner planets visibly complete more laps than outer ones in the same wall-clock
  window; ratio of laps ≈ ratio of real periods (Mercury ≈ 4 laps : Earth 1 lap
  : Mars ≈ 0.53 lap). Spot-checkable by eye at "Sekin".
- Venus and Uranus spin retrograde (opposite sense to the others).
- Clicking any planet shows its correct NASA facts; Saturn shows 292 moons.
- prefers-reduced-motion freezes everything to a still, correct frame.
- 60fps on a mid laptop; OrbitControls rotate/zoom/pan smooth; no console errors.
