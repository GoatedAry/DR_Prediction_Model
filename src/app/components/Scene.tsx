"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

// ─── Particle budget ──────────────────────────────────────────────────────────
const RED_OUTER = 2500; // filled almond region (sclera / lids)
const RED_IRIS  = 2000; // dense inner sphere (iris / macula)
const BLUE_N    = 500;  // cyan accent: concentric rings + contour scatter
const TOTAL_RED = RED_OUTER + RED_IRIS;

// ─── Eye geometry constants ───────────────────────────────────────────────────
const RX     = 2.05;  // outer almond half-width
const RY     = 0.74;  // outer almond half-height
const IRIS_R = 0.50;  // inner sphere radius
const GAP    = 0.11;  // dark separation ring (no particles here)

// ─── Parametric particle generator ───────────────────────────────────────────
function buildParticles() {
  const redBase  = new Float32Array(TOTAL_RED * 3);
  const redDists = new Float32Array(TOTAL_RED);
  const blueBase = new Float32Array(BLUE_N * 3);
  const blueDists = new Float32Array(BLUE_N);

  // ── Outer almond fill — rejection sampling ─────────────────────────────────
  let count = 0;
  while (count < RED_OUTER) {
    const x  = (Math.random() * 2 - 1) * RX;
    const y  = (Math.random() * 2 - 1) * RY;
    const nx = x / RX;

    const yBound = RY * Math.sqrt(Math.max(0, 1 - nx * nx)) * (1 - 0.24 * nx * nx);
    if (Math.abs(y) > yBound) continue;
    if (x * x + y * y < (IRIS_R + GAP) ** 2) continue;

    redBase[count * 3]     = x;
    redBase[count * 3 + 1] = y;
    redBase[count * 3 + 2] = (Math.random() - 0.5) * 0.20;
    redDists[count]        = Math.sqrt(x * x + y * y);
    count++;
  }

  // ── Inner iris / macula ────────────────────────────────────────────────────
  for (let i = 0; i < RED_IRIS; i++) {
    const theta = Math.random() * Math.PI * 2;
    const r     = Math.sqrt(Math.random()) * IRIS_R;
    const idx   = RED_OUTER + i;
    const x     = r * Math.cos(theta);
    const y     = r * Math.sin(theta) * 0.87;
    
    redBase[idx * 3]     = x;
    redBase[idx * 3 + 1] = y;
    redBase[idx * 3 + 2] = (Math.random() - 0.5) * 0.32;
    redDists[idx]        = Math.sqrt(x * x + y * y);
  }

  // ── Blue: concentric rings + contour scatter (exact original visual structure) ──
  const RING_RADII = [0.08, 0.19, 0.31, 0.44];
  const RINGS_BUDGET = Math.floor(BLUE_N * 0.65);
  const PER_RING     = Math.floor(RINGS_BUDGET / RING_RADII.length);
  let bIdx = 0;

  for (const r of RING_RADII) {
    for (let i = 0; i < PER_RING; i++) {
      const theta = (i / PER_RING) * Math.PI * 2 + (Math.random() - 0.5) * 0.10;
      const jitter = (Math.random() - 0.5) * 0.04;
      const x = (r + jitter) * Math.cos(theta);
      const y = (r + jitter) * Math.sin(theta) * 0.85;
      blueBase[bIdx * 3]     = x;
      blueBase[bIdx * 3 + 1] = y;
      blueBase[bIdx * 3 + 2] = (Math.random() - 0.5) * 0.07;
      blueDists[bIdx]        = Math.sqrt(x * x + y * y);
      bIdx++;
    }
  }

  while (bIdx < BLUE_N) {
    const t  = Math.random() * Math.PI * 2;
    const ct = Math.cos(t);
    const j  = (Math.random() - 0.5) * 0.13;
    const x  = RX * ct + j;
    const y  = RY * Math.sin(t) * (1 - 0.24 * ct * ct) + j;
    blueBase[bIdx * 3]     = x;
    blueBase[bIdx * 3 + 1] = y;
    blueBase[bIdx * 3 + 2] = (Math.random() - 0.5) * 0.09;
    blueDists[bIdx]        = Math.sqrt(x * x + y * y);
    bIdx++;
  }

  return { redBase, redDists, blueBase, blueDists };
}

// ─── Biometric particle eye ───────────────────────────────────────────────────
function BiometricEye({ hoverStrength }: { hoverStrength: number }) {
  const groupRef   = useRef<THREE.Group>(null);
  const redBufRef  = useRef<THREE.BufferAttribute>(null);
  const blueBufRef = useRef<THREE.BufferAttribute>(null);
  const redMatRef  = useRef<THREE.PointsMaterial>(null);
  const blueMatRef = useRef<THREE.PointsMaterial>(null);

  // Smooth lerp state
  const activeStrength = useRef(0);

  const { redBase, redDists, blueBase, blueDists } = useMemo(
    () => buildParticles(),
    [],
  );

  // Reference-stable argument arrays to prevent recreation and flickering on re-render
  const redAnim  = useMemo(() => new Float32Array(TOTAL_RED * 3), []);
  const blueAnim = useMemo(() => new Float32Array(BLUE_N * 3), []);

  const redArgs  = useMemo(() => [redAnim, 3] as const, [redAnim]);
  const blueArgs = useMemo(() => [blueAnim, 3] as const, [blueAnim]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    // Smooth active strength tracking using an exponential decay curve (lerp)
    const lerpSpeed = 0.075;
    activeStrength.current += (hoverStrength - activeStrength.current) * lerpSpeed;

    // Breathing parameters scale smoothly with hover strength
    const speedMult = 1.0 + activeStrength.current * 1.4;
    const ampMult   = 1.0 + activeStrength.current * 1.1;

    // ── Red: Z-axis breathing ripple ──────────────────────────────────────────
    const rBuf = redBufRef.current;
    if (rBuf) {
      for (let i = 0; i < TOTAL_RED; i++) {
        const bx   = redBase[i * 3];
        const by   = redBase[i * 3 + 1];
        const bz   = redBase[i * 3 + 2];
        const dist = redDists[i];

        redAnim[i * 3]     = bx;
        redAnim[i * 3 + 1] = by;
        redAnim[i * 3 + 2] = bz + Math.sin(t * 1.30 * speedMult + dist * 3.30) * 0.065 * ampMult;
      }
      rBuf.needsUpdate = true;
    }

    // ── Blue: Z-axis breathing ripple ─────────────────────────────────────────
    const bBuf = blueBufRef.current;
    if (bBuf) {
      for (let i = 0; i < BLUE_N; i++) {
        const bx   = blueBase[i * 3];
        const by   = blueBase[i * 3 + 1];
        const bz   = blueBase[i * 3 + 2];
        const dist = blueDists[i];

        blueAnim[i * 3]     = bx;
        blueAnim[i * 3 + 1] = by;
        blueAnim[i * 3 + 2] = bz + Math.sin(t * 2.40 * speedMult + dist * 5.20) * 0.058 * ampMult;
      }
      bBuf.needsUpdate = true;
    }

    // ── Red size updates: organic expansion ───────────────────────────────────
    if (redMatRef.current) {
      redMatRef.current.size = 0.017 * (1.0 + activeStrength.current * 0.15);
    }

    // ── Blue opacity & size updates: smooth fade and expansion in unison ──────
    if (blueMatRef.current) {
      blueMatRef.current.opacity = activeStrength.current * 0.75;
      // Shrink size to zero when not hovered to avoid single-pixel residue
      blueMatRef.current.size = activeStrength.current * 0.023;
    }

    // ── Group: smooth cursor-tracking tilt + group scale zoom ──────────────────
    const grp = groupRef.current;
    if (grp) {
      const tx = THREE.MathUtils.clamp(-state.pointer.y * 0.38, -0.42, 0.42);
      const ty = THREE.MathUtils.clamp( state.pointer.x * 0.38, -0.42, 0.42);
      grp.rotation.x = THREE.MathUtils.lerp(grp.rotation.x, tx, 0.055);
      grp.rotation.y = THREE.MathUtils.lerp(grp.rotation.y, ty, 0.055);

      // Avoid double-lerping scale — tie scale directly to already-lerped activeStrength
      const targetScale = 1.0 + activeStrength.current * 0.18;
      grp.scale.setScalar(targetScale);
    }

    // ── Camera: subtle depth parallax ────────────────────────────────────────
    state.camera.position.x = THREE.MathUtils.lerp(
      state.camera.position.x, state.pointer.x * 0.45, 0.04,
    );
    state.camera.position.y = THREE.MathUtils.lerp(
      state.camera.position.y, state.pointer.y * 0.28, 0.04,
    );
  });

  return (
    <group ref={groupRef} position={[0.35, 0, 0]}>
      {/* ── Red particles ── */}
      <points>
        <bufferGeometry>
          <bufferAttribute
            ref={redBufRef}
            attach="attributes-position"
            args={redArgs}
          />
        </bufferGeometry>
        <pointsMaterial
          ref={redMatRef}
          color="#E30022"
          size={0.017}
          sizeAttenuation
          transparent
          opacity={0.90}
          depthWrite={false}
        />
      </points>

      {/* ── Cyan accent particles ── */}
      <points>
        <bufferGeometry>
          <bufferAttribute
            ref={blueBufRef}
            attach="attributes-position"
            args={blueArgs}
          />
        </bufferGeometry>
        <pointsMaterial
          ref={blueMatRef}
          color="#00FFFF"
          size={0.0}
          sizeAttenuation
          transparent
          opacity={0.0}
          depthWrite={false}
        />
      </points>
    </group>
  );
}

// ─── Scene root ───────────────────────────────────────────────────────────────
export default function Scene({ hoverStrength = 0 }: { hoverStrength?: number }) {
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#000000"]} />
        <BiometricEye hoverStrength={hoverStrength} />
      </Canvas>
    </div>
  );
}
