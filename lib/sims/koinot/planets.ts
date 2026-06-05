// lib/sims/koinot/planets.ts
/**
 * Quyosh tizimi — verified planetary data + the stylized "koʻrgazmali masshtab"
 * maps that turn real km / days into compressed scene units.
 *
 * FACTS are REAL. Source: NASA NSSDCA Planetary Fact Sheet (metric) for
 * diameter, mean distance, sidereal orbital period, sidereal rotation period and
 * axial tilt; 2026 moon counts from IAU Minor Planet Center announcements
 * (Saturn 292, Jupiter 101, Uranus 29, Neptune 18; Earth 1, Mars 2, Mercury 0,
 * Venus 0). RENDER geometry is compressed on a monotonic, order-preserving
 * scale (see koinot.model.md §5) and is explicitly NOT to scale.
 *
 * Pure data + pure math — no three.js, no React. Safe to import anywhere.
 */

export interface PlanetFacts {
  /** stable id / registry key */
  id: string;
  /** Uzbek (Latin) display name */
  nameUz: string;
  /** one-line Uzbek hook shown in the info card */
  blurbUz: string;
  /** equatorial diameter, km (NASA) */
  diameterKm: number;
  /** mean distance from the Sun, million km (NASA) */
  distanceMkm: number;
  /** sidereal orbital period, Earth days (NASA) */
  orbitDays: number;
  /** sidereal rotation period magnitude, Earth hours (NASA, |value|) */
  rotationHours: number;
  /** true if the planet rotates retrograde (Venus, Uranus) */
  retrograde: boolean;
  /** axial tilt, degrees (NASA obliquity to orbit) */
  axialTiltDeg: number;
  /** confirmed moons (2026) */
  moons: number;
  /** base sphere colour (sunlit albedo-ish) */
  color: string;
  /** subtle emissive tint so the night side isn't pure black */
  nightTint: string;
  /** Saturn-style ring? */
  hasRing: boolean;
}

/** Earth normalizers used by the rate maps (must match the entries below). */
export const EARTH_ORBIT_DAYS = 365.2;
export const EARTH_ROTATION_HOURS = 23.9;

/**
 * The eight planets, Mercury → Neptune. Distances in million km are converted to
 * AU internally for the orbit-radius map. Moon counts are the 2026 confirmed
 * totals.
 */
export const PLANETS: readonly PlanetFacts[] = [
  {
    id: "merkuriy",
    nameUz: "Merkuriy",
    blurbUz: "Quyoshga eng yaqin va eng kichik sayyora — bir yili 88 kun.",
    diameterKm: 4879,
    distanceMkm: 57.9,
    orbitDays: 88.0,
    rotationHours: 1407.6,
    retrograde: false,
    axialTiltDeg: 0.03,
    moons: 0,
    color: "#9a8f86",
    nightTint: "#2a2622",
    hasRing: false,
  },
  {
    id: "venera",
    nameUz: "Venera",
    blurbUz: "Eng issiq sayyora; teskari aylanadi — Quyosh g‘arbdan chiqadi.",
    diameterKm: 12104,
    distanceMkm: 108.2,
    orbitDays: 224.7,
    rotationHours: 5832.5,
    retrograde: true,
    axialTiltDeg: 177.4,
    moons: 0,
    color: "#d8b878",
    nightTint: "#3a2f1c",
    hasRing: false,
  },
  {
    id: "yer",
    nameUz: "Yer",
    blurbUz: "Bizning uyimiz — yagona suvli, hayot bor sayyora.",
    diameterKm: 12756,
    distanceMkm: 149.6,
    orbitDays: 365.2,
    rotationHours: 23.9,
    retrograde: false,
    axialTiltDeg: 23.4,
    moons: 1,
    color: "#3f7bd4",
    nightTint: "#0e2440",
    hasRing: false,
  },
  {
    id: "mars",
    nameUz: "Mars",
    blurbUz: "Qizil sayyora — zang (temir oksidi) tufayli qizg‘ish.",
    diameterKm: 6792,
    distanceMkm: 228.0,
    orbitDays: 687.0,
    rotationHours: 24.6,
    retrograde: false,
    axialTiltDeg: 25.2,
    moons: 2,
    color: "#c1502e",
    nightTint: "#3a160d",
    hasRing: false,
  },
  {
    id: "yupiter",
    nameUz: "Yupiter",
    blurbUz: "Eng katta sayyora — barcha sayyoralardan og‘irroq, gaz gigant.",
    diameterKm: 142984,
    distanceMkm: 778.5,
    orbitDays: 4331,
    rotationHours: 9.9,
    retrograde: false,
    axialTiltDeg: 3.1,
    moons: 101,
    color: "#c9a87a",
    nightTint: "#3a2e1f",
    hasRing: false,
  },
  {
    id: "saturn",
    nameUz: "Saturn",
    blurbUz: "Halqalari bilan mashhur; eng ko‘p yo‘ldoshli sayyora.",
    diameterKm: 120536,
    distanceMkm: 1432.0,
    orbitDays: 10747,
    rotationHours: 10.7,
    retrograde: false,
    axialTiltDeg: 26.7,
    moons: 292,
    color: "#d9c89a",
    nightTint: "#3a3320",
    hasRing: true,
  },
  {
    id: "uran",
    nameUz: "Uran",
    blurbUz: "Yonboshlab aylanadi; muz gigant, ko‘kish-yashil rangda.",
    diameterKm: 51118,
    distanceMkm: 2867.0,
    orbitDays: 30589,
    rotationHours: 17.2,
    retrograde: true,
    axialTiltDeg: 97.8,
    moons: 29,
    color: "#9fd6dc",
    nightTint: "#16363a",
    hasRing: false,
  },
  {
    id: "neptun",
    nameUz: "Neptun",
    blurbUz: "Eng uzoq sayyora; bir yili 165 Yer yiliga teng.",
    diameterKm: 49528,
    distanceMkm: 4515.0,
    orbitDays: 59800,
    rotationHours: 16.1,
    retrograde: false,
    axialTiltDeg: 28.3,
    moons: 18,
    color: "#3b62d4",
    nightTint: "#0c1840",
    hasRing: false,
  },
] as const;

/* ============================================================
 * Stylized scale maps (koinot.model.md §5). Monotonic & order-
 * preserving: a closer planet is never rendered farther, a bigger
 * planet is never rendered smaller. Only absolute gaps are squeezed.
 * ========================================================== */

const AU_PER_MKM = 1 / 149.6; // 1 AU = 149.6 million km

/** Orbit radius in scene units: a = A0 + K · (d_AU)^P. Compressive, monotonic. */
export function orbitRadius(distanceMkm: number): number {
  const A0 = 6;
  const K = 7.0;
  const P = 0.62;
  const au = distanceMkm * AU_PER_MKM;
  return A0 + K * Math.pow(au, P);
}

/** Sphere render radius in scene units: clamp(R_MIN, R0·d^0.4, R_MAX). */
export function renderRadius(diameterKm: number): number {
  const R0 = 0.013;
  const P = 0.4;
  const R_MIN = 0.34; // floor keeps the small rocky worlds clickable
  const R_MAX = 2.6;
  const r = R0 * Math.pow(diameterKm, P);
  return Math.min(R_MAX, Math.max(R_MIN, r));
}

/* ============================================================
 * Rate maps — REAL relative orbital/rotation rates, in radians per
 * "model second". BASE_ORBIT_RATE sets Earth's lap time; every other
 * planet is in exact real proportion (Kepler ordering preserved).
 * ========================================================== */

/** Earth completes one orbit every (2π / (BASE·2π)) = 1/BASE model-seconds. */
const BASE_ORBIT_RATE = 0.06; // Earth ≈ 16.7 s/lap at speed 1 → calm, watchable
const SPIN_RATE = 0.45; // exaggerated absolute spin so rotation is visible (S4)

/** Orbital angular speed (rad / model-second). Inner planets are faster. */
export function orbitOmega(orbitDays: number): number {
  return BASE_ORBIT_RATE * 2 * Math.PI * (EARTH_ORBIT_DAYS / orbitDays);
}

/** Spin angular speed (rad / model-second); negative for retrograde rotators. */
export function spinOmega(rotationHours: number, retrograde: boolean): number {
  const mag = SPIN_RATE * (EARTH_ROTATION_HOURS / rotationHours);
  return retrograde ? -mag : mag;
}

/** Pleasing, fixed starting phase per planet (NOT real ephemeris — model.md S2). */
export function seedPhase(index: number): number {
  // golden-angle spread keeps the opening tableau uncrowded
  return (index * 2.399963229728653) % (2 * Math.PI);
}

/** Human-readable Uzbek year length for the readout (days vs Earth-years). */
export function yearLabelUz(orbitDays: number): string {
  if (orbitDays < 365) return `${Math.round(orbitDays)} kun`;
  const yrs = orbitDays / EARTH_ORBIT_DAYS;
  return `${yrs.toFixed(1)} Yer yili`;
}

/** Human-readable Uzbek day length (rotation) for the readout. */
export function dayLabelUz(rotationHours: number, retrograde: boolean): string {
  const dir = retrograde ? " (teskari)" : "";
  if (rotationHours < 48) return `${rotationHours.toFixed(1)} soat${dir}`;
  const days = rotationHours / 24;
  return `${days.toFixed(1)} Yer kuni${dir}`;
}
