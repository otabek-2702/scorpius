"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Quyosh va Oy tutilishi — eclipse geometry sim.
 *
 * Top-down view of the Sun-Earth-Moon triangle. The Sun and Earth are at
 * fixed positions; the learner DRAGS the Moon along its circular orbit
 * around Earth. The orbit can be tilted by an inclination slider (degrees),
 * which moves the Moon up/down across the Sun-Earth line.
 *
 * Two modes:
 *   • Solar (Quyosh tutilishi) — Moon's umbra/penumbra cones extend toward Earth.
 *     If the umbra touches the Earth disk, totality occurs there.
 *   • Lunar (Oy tutilishi) — Earth's shadow cones extend away from the Sun.
 *     If the Moon enters the umbra, it goes "blood red".
 *
 * Real geometric construction:
 *   Umbra cone has its apex on the Sun-side beyond the small body; here we
 *   compute the external tangent lines between Sun (R_S) and Moon/Earth
 *   (R_b) — those tangents form the umbra boundary. The penumbra is the
 *   internal tangent lines.
 *
 * Completion: when the user successfully causes ANY eclipse (solar OR
 * lunar) — i.e. an umbra grazes the target body.
 */

interface Props {
  onComplete?: () => void;
}

// SVG geometry — top-down, not to scale (real Sun would be 100x off-screen)
const VBW = 480;
const VBH = 320;

const SUN = { x: 60, y: VBH / 2, r: 30 };
const EARTH = { x: 380, y: VBH / 2, r: 22 };
// Moon orbits Earth at a fixed radius
const ORBIT_R = 90;
const MOON_R = 7;

type Mode = "solar" | "lunar";

export function EclipseSim({ onComplete }: Props) {
  const [mode, setMode] = useState<Mode>("solar");
  // angle: 0 = far side from sun, π = near side (between sun and earth)
  const [angle, setAngle] = useState<number>(Math.PI * 0.6);
  // Inclination in degrees (0 = perfect alignment; up to 6° real Moon)
  const [inclDeg, setInclDeg] = useState<number>(0);
  const completedRef = useRef(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef(false);

  // Moon position from orbit angle + inclination (which we render as vertical offset)
  const inclRad = (inclDeg * Math.PI) / 180;
  // Scale inclination: real Moon at 384,000 km × tan(5°) ≈ 33,000 km, comparable
  // to Earth radius (6,371 km). In our world the orbit is 90 px, so the vertical
  // span needs to comfortably go past Earth's 22 px radius. Use 6° → 40 px max.
  const vertOffset = Math.sin(inclRad) * (40 / Math.sin((6 * Math.PI) / 180));
  const moonX = EARTH.x + Math.cos(angle) * ORBIT_R;
  const moonY = EARTH.y + Math.sin(angle) * (ORBIT_R * 0.18) + vertOffset;
  // ^ the * 0.18 gives a flat-ish ellipse so the orbit reads as a path through depth

  // ---- Shadow geometry ----------------------------------------------------
  // Given two circles (Sun and small body) and that the Sun is the light source,
  // compute the tangent lines from the Sun to the small body that bound:
  //   - the umbra (external tangents — they cross beyond the small body, forming a cone apex)
  //   - the penumbra (internal tangents — they bound the partial shadow region)
  //
  // We return the umbra cone polygon and penumbra polygon, projected out to the
  // canvas edge so the shadow visibly extends across the scene.

  function shadowOf(
    src: { x: number; y: number; r: number },
    body: { x: number; y: number; r: number },
  ): { umbra: string; penumbra: string; umbraApex: { x: number; y: number } } {
    const dx = body.x - src.x;
    const dy = body.y - src.y;
    const d = Math.hypot(dx, dy);
    const ux = dx / d;
    const uy = dy / d;
    // Perpendicular
    const px = -uy;
    const py = ux;

    // External tangent angle (umbra) — apex sits at distance L beyond body
    // where L = body.r * d / (src.r - body.r), measured from src toward body.
    // The umbra apex from body: L_b = body.r * d / (src.r - body.r) - d.
    // (Only valid when src.r > body.r, which always holds: Sun ≫ body.)
    const apexDistFromSrc = (body.r * d) / (src.r - body.r);
    const apexX = src.x + ux * apexDistFromSrc;
    const apexY = src.y + uy * apexDistFromSrc;

    // External tangent points on body: at angle α from the body-src line
    // such that sin α = (src.r − body.r) / d  →  cos α = √(1 − sin² α)
    const sinAlpha = (src.r - body.r) / d;
    const cosAlpha = Math.sqrt(Math.max(0, 1 - sinAlpha * sinAlpha));
    const eb1x = body.x + body.r * (-ux * sinAlpha + px * cosAlpha);
    const eb1y = body.y + body.r * (-uy * sinAlpha + py * cosAlpha);
    const eb2x = body.x + body.r * (-ux * sinAlpha - px * cosAlpha);
    const eb2y = body.y + body.r * (-uy * sinAlpha - py * cosAlpha);

    // Internal tangent angle (penumbra): the lines cross between src and body
    // at distance L_p = (src.r / (src.r + body.r)) * d from src.
    const sinBeta = (src.r + body.r) / d;
    const cosBeta = Math.sqrt(Math.max(0, 1 - sinBeta * sinBeta));
    const ib1x = body.x + body.r * (ux * sinBeta + px * cosBeta);
    const ib1y = body.y + body.r * (uy * sinBeta + py * cosBeta);
    const ib2x = body.x + body.r * (ux * sinBeta - px * cosBeta);
    const ib2y = body.y + body.r * (uy * sinBeta - py * cosBeta);

    // Extend the umbra polygon out to a far distance beyond the apex so its
    // converging cone is visible (and beyond the apex it becomes the antumbra,
    // which we don't render to keep things clean for grade-6).
    // We just clip the polygon to apex + small overshoot.
    const farUmbra = Math.min(apexDistFromSrc, d + 360);
    const ueX = src.x + ux * farUmbra;
    const ueY = src.y + uy * farUmbra;

    // Penumbra: extend far enough to cover the canvas
    const farPen = d + 800;
    const peApexX = src.x + ux * (src.r * d) / (src.r + body.r);
    const peApexY = src.y + uy * (src.r * d) / (src.r + body.r);
    // Beyond the body, the penumbra widens — extend the two diverging lines
    // from the body tangent points away from peApex.
    const v1x = ib1x - peApexX;
    const v1y = ib1y - peApexY;
    const l1 = Math.hypot(v1x, v1y);
    const w1x = peApexX + (v1x / l1) * farPen;
    const w1y = peApexY + (v1y / l1) * farPen;
    const v2x = ib2x - peApexX;
    const v2y = ib2y - peApexY;
    const l2 = Math.hypot(v2x, v2y);
    const w2x = peApexX + (v2x / l2) * farPen;
    const w2y = peApexY + (v2y / l2) * farPen;

    const umbra = `${eb1x},${eb1y} ${ueX},${ueY} ${eb2x},${eb2y}`;
    const penumbra = `${ib1x},${ib1y} ${w1x},${w1y} ${w2x},${w2y} ${ib2x},${ib2y}`;
    return { umbra, penumbra, umbraApex: { x: apexX, y: apexY } };
  }

  // For solar eclipse: shadow caster is the Moon
  // For lunar eclipse: shadow caster is the Earth, target is the Moon
  const moonShadow = shadowOf(SUN, { x: moonX, y: moonY, r: MOON_R });
  const earthShadow = shadowOf(SUN, EARTH);

  // Detect "any eclipse" — does the umbra of the caster touch the target?
  function pointInTriangle(
    px: number,
    py: number,
    triStr: string,
  ): boolean {
    const pts = triStr
      .split(" ")
      .map((s) => s.split(",").map(Number) as [number, number]);
    if (pts.length < 3) return false;
    const [a, b, c] = pts;
    // Barycentric
    const v0x = c[0] - a[0],
      v0y = c[1] - a[1];
    const v1x = b[0] - a[0],
      v1y = b[1] - a[1];
    const v2x = px - a[0],
      v2y = py - a[1];
    const dot00 = v0x * v0x + v0y * v0y;
    const dot01 = v0x * v1x + v0y * v1y;
    const dot02 = v0x * v2x + v0y * v2y;
    const dot11 = v1x * v1x + v1y * v1y;
    const dot12 = v1x * v2x + v1y * v2y;
    const inv = 1 / (dot00 * dot11 - dot01 * dot01);
    const u = (dot11 * dot02 - dot01 * dot12) * inv;
    const v = (dot00 * dot12 - dot01 * dot02) * inv;
    return u >= 0 && v >= 0 && u + v <= 1;
  }

  // Solar: moon's umbra hits Earth's center? + moon between Sun and Earth
  const moonBetweenSunAndEarth =
    moonX > SUN.x + SUN.r && moonX < EARTH.x; // simple "in front" test
  const solarTotal =
    moonBetweenSunAndEarth && pointInTriangle(EARTH.x, EARTH.y, moonShadow.umbra);
  // Solar partial: a sample on Earth's near limb is inside the penumbra
  const solarPartial =
    !solarTotal &&
    moonBetweenSunAndEarth &&
    (pointInTriangle(EARTH.x - EARTH.r, EARTH.y, moonShadow.penumbra) ||
      pointInTriangle(EARTH.x, EARTH.y - EARTH.r, moonShadow.penumbra) ||
      pointInTriangle(EARTH.x, EARTH.y + EARTH.r, moonShadow.penumbra));

  // Lunar: Moon in Earth's umbra (Earth between Sun and Moon)
  const moonBehindEarth = moonX > EARTH.x;
  const lunarTotal =
    moonBehindEarth && pointInTriangle(moonX, moonY, earthShadow.umbra);
  const lunarPartial =
    !lunarTotal &&
    moonBehindEarth &&
    pointInTriangle(moonX, moonY, earthShadow.penumbra);

  const hasEclipse =
    (mode === "solar" && (solarTotal || solarPartial)) ||
    (mode === "lunar" && (lunarTotal || lunarPartial));

  useEffect(() => {
    if (hasEclipse && !completedRef.current) {
      completedRef.current = true;
      onComplete?.();
    }
  }, [hasEclipse, onComplete]);

  // ---- Drag handling ----------------------------------------------------
  function svgPointer(evt: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = ((evt.clientX - rect.left) / rect.width) * VBW;
    const y = ((evt.clientY - rect.top) / rect.height) * VBH;
    return { x, y };
  }

  function updateAngleFromPointer(p: { x: number; y: number }) {
    const dx = p.x - EARTH.x;
    const dy = p.y - EARTH.y;
    setAngle(Math.atan2(dy, dx));
  }

  function onPointerDown(evt: React.PointerEvent<SVGSVGElement>) {
    const p = svgPointer(evt);
    // Allow drag when starting anywhere on the canvas — but specifically
    // initiate via the moon. To keep it generous: any click sets the moon
    // to the nearest orbit point.
    const dx = p.x - moonX;
    const dy = p.y - moonY;
    if (Math.hypot(dx, dy) < 30 || Math.hypot(p.x - EARTH.x, p.y - EARTH.y) < ORBIT_R + 30) {
      dragRef.current = true;
      (evt.target as Element).setPointerCapture?.(evt.pointerId);
      updateAngleFromPointer(p);
    }
  }
  function onPointerMove(evt: React.PointerEvent<SVGSVGElement>) {
    if (!dragRef.current) return;
    updateAngleFromPointer(svgPointer(evt));
  }
  function onPointerUp() {
    dragRef.current = false;
  }

  // Earth fill: dim when in Moon's umbra
  const earthInUmbra = mode === "solar" && solarTotal;
  const moonInUmbra = mode === "lunar" && lunarTotal;

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="overflow-hidden rounded-[18px] border border-void-500 bg-void-700/40">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VBW} ${VBH}`}
          className="block w-full touch-none"
          style={{ cursor: dragRef.current ? "grabbing" : "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* Penumbra (lighter) first — under the umbra */}
          {mode === "solar" && moonBetweenSunAndEarth && (
            <>
              <polygon
                points={moonShadow.penumbra}
                fill="rgba(26, 24, 19, 0.18)"
              />
              <polygon
                points={moonShadow.umbra}
                fill="rgba(26, 24, 19, 0.78)"
              />
            </>
          )}
          {mode === "lunar" && (
            <>
              <polygon
                points={earthShadow.penumbra}
                fill="rgba(26, 24, 19, 0.18)"
              />
              <polygon
                points={earthShadow.umbra}
                fill="rgba(26, 24, 19, 0.78)"
              />
            </>
          )}

          {/* Orbit ring (flattened ellipse to suggest perspective) */}
          <ellipse
            cx={EARTH.x}
            cy={EARTH.y + vertOffset * 0.4}
            rx={ORBIT_R}
            ry={ORBIT_R * 0.18}
            fill="none"
            stroke="rgba(132, 126, 107, 0.45)"
            strokeWidth={1}
            strokeDasharray="2 4"
          />

          {/* Sun */}
          <g>
            {Array.from({ length: 14 }).map((_, i) => {
              const a = (i / 14) * Math.PI * 2;
              const x1 = SUN.x + Math.cos(a) * (SUN.r + 2);
              const y1 = SUN.y + Math.sin(a) * (SUN.r + 2);
              const x2 = SUN.x + Math.cos(a) * (SUN.r + 8);
              const y2 = SUN.y + Math.sin(a) * (SUN.r + 8);
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#e8a21a"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              );
            })}
            <circle cx={SUN.x} cy={SUN.y} r={SUN.r} fill="#e8a21a" />
            <text
              x={SUN.x}
              y={SUN.y + SUN.r + 22}
              fontSize={10}
              fontWeight={700}
              fill="#1a1813"
              textAnchor="middle"
            >
              QUYOSH
            </text>
          </g>

          {/* Earth */}
          <g>
            <circle
              cx={EARTH.x}
              cy={EARTH.y}
              r={EARTH.r}
              fill={earthInUmbra ? "#1a1813" : "#3b7bd1"}
              stroke="#1a1813"
              strokeWidth={1.4}
            />
            {/* Continents — abstract swirl */}
            <path
              d={`M ${EARTH.x - 12} ${EARTH.y - 4} Q ${EARTH.x - 4} ${EARTH.y - 12} ${EARTH.x + 6} ${EARTH.y - 6} Q ${EARTH.x + 14} ${EARTH.y + 2} ${EARTH.x + 4} ${EARTH.y + 10} Q ${EARTH.x - 6} ${EARTH.y + 12} ${EARTH.x - 12} ${EARTH.y - 4}`}
              fill="rgba(232, 162, 26, 0.5)"
              opacity={earthInUmbra ? 0.3 : 0.9}
            />
            <text
              x={EARTH.x}
              y={EARTH.y + EARTH.r + 22}
              fontSize={10}
              fontWeight={700}
              fill="#1a1813"
              textAnchor="middle"
            >
              YER
            </text>
          </g>

          {/* Moon */}
          <g>
            <circle
              cx={moonX}
              cy={moonY}
              r={MOON_R}
              fill={moonInUmbra ? "#d8453b" : "#e7e1d1"}
              stroke="#1a1813"
              strokeWidth={1.2}
            />
            {/* Moon halo hint when draggable */}
            <circle
              cx={moonX}
              cy={moonY}
              r={MOON_R + 6}
              fill="none"
              stroke="rgba(232, 162, 26, 0.7)"
              strokeWidth={1.2}
              strokeDasharray="2 3"
              opacity={hasEclipse ? 0 : 0.8}
            />
            <text
              x={moonX}
              y={moonY - MOON_R - 6}
              fontSize={9}
              fontWeight={700}
              fill="#1a1813"
              textAnchor="middle"
            >
              OY
            </text>
          </g>

          {/* Status badge */}
          <g transform="translate(12, 12)">
            <rect
              width={132}
              height={28}
              rx={6}
              fill={
                hasEclipse
                  ? "rgba(217, 138, 5, 0.95)"
                  : "rgba(242, 239, 230, 0.85)"
              }
              stroke={hasEclipse ? "#d98a05" : "rgba(132,126,107,0.45)"}
              strokeWidth={1}
            />
            <text
              x={66}
              y={18}
              fontSize={11}
              fontWeight={700}
              fill={hasEclipse ? "#fbf9f3" : "#1a1813"}
              textAnchor="middle"
              letterSpacing="0.02em"
            >
              {mode === "solar"
                ? solarTotal
                  ? "TO'LIQ QUYOSH TUTILISHI"
                  : solarPartial
                    ? "QISMAN QUYOSH TUTILISHI"
                    : "TUTILISH YO'Q"
                : lunarTotal
                  ? "TO'LIQ OY TUTILISHI"
                  : lunarPartial
                    ? "QISMAN OY TUTILISHI"
                    : "TUTILISH YO'Q"}
            </text>
          </g>
        </svg>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("solar")}
          className={`inline-flex h-[40px] flex-1 items-center justify-center rounded-full px-4 text-[13px] font-semibold transition active:scale-[0.98] ${
            mode === "solar"
              ? "bg-antares-500 text-void-100 hover:bg-antares-300"
              : "border border-void-500 bg-void-700 text-void-100 hover:bg-void-600"
          }`}
        >
          Quyosh tutilishi
        </button>
        <button
          type="button"
          onClick={() => setMode("lunar")}
          className={`inline-flex h-[40px] flex-1 items-center justify-center rounded-full px-4 text-[13px] font-semibold transition active:scale-[0.98] ${
            mode === "lunar"
              ? "bg-antares-500 text-void-100 hover:bg-antares-300"
              : "border border-void-500 bg-void-700 text-void-100 hover:bg-void-600"
          }`}
        >
          Oy tutilishi
        </button>
      </div>

      {/* Inclination slider */}
      <div className="rounded-[14px] border border-void-500 bg-void-700/60 p-3">
        <div className="flex items-baseline justify-between">
          <label htmlFor="incl" className="text-[12px] font-semibold text-void-200">
            Oy orbitasi qiyaligi
          </label>
          <span className="font-mono text-[12px] text-void-300">{inclDeg.toFixed(1)}°</span>
        </div>
        <input
          id="incl"
          type="range"
          min={-6}
          max={6}
          step={0.1}
          value={inclDeg}
          onChange={(e) => setInclDeg(Number(e.target.value))}
          className="mt-2 w-full accent-antares-500"
        />
        <div className="mt-1 flex justify-between text-[10px] text-void-300">
          <span>−6°</span>
          <span>0° (chiziqda)</span>
          <span>+6°</span>
        </div>
      </div>

      <p className="text-[12px] leading-relaxed text-void-300">
        <span className="text-void-200">Oyni torting</span> — uni Quyosh va Yer o&apos;rtasiga qo&apos;ying.
        Soya konusi (umbra) Yerga tegishi kerak. Qiyalik 0° dan uzoqlashsa, soya yerdan o&apos;tib ketadi —{" "}
        <em>shuning uchun tutilish har oyda bo&apos;lmaydi</em>.
      </p>
    </div>
  );
}
