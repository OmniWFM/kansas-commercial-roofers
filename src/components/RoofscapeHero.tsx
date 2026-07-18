"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Instances, Instance } from "@react-three/drei";
import * as THREE from "three";

/* ---- Palette (matches site tokens) ---- */
const BG = "#0E0E10";
const SURFACE = "#17171A";
const PANEL = "#1F1F23";
const ACCENT = "#C8262B";

/* Deterministic pseudo-random so the roofscape is stable across SSR/CSR. */
function rand(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const COLS = 16;
const ROWS = 12;
const GAP = 1.15; // spacing between roof plots (streets)

type Roof = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  key: number;
};

function buildRoofs(): Roof[] {
  const roofs: Roof[] = [];
  let k = 0;
  for (let i = 0; i < COLS; i++) {
    for (let j = 0; j < ROWS; j++) {
      const seed = i * 31.7 + j * 12.9;
      const w = 0.7 + rand(seed) * 0.28;
      const d = 0.7 + rand(seed + 5) * 0.28;
      const h = 0.18 + Math.pow(rand(seed + 9), 2.2) * 1.9;
      const x = (i - (COLS - 1) / 2) * GAP;
      const z = (j - (ROWS - 1) / 2) * GAP;
      roofs.push({ x, z, w, d, h, key: k++ });
    }
  }
  return roofs;
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function Roofscape() {
  const roofs = useMemo(buildRoofs, []);
  const group = useRef<THREE.Group>(null);
  const scan = useRef<THREE.Mesh>(null);
  const scanGlow = useRef<THREE.Mesh>(null);
  const reduced = useMemo(prefersReducedMotion, []);
  const { pointer, camera } = useThree();

  const fieldWidth = COLS * GAP;
  const startX = -fieldWidth / 2 - 1;
  const endX = fieldWidth / 2 + 1;

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;

    // Whole-field slow drift + gentle pointer parallax on the camera.
    if (group.current) {
      const targetRotY = reduced ? -0.32 : -0.32 + Math.sin(t * 0.06) * 0.06;
      group.current.rotation.y = targetRotY;
    }

    if (!reduced) {
      const px = pointer.x * 0.9;
      const py = pointer.y * 0.5;
      camera.position.x += (px - camera.position.x) * Math.min(1, delta * 1.6);
      camera.position.y += (5.4 - py - camera.position.y) * Math.min(1, delta * 1.6);
      camera.lookAt(0, 0, 0);
    }

    // Red survey scan line sweeping across the field (the signature moment).
    const period = 7.2;
    const phase = reduced ? 0.5 : (t % period) / period;
    const sx = startX + (endX - startX) * phase;
    if (scan.current) scan.current.position.x = sx;
    if (scanGlow.current) {
      scanGlow.current.position.x = sx;
      const m = scanGlow.current.material as THREE.MeshBasicMaterial;
      m.opacity = reduced ? 0.28 : 0.22 + Math.sin(t * 3) * 0.06;
    }
  });

  const depth = ROWS * GAP + 2;

  return (
    <group ref={group}>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow={false}>
        <planeGeometry args={[fieldWidth + 6, depth + 4]} />
        <meshStandardMaterial color={BG} roughness={1} metalness={0} />
      </mesh>

      {/* Instanced rooftops */}
      <Instances limit={COLS * ROWS} castShadow={false} receiveShadow={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={PANEL} roughness={0.85} metalness={0.1} />
        {roofs.map((r) => (
          <Instance
            key={r.key}
            position={[r.x, r.h / 2, r.z]}
            scale={[r.w, r.h, r.d]}
          />
        ))}
      </Instances>

      {/* Thin bright red membrane scan line */}
      <mesh ref={scan} position={[startX, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.06, depth]} />
        <meshBasicMaterial color={ACCENT} toneMapped={false} />
      </mesh>
      {/* Soft glow band trailing the scan line */}
      <mesh
        ref={scanGlow}
        position={[startX, 0.015, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[0.9, depth]} />
        <meshBasicMaterial
          color={ACCENT}
          transparent
          opacity={0.25}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export default function RoofscapeHero() {
  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance", alpha: true }}
      camera={{ position: [0, 5.4, 9.5], fov: 42 }}
    >
      <fog attach="fog" args={[BG, 9, 26]} />
      <color attach="background" args={[BG]} />
      <ambientLight intensity={0.35} color={"#cfd2d8"} />
      <directionalLight position={[6, 10, 4]} intensity={1.1} color={"#f4f2ee"} />
      <pointLight position={[-6, 3, -4]} intensity={22} distance={22} color={ACCENT} />
      <pointLight position={[4, 2, 6]} intensity={8} distance={16} color={SURFACE} />
      <Roofscape />
    </Canvas>
  );
}
