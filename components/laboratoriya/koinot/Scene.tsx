// components/laboratoriya/koinot/Scene.tsx
/**
 * Scene — the browser-only react-three-fiber <Canvas> for the Quyosh tizimi lab.
 *
 * NEVER rendered during SSR: KoinotLab dynamically imports this with
 * `ssr: false`, so none of this three.js code runs on the server.
 *
 * Responsibilities (the VIEW layer — no facts, no physics decisions live here):
 *  - the glowing Sun (emissive sphere + additive glow sprites — fakes bloom
 *    without the postprocessing package, which is not installed)
 *  - eight shaded planets, each advancing its own orbit angle θ and spin angle φ
 *    inside useFrame (the requestAnimationFrame loop the architecture mandates)
 *    from the REAL relative rates in lib/sims/koinot/planets.ts
 *  - thin orbit rings, a drei <Stars> starfield, sun point light + low ambient
 *  - <OrbitControls> for rotate / zoom / pan, and click-to-select on each planet
 *
 * All motion derives from the shared model constants; there are no CSS keyframes.
 * prefers-reduced-motion (passed as `frozen`) holds every angle still at its
 * seeded phase — a single correct, beautiful frame.
 */
"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Stars, Line, Html } from "@react-three/drei";
import * as THREE from "three";
import {
  PLANETS,
  type PlanetFacts,
  orbitRadius,
  renderRadius,
  orbitOmega,
  spinOmega,
  seedPhase,
} from "@/lib/sims/koinot/planets";

/** Indigo accent for this lab — matches the control chrome. */
const ACCENT = "#6366f1";

interface SceneProps {
  /** id of the currently selected planet, or null */
  selectedId: string | null;
  /** user speed multiplier (already resolved from Sekin/Oddiy/Tez) */
  speed: number;
  /** show the thin orbit rings */
  showOrbits: boolean;
  /** show the floating name labels */
  showLabels: boolean;
  /** prefers-reduced-motion → freeze all motion */
  frozen: boolean;
  /** called when a planet (or the Sun) is clicked */
  onSelect: (id: string | null) => void;
}

/* Precompute per-planet render constants once. */
interface PlanetRender extends PlanetFacts {
  a: number; // orbit radius (scene units)
  r: number; // sphere radius (scene units)
  omega: number; // orbital angular speed (rad/model-s)
  spin: number; // spin angular speed (rad/model-s)
  phase0: number; // seeded starting angle
}

function buildPlanets(): PlanetRender[] {
  return PLANETS.map((p, i) => ({
    ...p,
    a: orbitRadius(p.distanceMkm),
    r: renderRadius(p.diameterKm),
    omega: orbitOmega(p.orbitDays),
    spin: spinOmega(p.rotationHours, p.retrograde),
    phase0: seedPhase(i),
  }));
}

/* ============================================================
 * The Sun — emissive core + two additive glow sprites (fake bloom).
 * ========================================================== */
function Sun({ onSelect }: { onSelect: (id: string | null) => void }) {
  // a soft radial-gradient sprite texture, generated once on the client
  const glowTex = useMemo(() => makeGlowTexture(), []);
  const coreRef = useRef<THREE.Mesh>(null);

  // free the GPU texture on unmount (route change / StrictMode double-mount)
  // so repeated visits don't leak CanvasTextures into the WebGL context.
  useEffect(() => () => glowTex.dispose(), [glowTex]);

  // very slow shimmer of the core (purely visual, frozen-safe: guarded outside)
  return (
    <group>
      {/* the light source — planets are lit from here */}
      <pointLight position={[0, 0, 0]} intensity={3.1} distance={0} decay={0} color="#fff4d6" />

      {/* emissive core */}
      <mesh
        ref={coreRef}
        onPointerDown={(e) => {
          e.stopPropagation();
          onSelect("quyosh");
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "auto")}
      >
        <sphereGeometry args={[2.4, 48, 48]} />
        <meshBasicMaterial color="#ffd25e" toneMapped={false} />
      </mesh>

      {/* inner emissive halo */}
      <mesh scale={4.4}>
        <sphereGeometry args={[2.4, 24, 24]} />
        <meshBasicMaterial
          color="#ffae2e"
          transparent
          opacity={0.12}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* additive glow sprites (billboarded) — the bloom stand-in */}
      <sprite scale={[20, 20, 1]}>
        <spriteMaterial
          map={glowTex}
          color="#ffb347"
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
      <sprite scale={[11, 11, 1]}>
        <spriteMaterial
          map={glowTex}
          color="#fff0c2"
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
    </group>
  );
}

/** Build a soft circular glow as a CanvasTexture (radial alpha falloff). */
function makeGlowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.7)");
  g.addColorStop(0.5, "rgba(255,255,255,0.25)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/* ============================================================
 * A single planet: orbits the Sun (group rotation) + spins on its
 * tilted axis (mesh rotation). Both advanced in useFrame.
 * ========================================================== */
function Planet({
  data,
  selected,
  showLabels,
  speed,
  frozen,
  onSelect,
}: {
  data: PlanetRender;
  selected: boolean;
  showLabels: boolean;
  speed: number;
  frozen: boolean;
  onSelect: (id: string | null) => void;
}) {
  const orbitRef = useRef<THREE.Group>(null); // rotates θ about Y → moves planet on its ring
  const spinRef = useRef<THREE.Mesh>(null); // rotates φ about local axis
  const thetaRef = useRef(data.phase0);
  const phiRef = useRef(0);

  // seed the static frozen pose once
  const initialTheta = data.phase0;

  useFrame((_, rawDt) => {
    if (frozen) return;
    const dt = Math.min(rawDt, 1 / 30); // clamp for stability after dropped frames
    const s = dt * speed;
    thetaRef.current += data.omega * s;
    phiRef.current += data.spin * s;
    if (orbitRef.current) orbitRef.current.rotation.y = -thetaRef.current;
    if (spinRef.current) spinRef.current.rotation.y = phiRef.current;
  });

  const tiltRad = (data.axialTiltDeg * Math.PI) / 180;
  const emissive = new THREE.Color(data.nightTint);

  return (
    // orbit group rotates about Y; the planet sits at +X = radius a
    <group ref={orbitRef} rotation={[0, -initialTheta, 0]}>
      <group position={[data.a, 0, 0]}>
        {/* axial tilt applied to the spinning body + ring */}
        <group rotation={[0, 0, tiltRad]}>
          <mesh
            ref={spinRef}
            onPointerDown={(e) => {
              e.stopPropagation();
              onSelect(data.id);
            }}
            onPointerOver={(e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation();
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => (document.body.style.cursor = "auto")}
          >
            <sphereGeometry args={[data.r, 48, 48]} />
            <meshStandardMaterial
              color={data.color}
              emissive={emissive}
              emissiveIntensity={0.55}
              roughness={0.82}
              metalness={0.05}
            />
          </mesh>

          {/* Saturn's ring */}
          {data.hasRing && (
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[data.r * 1.4, data.r * 2.3, 96]} />
              <meshStandardMaterial
                color="#d9c89a"
                emissive="#6b5d3a"
                emissiveIntensity={0.25}
                side={THREE.DoubleSide}
                transparent
                opacity={0.82}
                roughness={0.9}
              />
            </mesh>
          )}

          {/* selection halo */}
          {selected && (
            <mesh>
              <sphereGeometry args={[data.r * 1.22, 32, 32]} />
              <meshBasicMaterial
                color={ACCENT}
                transparent
                opacity={0.16}
                side={THREE.BackSide}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </mesh>
          )}
        </group>

        {/* floating name label (toggleable) */}
        {showLabels && (
          <Html
            position={[0, data.r + 0.9, 0]}
            center
            pointerEvents="none"
            zIndexRange={[20, 0]}
          >
            <span
              style={{
                display: "inline-block",
                padding: "2px 8px",
                borderRadius: "9999px",
                border: "1px solid",
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.01em",
                whiteSpace: "nowrap",
                userSelect: "none",
                backdropFilter: "blur(4px)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                color: selected ? "#fff" : "#cdd2f5",
                borderColor: selected ? ACCENT : "rgba(255,255,255,0.18)",
                background: selected ? "rgba(99,102,241,0.85)" : "rgba(10,12,24,0.7)",
              }}
            >
              {data.nameUz}
            </span>
          </Html>
        )}
      </group>
    </group>
  );
}

/* ============================================================
 * A thin orbit ring drawn as a 128-gon in the XZ plane.
 * ========================================================== */
function OrbitRing({ radius, highlighted }: { radius: number; highlighted: boolean }) {
  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    const N = 128;
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * Math.PI * 2;
      pts.push([Math.cos(t) * radius, 0, Math.sin(t) * radius]);
    }
    return pts;
  }, [radius]);

  return (
    <Line
      points={points}
      color={highlighted ? ACCENT : "#4a4f72"}
      lineWidth={highlighted ? 1.6 : 0.8}
      transparent
      opacity={highlighted ? 0.9 : 0.45}
      depthWrite={false}
    />
  );
}

/* ============================================================
 * The whole system inside the Canvas (so hooks run in r3f ctx).
 * ========================================================== */
function System({
  planets,
  selectedId,
  speed,
  showOrbits,
  showLabels,
  frozen,
  onSelect,
}: {
  planets: PlanetRender[];
  selectedId: string | null;
  speed: number;
  showOrbits: boolean;
  showLabels: boolean;
  frozen: boolean;
  onSelect: (id: string | null) => void;
}) {
  return (
    <>
      {/* ambient so the night sides aren't pure black (model.md S6) */}
      <ambientLight intensity={0.16} />
      <Stars radius={120} depth={60} count={2600} factor={3.2} saturation={0} fade speed={frozen ? 0 : 0.4} />

      <Sun onSelect={onSelect} />

      {showOrbits &&
        planets.map((p) => (
          <OrbitRing key={`ring-${p.id}`} radius={p.a} highlighted={selectedId === p.id} />
        ))}

      {planets.map((p) => (
        <Planet
          key={p.id}
          data={p}
          selected={selectedId === p.id}
          showLabels={showLabels}
          speed={speed}
          frozen={frozen}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

/* ============================================================ */

export default function Scene({
  selectedId,
  speed,
  showOrbits,
  showLabels,
  frozen,
  onSelect,
}: SceneProps) {
  const planets = useMemo(() => buildPlanets(), []);

  return (
    <Canvas
      camera={{ position: [0, 26, 46], fov: 48, near: 0.1, far: 400 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.setClearColor(new THREE.Color("#05060d"), 1);
      }}
      // clicking empty space deselects
      onPointerMissed={() => onSelect(null)}
    >
      <System
        planets={planets}
        selectedId={selectedId}
        speed={speed}
        showOrbits={showOrbits}
        showLabels={showLabels}
        frozen={frozen}
        onSelect={onSelect}
      />

      <OrbitControls
        enablePan
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.6}
        zoomSpeed={0.85}
        panSpeed={0.6}
        minDistance={8}
        maxDistance={160}
        // keep the camera above the ecliptic so orbits stay readable
        maxPolarAngle={Math.PI * 0.86}
        makeDefault
      />
    </Canvas>
  );
}
