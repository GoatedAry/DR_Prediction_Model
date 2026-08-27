"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

// ─── Particle budget ──────────────────────────────────────────────────────────
const RED_OUTER = 2500;
const RED_IRIS  = 2000;
const TOTAL_RED = RED_OUTER + RED_IRIS;

// ─── Eye geometry constants ───────────────────────────────────────────────────
const RX     = 2.05;
const RY     = 0.74;
const IRIS_R = 0.50;
const GAP    = 0.11;

// ─── Scatter radius for dissolve animation ────────────────────────────────────
const SCATTER_RADIUS = 5.0;

// ─── Custom theme-aware stars particle system ─────────────────────────────────
function BackgroundStars({ theme }: { theme: "dark" | "light" }) {
  const starCount = theme === "light" ? 600 : 300;

  const [positions] = useMemo(() => {
    const pos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 25 + Math.random() * 35;
      
      pos[i3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i3 + 2] = r * Math.cos(phi);
    }
    return [pos];
  }, [starCount]);

  const starColor = theme === "light" ? "#000000" : "#ffffff";

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={starColor}
        size={theme === "light" ? 0.16 : 0.08}
        sizeAttenuation
        transparent
        opacity={theme === "light" ? 0.90 : 0.65}
        depthWrite={false}
      />
    </points>
  );
}

// ─── Parametric particle generator ───────────────────────────────────────────
function buildParticles() {
  const redBase     = new Float32Array(TOTAL_RED * 3);
  const redDists    = new Float32Array(TOTAL_RED);
  const scatterDirs = new Float32Array(TOTAL_RED * 3);

  // Outer almond fill — pointed lens shape
  let count = 0;
  while (count < RED_OUTER) {
    const x  = (Math.random() * 2 - 1) * RX;
    const nx = x / RX;
    const yBound = RY * (1.0 - nx * nx);

    let y = 0;
    if (Math.random() < 0.60) {
      const borderOffset = Math.pow(Math.random(), 2.2) * 0.22;
      y = yBound * (1.0 - borderOffset) * (Math.random() > 0.5 ? 1 : -1);
    } else {
      y = yBound * (Math.random() * 2 - 1);
    }

    if (x * x + y * y < (IRIS_R + GAP) ** 2) continue;

    redBase[count * 3]     = x;
    redBase[count * 3 + 1] = y;
    redBase[count * 3 + 2] = (Math.random() - 0.5) * 0.20;
    redDists[count]        = Math.sqrt(x * x + y * y);
    count++;
  }

  // Inner iris / macula
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

  // Pre-compute random scatter directions for dissolve/reform
  for (let i = 0; i < TOTAL_RED; i++) {
    const theta     = Math.random() * Math.PI * 2;
    const phi       = Math.acos(2 * Math.random() - 1);
    const magnitude = 0.5 + Math.random() * 0.5;
    scatterDirs[i * 3]     = Math.sin(phi) * Math.cos(theta) * magnitude;
    scatterDirs[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * magnitude;
    scatterDirs[i * 3 + 2] = Math.cos(phi) * magnitude;
  }

  return { redBase, redDists, scatterDirs };
}

// ─── Biometric particle eye with dismiss/reform animation ─────────────────────
interface BiometricEyeProps {
  hoverStrength: number;
  dismissTarget: number;
  showEye: boolean;
  theme: "dark" | "light";
  onDismissComplete?: () => void;
  onReformComplete?: () => void;
}

function BiometricEye({
  hoverStrength,
  dismissTarget,
  showEye,
  theme,
  onDismissComplete,
  onReformComplete,
}: BiometricEyeProps) {
  const groupRef  = useRef<THREE.Group>(null);
  const redBufRef = useRef<THREE.BufferAttribute>(null);
  const redMatRef = useRef<THREE.PointsMaterial>(null);

  // Animation state refs (mutable, no re-renders)
  const activeStrength = useRef(0);
  const redPhase       = useRef(0);
  const currentDismiss = useRef(0);
  const eyeOpacity     = useRef(0.0); // Smooth welcome fade-in
  const firedDismiss   = useRef(false);
  const firedReform    = useRef(true); // starts true since eye starts open
  const hasMoved       = useRef(false);

  // Keep callback refs fresh to avoid stale closures in useFrame
  const onDismissRef = useRef(onDismissComplete);
  const onReformRef  = useRef(onReformComplete);
  useEffect(() => { onDismissRef.current = onDismissComplete; }, [onDismissComplete]);
  useEffect(() => { onReformRef.current = onReformComplete; }, [onReformComplete]);

  const { redBase, redDists, scatterDirs } = useMemo(() => buildParticles(), []);

  // Reference-stable animation buffer
  const redAnim = useMemo(() => new Float32Array(TOTAL_RED * 3), []);
  const redArgs = useMemo(() => [redAnim, 3] as const, [redAnim]);

  useFrame((state, delta) => {
    // ── Lerp dismiss state toward target ──────────────────────────────────────
    currentDismiss.current += (dismissTarget - currentDismiss.current) * 0.04;

    // ── Smooth welcome eye opacity fade-in transition ────────────────────────
    const targetOpacity = showEye ? 0.90 : 0.0;
    eyeOpacity.current += (targetOpacity - eyeOpacity.current) * 0.05;

    // ── Fire callbacks at animation thresholds ────────────────────────────────
    if (currentDismiss.current > 0.97 && !firedDismiss.current) {
      firedDismiss.current = true;
      firedReform.current  = false;
      onDismissRef.current?.();
    }
    if (currentDismiss.current < 0.03 && !firedReform.current) {
      firedReform.current  = true;
      firedDismiss.current = false;
      onReformRef.current?.();
    }

    // ── Dismiss animation decomposition ───────────────────────────────────────
    const d = currentDismiss.current;
    let closeFactor = 0;
    let scatterFactor = 0;

    if (d < 0.4) {
      // Eyelids closing/opening phase (0.0 to 0.4)
      closeFactor = d / 0.4;
      scatterFactor = 0;
    } else {
      // Scattering/pull-back phase (0.4 to 1.0)
      closeFactor = 1.0;
      scatterFactor = (d - 0.4) / 0.6;
    }
    const opacityFade   = 1.0 - scatterFactor;

    // ── Hover breathing (only active when eye is open) ────────────────────────
    const effectiveHover = dismissTarget === 0 && d < 0.05 ? hoverStrength : 0;
    activeStrength.current += (effectiveHover - activeStrength.current) * 0.042;

    const speedMult = 1.0 + activeStrength.current * 1.4;
    const ampMult   = 1.0 + activeStrength.current * 1.1;
    redPhase.current += delta * 1.30 * speedMult;

    // ── Red particles: breathing + eyelid-close + scatter ─────────────────────
    const rBuf = redBufRef.current;
    if (rBuf) {
      for (let i = 0; i < TOTAL_RED; i++) {
        const bx   = redBase[i * 3];
        const by   = redBase[i * 3 + 1];
        const bz   = redBase[i * 3 + 2];
        const dist = redDists[i];

        // Z-axis breathing ripple
        const breathZ = Math.sin(redPhase.current + dist * 3.30) * 0.065 * ampMult;

        // Phase 1: Eyelid close — squish y toward 0
        const closedY = by * (1.0 - closeFactor * 0.95);

        // Phase 2: Scatter — fly outward along pre-computed random directions
        const sx = bx     + scatterDirs[i * 3]     * scatterFactor * SCATTER_RADIUS;
        const sy = closedY + scatterDirs[i * 3 + 1] * scatterFactor * SCATTER_RADIUS;
        const sz = bz + breathZ + scatterDirs[i * 3 + 2] * scatterFactor * SCATTER_RADIUS;

        redAnim[i * 3]     = sx;
        redAnim[i * 3 + 1] = sy;
        redAnim[i * 3 + 2] = sz;
      }
      rBuf.needsUpdate = true;
    }

    // ── Material: opacity fade + size swell ───────────────────────────────────
    if (redMatRef.current) {
      redMatRef.current.opacity = eyeOpacity.current * opacityFade;
      redMatRef.current.size    = 0.017 * (1.0 + activeStrength.current * 0.15);
    }

    // ── Mouse tracking coordinates corrected for top navigation bar ──────────
    if (state.pointer.x !== 0 || state.pointer.y !== 0) {
      hasMoved.current = true;
    }
    const px = hasMoved.current ? state.pointer.x : 0;
    const py = hasMoved.current ? state.pointer.y - (56 / state.size.height) : 0;

    // ── Group: cursor-tracking tilt + hover scale ─────────────────────────────
    const grp = groupRef.current;
    if (grp) {
      const tx = THREE.MathUtils.clamp(-py * 0.38, -0.42, 0.42);
      const ty = THREE.MathUtils.clamp( px * 0.38, -0.42, 0.42);
      grp.rotation.x = THREE.MathUtils.lerp(grp.rotation.x, tx, 0.042);
      grp.rotation.y = THREE.MathUtils.lerp(grp.rotation.y, ty, 0.042);

      const targetScale = 1.0 + activeStrength.current * 0.18;
      grp.scale.setScalar(targetScale);
    }

    // ── Camera: subtle depth parallax ─────────────────────────────────────────
    state.camera.position.x = THREE.MathUtils.lerp(
      state.camera.position.x, px * 0.45, 0.03,
    );
    state.camera.position.y = THREE.MathUtils.lerp(
      state.camera.position.y, py * 0.28, 0.03,
    );
  });

  return (
    <group ref={groupRef}>
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
          color={theme === "light" ? "#8B0000" : "#E30022"}
          blending={theme === "light" ? THREE.NormalBlending : THREE.AdditiveBlending}
          size={0.017}
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
interface SceneProps {
  hoverStrength?: number;
  dismissTarget?: number;
  showEye?: boolean;
  theme?: "dark" | "light";
  onDismissComplete?: () => void;
  onReformComplete?: () => void;
}

export default function Scene(props: SceneProps) {
  const {
    hoverStrength = 0,
    dismissTarget = 0,
    showEye = true,
    theme = "dark",
    onDismissComplete,
    onReformComplete,
  } = props;

  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <BackgroundStars key={theme} theme={theme} />

        <BiometricEye
          hoverStrength={hoverStrength}
          dismissTarget={dismissTarget}
          showEye={showEye}
          theme={theme}
          onDismissComplete={onDismissComplete}
          onReformComplete={onReformComplete}
        />
      </Canvas>
    </div>
  );
}
