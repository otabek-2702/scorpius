// lib/sims/collision/Model.ts
/**
 * CollisionModel — a fully analytic 1-D / 2-D collision laboratory.
 *
 * Implements SimModel (lib/sim/SimModel.ts). All mutable state is held as
 * Property<T> from lib/sim/observable. See model.md alongside this file for the
 * full derivation, units, integration scheme, and assumptions.
 *
 * Physics (SI): balls roll on a flat, frictionless, gravity-free table. Between
 * collisions a = 0, so semi-implicit Euler is exact. Contacts are resolved with
 * the closed-form restitution law (NOT iteratively) — this exactness is the
 * teaching contrast against the matter-js variant. Three invariants are exposed
 * live: total momentum p (constant across every impact), total KE (constant iff
 * e=1), and centre-of-mass velocity v_cm (the CM glides straight through).
 *
 * The View reads `balls`, `e`, `running`, `flashes`, the invariant readouts, and
 * paints — it contains zero physics. Pure TS, zero React.
 */
import { Property } from "@/lib/sim/observable/Property";
import type { SimModel } from "@/lib/sim/SimModel";

// ---- Table geometry (SI) ---------------------------------------------------
/** Table width in metres — the View maps this to its viewport. */
export const TABLE_W = 10;
/** Half-height of the play strip (m) — used by the 2-D scene + View framing. */
export const TABLE_H = 4;
/** Cosmetic radius law: r = R0 · m^(1/3) (constant-density disc look). */
const R0 = 0.34;
export const ballRadius = (m: number) => R0 * Math.cbrt(m);

const SUBSTEPS = 8;
const DT_CAP = 0.033;
/** Per-pair contact cooldown (sub-steps) so a resolved pair can't double-fire. */
const PAIR_COOLDOWN = 2;

export type ScenarioId =
  | "equal-mass-stop"
  | "newtons-cradle"
  | "mass-mismatch"
  | "restitution-dial"
  | "perfectly-inelastic"
  | "2d-glancing";

export interface Ball {
  id: number;
  m: number;
  /** position (m). For 1-D scenes only x changes; y stays on the centre line. */
  x: number;
  y: number;
  /** velocity (m/s). */
  vx: number;
  vy: number;
  /** cosmetic radius (m), derived from mass. */
  r: number;
  /** accent hue for the View (CSS color). */
  color: string;
  /** label drawn on the ball (e.g. "A", "B"). */
  label: string;
}

/** A transient impact flash, consumed + animated by the View. */
export interface Flash {
  id: number;
  x: number;
  y: number;
  /** 0..1 strength from closing speed — scales the radial flash + heat puff. */
  strength: number;
  /** true if energy was lost here (e<1) → View adds red heat particles. */
  inelastic: boolean;
  bornAt: number;
}

/** Live invariant snapshot the View renders as bars + the CM diamond. */
export interface Invariants {
  /** total momentum vector (kg·m/s). */
  px: number;
  py: number;
  /** |p|. */
  p: number;
  /** total kinetic energy (J). */
  ke: number;
  /** centre of mass position (m). */
  cmx: number;
  cmy: number;
  /** centre-of-mass velocity (m/s) — constant; the diamond glides at this. */
  vcmx: number;
  vcmy: number;
  /** total mass (kg). */
  mtot: number;
}

const ACCENT = "#2dd4bf"; // teal — the physics accent
const ACCENT_B = "#fbbf24"; // warm gold for ball B / contrast
const CRADLE = "#e2e8f0"; // pale steel for cradle balls

/** Solve the general 1-D restitution collision (exact, closed form). */
function resolve1D(
  m1: number,
  u1: number,
  m2: number,
  u2: number,
  e: number,
): [number, number] {
  const sum = m1 + m2;
  const v1 = (m1 * u1 + m2 * u2 + m2 * e * (u2 - u1)) / sum;
  const v2 = (m1 * u1 + m2 * u2 + m1 * e * (u1 - u2)) / sum;
  return [v1, v2];
}

export class CollisionModel implements SimModel {
  /** Observable list of live balls — View subscribes via useProperty(). */
  readonly balls = new Property<Ball[]>([]);
  /** Coefficient of restitution, 0..1. */
  readonly e = new Property<number>(1);
  /** Is the clock running (vs paused). */
  readonly running = new Property<boolean>(false);
  /** Active impact flashes (transient) — View animates + prunes by age. */
  readonly flashes = new Property<Flash[]>([]);
  /** Current scenario id. */
  readonly scenario = new Property<ScenarioId>("equal-mass-stop");
  /** Live invariant readout — recomputed every frame the balls move. */
  readonly invariants = new Property<Invariants>({
    px: 0, py: 0, p: 0, ke: 0, cmx: 0, cmy: 0, vcmx: 0, vcmy: 0, mtot: 0,
  });
  /** KE at the moment of arming (full system energy) — for the "lost" wedge. */
  readonly keInitial = new Property<number>(0);
  /** |total momentum| at the moment of arming — denominator for the Σp bar
   * fraction (the pairwise |m1·u1+m2·u2| guess is wrong for the 5-ball cradle). */
  readonly pInitial = new Property<number>(0);
  /** Cumulative KE lost to inelastic impacts (J). */
  readonly keLost = new Property<number>(0);
  /** Counts armings/runs — gates lesson progression if hosted in a card. */
  readonly interactionCount = new Property<number>(0);

  // ---- tunable scenario inputs (the View binds sliders to these) ----
  readonly m1 = new Property<number>(1);
  readonly m2 = new Property<number>(1);
  readonly u1 = new Property<number>(4);
  readonly u2 = new Property<number>(0);
  /** 2-D impact parameter (m): 0 head-on … (r1+r2) clean miss. */
  readonly impactParam = new Property<number>(0.6);
  /** Newton's cradle: how many balls to pull back (1..5). */
  readonly cradlePull = new Property<number>(1);

  private nextId = 1;
  private nextFlashId = 1;
  /** key "i-j" -> sub-steps remaining before this pair may collide again. */
  private pairCooldown = new Map<string, number>();
  private is2D = false;

  constructor() {
    this.setScenario("equal-mass-stop");
  }

  // ---------------------------------------------------------------- scenarios
  setScenario(id: ScenarioId): void {
    this.scenario.value = id;
    this.is2D = id === "2d-glancing";
    this.pairCooldown.clear();
    this.flashes.value = [];
    this.keLost.value = 0;
    this.running.value = false;

    switch (id) {
      case "equal-mass-stop":
        this.m1.value = 1; this.m2.value = 1;
        this.u1.value = 4; this.u2.value = 0; this.e.value = 1;
        break;
      case "mass-mismatch":
        // keep current m1/m2 (slider-driven); target at rest, elastic
        this.u1.value = 4; this.u2.value = 0; this.e.value = 1;
        break;
      case "restitution-dial":
        this.m1.value = 1; this.m2.value = 1;
        this.u1.value = 4; this.u2.value = 0;
        // e stays where the dial left it (default 1)
        break;
      case "perfectly-inelastic":
        this.m1.value = 1.5; this.m2.value = 1;
        this.u1.value = 4; this.u2.value = 0; this.e.value = 0;
        break;
      case "2d-glancing":
        this.m1.value = 1; this.m2.value = 1;
        this.u1.value = 4; this.u2.value = 0; this.e.value = 1;
        break;
      case "newtons-cradle":
        this.e.value = 1;
        break;
    }
    this.armFromInputs();
  }

  /** Rebuild the balls + reset positions/velocities from the current inputs. */
  armFromInputs(): void {
    const id = this.scenario.value;
    this.nextId = 1;
    this.pairCooldown.clear();
    this.flashes.value = [];
    this.keLost.value = 0;
    this.running.value = false;

    if (id === "newtons-cradle") {
      this.balls.value = this.buildCradle();
    } else if (id === "2d-glancing") {
      this.balls.value = this.build2D();
    } else {
      this.balls.value = this.build1D();
    }
    this.recomputeInvariants();
    this.keInitial.value = this.invariants.value.ke;
    this.pInitial.value = this.invariants.value.p;
  }

  private build1D(): Ball[] {
    const m1 = this.m1.value, m2 = this.m2.value;
    const r1 = ballRadius(m1), r2 = ballRadius(m2);
    // Place A on the left, B at centre-right, both on the centre line.
    const ax = TABLE_W * 0.22;
    const bx = TABLE_W * 0.62;
    return [
      { id: this.nextId++, m: m1, x: ax, y: 0, vx: this.u1.value, vy: 0, r: r1, color: ACCENT, label: "A" },
      { id: this.nextId++, m: m2, x: bx, y: 0, vx: this.u2.value, vy: 0, r: r2, color: ACCENT_B, label: "B" },
    ];
  }

  private build2D(): Ball[] {
    const m1 = this.m1.value, m2 = this.m2.value;
    const r1 = ballRadius(m1), r2 = ballRadius(m2);
    // A flies in along +x from the left, offset vertically by the impact
    // parameter b so it strikes B off-centre → a glancing blow.
    const b = Math.min(this.impactParam.value, r1 + r2);
    const bx = TABLE_W * 0.60;
    return [
      { id: this.nextId++, m: m1, x: TABLE_W * 0.16, y: -b, vx: this.u1.value, vy: 0, r: r1, color: ACCENT, label: "A" },
      { id: this.nextId++, m: m2, x: bx, y: 0, vx: 0, vy: 0, r: r2, color: ACCENT_B, label: "B" },
    ];
  }

  private buildCradle(): Ball[] {
    // 5 equal balls just touching on the centre line. Pull back `cradlePull`
    // balls from the LEFT and give them the impact speed; with all-equal masses
    // and e=1 the impulse passes down the line and exactly N eject on the right.
    const n = 5;
    const m = 1;
    const r = ballRadius(m);
    const gap = r * 2; // touching (centre-to-centre = 2r)
    const startX = TABLE_W * 0.30;
    const pull = Math.max(1, Math.min(n, Math.round(this.cradlePull.value)));
    const u = this.u1.value;
    const out: Ball[] = [];
    for (let i = 0; i < n; i++) {
      const moving = i < pull;
      out.push({
        id: this.nextId++,
        m,
        // Pulled-back balls start a little to the left with the launch speed.
        x: startX + i * gap - (moving ? r * 1.6 * (pull - i) : 0),
        y: 0,
        vx: moving ? u : 0,
        vy: 0,
        r,
        color: moving ? ACCENT : CRADLE,
        label: "",
      });
    }
    return out;
  }

  // ----------------------------------------------------------------- controls
  run(): void {
    if (this.balls.value.length === 0) this.armFromInputs();
    this.running.value = true;
    this.interactionCount.value = this.interactionCount.value + 1;
  }
  pause(): void { this.running.value = false; }
  togglePlay(): void {
    if (this.running.value) this.pause();
    else this.run();
  }

  /** Single-step a small slice of time (for the "Qadam" button). */
  stepOnce(): void {
    // Force one integration slice regardless of the paused flag, then stay
    // paused so the learner can inspect the frame.
    this.running.value = true;
    this.step(1 / 60);
    this.running.value = false;
  }

  reset(): void {
    this.armFromInputs();
  }

  // --------------------------------------------------------------- integration
  step(dt: number): void {
    this.pruneFlashes();
    if (!this.running.value) return;
    const balls = this.balls.value;
    if (balls.length === 0) return;

    const clamped = Math.min(dt, DT_CAP);
    const h = clamped / SUBSTEPS;

    for (let s = 0; s < SUBSTEPS; s++) {
      // decay cooldowns
      for (const [k, v] of this.pairCooldown) {
        if (v <= 1) this.pairCooldown.delete(k);
        else this.pairCooldown.set(k, v - 1);
      }
      // integrate (a = 0 on a frictionless flat table → v constant)
      for (const b of balls) {
        b.x += b.vx * h;
        b.y += b.vy * h;
      }
      // resolve pairwise contacts (process left-to-right for clean chains)
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          this.maybeCollide(balls[i], balls[j], i, j);
        }
      }
      // walls (only the 2-D scene + free roam use the vertical bounds; 1-D
      // scenes are framed so the action completes before any wall is reached,
      // but we still reflect to keep balls on-canvas if left running).
      this.applyWalls(balls);
    }

    // publish mutated array + fresh invariants
    this.balls.value = [...balls];
    this.recomputeInvariants();
  }

  private maybeCollide(a: Ball, b: Ball, i: number, j: number): void {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 1e-9;
    const rSum = a.r + b.r;
    if (dist > rSum) return;

    // unit normal (a → b)
    const nx = dx / dist;
    const ny = dy / dist;
    // relative velocity along the normal (closing if negative)
    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const relN = rvx * nx + rvy * ny;
    if (relN >= 0) return; // separating — ignore (prevents sticking)

    const key = `${i}-${j}`;
    if (this.pairCooldown.has(key)) {
      // still separate the overlap so they don't sink into each other
      this.separate(a, b, nx, ny, rSum - dist);
      return;
    }

    const e = this.e.value;
    // tangent
    const tx = -ny;
    const ty = nx;
    // project velocities onto (n, t)
    const a_n = a.vx * nx + a.vy * ny;
    const a_t = a.vx * tx + a.vy * ty;
    const b_n = b.vx * nx + b.vy * ny;
    const b_t = b.vx * tx + b.vy * ty;

    // KE before (this pair only) for the lost-energy accounting
    const keBefore = 0.5 * a.m * (a.vx * a.vx + a.vy * a.vy)
      + 0.5 * b.m * (b.vx * b.vx + b.vy * b.vy);

    // collide the NORMAL scalars with the exact 1-D restitution law;
    // tangential components are unchanged (frictionless contact)
    const [na_n, nb_n] = resolve1D(a.m, a_n, b.m, b_n, e);

    // recompose
    a.vx = na_n * nx + a_t * tx;
    a.vy = na_n * ny + a_t * ty;
    b.vx = nb_n * nx + b_t * tx;
    b.vy = nb_n * ny + b_t * ty;

    // perfectly inelastic on the normal axis → snap to a shared normal velocity
    // so they truly move together (numerical guard for e=0).
    if (e === 0) {
      const shared = (a.m * na_n + b.m * nb_n) / (a.m + b.m);
      a.vx = shared * nx + a_t * tx;
      a.vy = shared * ny + a_t * ty;
      b.vx = shared * nx + b_t * tx;
      b.vy = shared * ny + b_t * ty;
    }

    const keAfter = 0.5 * a.m * (a.vx * a.vx + a.vy * a.vy)
      + 0.5 * b.m * (b.vx * b.vx + b.vy * b.vy);
    const lost = Math.max(0, keBefore - keAfter);
    if (lost > 1e-9) this.keLost.value = this.keLost.value + lost;

    // positional correction: push the pair apart so they cannot re-trigger
    this.separate(a, b, nx, ny, rSum - dist);
    this.pairCooldown.set(key, PAIR_COOLDOWN);

    // emit a flash at the contact point
    const closing = Math.abs(relN);
    const mx = a.x + nx * a.r;
    const my = a.y + ny * a.r;
    this.emitFlash(mx, my, Math.min(1, closing / 6), e < 1);
  }

  /** Push two overlapping balls apart along ±n by half the penetration each. */
  private separate(a: Ball, b: Ball, nx: number, ny: number, pen: number): void {
    if (pen <= 0) return;
    const push = pen / 2 + 1e-4;
    a.x -= nx * push; a.y -= ny * push;
    b.x += nx * push; b.y += ny * push;
  }

  private applyWalls(balls: Ball[]): void {
    for (const b of balls) {
      // horizontal ends
      if (b.x - b.r < 0) { b.x = b.r; if (b.vx < 0) b.vx = -b.vx; }
      else if (b.x + b.r > TABLE_W) { b.x = TABLE_W - b.r; if (b.vx > 0) b.vx = -b.vx; }
      // vertical bounds only matter for the 2-D scene
      if (this.is2D) {
        if (b.y - b.r < -TABLE_H) { b.y = -TABLE_H + b.r; if (b.vy < 0) b.vy = -b.vy; }
        else if (b.y + b.r > TABLE_H) { b.y = TABLE_H - b.r; if (b.vy > 0) b.vy = -b.vy; }
      }
    }
  }

  // ----------------------------------------------------------------- readouts
  private recomputeInvariants(): void {
    let px = 0, py = 0, ke = 0, mtot = 0, mx = 0, my = 0;
    for (const b of this.balls.value) {
      px += b.m * b.vx;
      py += b.m * b.vy;
      ke += 0.5 * b.m * (b.vx * b.vx + b.vy * b.vy);
      mtot += b.m;
      mx += b.m * b.x;
      my += b.m * b.y;
    }
    const cmx = mtot > 0 ? mx / mtot : 0;
    const cmy = mtot > 0 ? my / mtot : 0;
    this.invariants.value = {
      px, py,
      p: Math.hypot(px, py),
      ke,
      cmx, cmy,
      vcmx: mtot > 0 ? px / mtot : 0,
      vcmy: mtot > 0 ? py / mtot : 0,
      mtot,
    };
  }

  /** Predicted post-collision velocities for the headline 1-D pair (View hint). */
  predict1D(): { v1: number; v2: number; dKE: number } {
    const m1 = this.m1.value, m2 = this.m2.value;
    const u1 = this.u1.value, u2 = this.u2.value, e = this.e.value;
    const [v1, v2] = resolve1D(m1, u1, m2, u2, e);
    const mu = (m1 * m2) / (m1 + m2);
    const dKE = 0.5 * mu * (u1 - u2) * (u1 - u2) * (1 - e * e);
    return { v1, v2, dKE };
  }

  private emitFlash(x: number, y: number, strength: number, inelastic: boolean): void {
    this.flashes.value = [
      ...this.flashes.value,
      { id: this.nextFlashId++, x, y, strength: Math.max(0.2, strength), inelastic, bornAt: performance.now() },
    ];
  }

  private pruneFlashes(): void {
    const list = this.flashes.value;
    if (list.length === 0) return;
    const now = performance.now();
    const alive = list.filter((f) => now - f.bornAt < 700);
    if (alive.length !== list.length) this.flashes.value = alive;
  }

  dispose(): void {
    this.balls.dispose();
    this.e.dispose();
    this.running.dispose();
    this.flashes.dispose();
    this.scenario.dispose();
    this.invariants.dispose();
    this.keInitial.dispose();
    this.pInitial.dispose();
    this.keLost.dispose();
    this.interactionCount.dispose();
    this.m1.dispose();
    this.m2.dispose();
    this.u1.dispose();
    this.u2.dispose();
    this.impactParam.dispose();
    this.cradlePull.dispose();
  }
}

// Re-export the few constants the View needs to map metres → px + label scenes.
export const PHYS = { TABLE_W, TABLE_H, ballRadius, ACCENT, ACCENT_B };
