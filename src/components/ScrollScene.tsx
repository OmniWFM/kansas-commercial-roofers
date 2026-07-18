"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/* ------------------------------------------------------------------ *
 * Persistent scroll-driven roofscape scene.
 * ONE canvas fixed behind the whole page. Native scroll is the scrubber.
 * Scroll progress lives in a mutable ref (never state). Six chapters,
 * one per page section, each defining a camera + field + scan target
 * state. useFrame maps scroll -> active chapter pair, smoothstep-blends,
 * then damps the live values toward the target so it always feels smooth.
 * ------------------------------------------------------------------ */

const BG = "#0E0E10";
const ACCENT = new THREE.Color("#C8262B");
const ROOF_DARK = new THREE.Color("#1A1A1F");
const ROOF_LIT = new THREE.Color("#2A2A31");

// Roof field grid dimensions (reduced on mobile via prop).
type ChapterState = {
  camPos: [number, number, number];
  camTarget: [number, number, number];
  fieldPos: [number, number, number];
  fieldRotX: number;
  fieldSpread: number; // gap multiplier between roofs
  scanX: number; // world-x the scan beam parks / sweeps around
  scanSweep: number; // amplitude of scan travel (0 = parked)
  scanGlow: number; // 0..1 emissive intensity of scan + lit roof
  ring: number; // 0..1 coverage-ring visibility
};

// Chapter map — order matches page sections:
// 0 HERO, 1 SYSTEMS, 2 VERTICALS, 3 APPROACH, 4 COVERAGE, 5 CONTACT
const CHAPTERS: ChapterState[] = [
  {
    // HERO — high aerial establishing shot, wide slow sweep
    camPos: [0, 15.5, 15],
    camTarget: [1.5, 0, -2],
    fieldPos: [1.5, 0, 0],
    fieldRotX: 0,
    fieldSpread: 1,
    scanX: 0,
    scanSweep: 9,
    scanGlow: 0.55,
    ring: 0,
  },
  {
    // SYSTEMS — descend to low oblique over one cluster; scan parks + membrane glows
    camPos: [6.5, 6, 12],
    camTarget: [3.5, 0.4, -1],
    fieldPos: [3.2, 0, 1],
    fieldRotX: 0.12,
    fieldSpread: 1.05,
    scanX: 2.4,
    scanSweep: 0.6,
    scanGlow: 1,
    ring: 0,
  },
  {
    // VERTICALS — pull back up + rotate; roofs re-space into looser clusters
    camPos: [-3, 12, 14],
    camTarget: [0.5, 0, -1],
    fieldPos: [0, 0, 0],
    fieldRotX: -0.06,
    fieldSpread: 1.45,
    scanX: 0,
    scanSweep: 2.5,
    scanGlow: 0.4,
    ring: 0,
  },
  {
    // APPROACH — low dolly along the field, inspection line tracks with camera
    camPos: [7, 4.5, 9],
    camTarget: [4, 0.2, -3],
    fieldPos: [4.5, 0, 0.5],
    fieldRotX: 0.1,
    fieldSpread: 1.1,
    scanX: 3.5,
    scanSweep: 5,
    scanGlow: 0.85,
    ring: 0,
  },
  {
    // COVERAGE — highest wide shot, field spreads statewide, range rings emanate
    camPos: [0, 19, 16],
    camTarget: [0, 0, -2],
    fieldPos: [0, 0, 0],
    fieldRotX: 0,
    fieldSpread: 1.7,
    scanX: 0,
    scanSweep: 11,
    scanGlow: 0.5,
    ring: 1,
  },
  {
    // CONTACT — calm near-static framing, field dims, single warm glow centered
    camPos: [0, 13, 15],
    camTarget: [0, 0, -1],
    fieldPos: [0, -0.4, 0],
    fieldRotX: 0,
    fieldSpread: 1.1,
    scanX: 0,
    scanSweep: 0,
    scanGlow: 0.7,
    ring: 0,
  },
];

function lerp3(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

type ProgressRef = { current: number };

function Roofscape({
  progressRef,
  reduced,
  cols,
  rows,
}: {
  progressRef: ProgressRef;
  reduced: boolean;
  cols: number;
  rows: number;
}) {
  const { camera } = useThree();
  const fieldRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const scanRef = useRef<THREE.Mesh>(null);
  const scanMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);

  // live camera target we damp toward, then lookAt each frame
  const camTarget = useRef(new THREE.Vector3(1.5, 0, -2));
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);

  // Per-roof base layout: position on grid + a stable pseudo-random footprint.
  const roofs = useMemo(() => {
    const arr: {
      gx: number;
      gz: number;
      w: number;
      d: number;
      h: number;
      seed: number;
    }[] = [];
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const seed = Math.abs(Math.sin(c * 12.9 + r * 78.2));
        const seed2 = Math.abs(Math.sin(c * 4.1 + r * 22.4));
        arr.push({
          gx: c - (cols - 1) / 2,
          gz: r - (rows - 1) / 2,
          w: 0.55 + seed * 0.5,
          d: 0.55 + seed2 * 0.5,
          h: 0.18 + seed * 0.5,
          seed,
        });
      }
    }
    return arr;
  }, [cols, rows]);

  const count = roofs.length;

  useFrame((_, delta) => {
    const d = Math.min(delta, 0.05);
    const p = progressRef.current;

    // Map global progress (0..1) into chapter index + local blend.
    const seg = p * (CHAPTERS.length - 1);
    const i0 = Math.min(CHAPTERS.length - 1, Math.floor(seg));
    const i1 = Math.min(CHAPTERS.length - 1, i0 + 1);
    const localRaw = seg - i0;
    const local = THREE.MathUtils.smoothstep(localRaw, 0, 1);
    const A = CHAPTERS[i0];
    const B = CHAPTERS[i1];

    // interpolated chapter target state
    const camPos = lerp3(A.camPos, B.camPos, local);
    const camTgt = lerp3(A.camTarget, B.camTarget, local);
    const fieldPos = lerp3(A.fieldPos, B.fieldPos, local);
    const fieldRotX = THREE.MathUtils.lerp(A.fieldRotX, B.fieldRotX, local);
    const spread = THREE.MathUtils.lerp(A.fieldSpread, B.fieldSpread, local);
    const scanXBase = THREE.MathUtils.lerp(A.scanX, B.scanX, local);
    const scanSweep = THREE.MathUtils.lerp(A.scanSweep, B.scanSweep, local);
    const scanGlow = THREE.MathUtils.lerp(A.scanGlow, B.scanGlow, local);
    const ring = THREE.MathUtils.lerp(A.ring, B.ring, local);

    const t = reduced ? 0 : _.clock.elapsedTime;

    // ---- camera: damp toward target position + lookAt ----
    const damp = reduced ? 12 : 3.2;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, camPos[0], damp, d);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, camPos[1], damp, d);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, camPos[2], damp, d);
    camTarget.current.x = THREE.MathUtils.damp(camTarget.current.x, camTgt[0], damp, d);
    camTarget.current.y = THREE.MathUtils.damp(camTarget.current.y, camTgt[1], damp, d);
    camTarget.current.z = THREE.MathUtils.damp(camTarget.current.z, camTgt[2], damp, d);
    // gentle idle pointer/float parallax (skipped for reduced motion)
    if (!reduced) {
      camera.position.x += Math.sin(t * 0.18) * 0.25;
      camera.position.y += Math.cos(t * 0.15) * 0.15;
    }
    camera.lookAt(camTarget.current);

    // ---- field group: position, tilt, idle drift ----
    if (fieldRef.current) {
      const g = fieldRef.current;
      g.position.x = THREE.MathUtils.damp(g.position.x, fieldPos[0], 3.5, d);
      g.position.y = THREE.MathUtils.damp(g.position.y, fieldPos[1], 3.5, d);
      g.position.z = THREE.MathUtils.damp(g.position.z, fieldPos[2], 3.5, d);
      g.rotation.x = THREE.MathUtils.damp(g.rotation.x, fieldRotX, 3.5, d);
      const idleRotY = reduced ? 0 : Math.sin(t * 0.05) * 0.06;
      g.rotation.y = THREE.MathUtils.damp(g.rotation.y, idleRotY, 2, d);
    }

    // ---- scan beam world-x (parked base + optional sweep) ----
    const scanCycle = reduced ? 0.5 : (Math.sin(t * 0.6) * 0.5 + 0.5);
    const scanX = scanXBase + (scanSweep > 0.001 ? (scanCycle - 0.5) * 2 * scanSweep : 0);
    if (scanRef.current) {
      scanRef.current.position.x = scanX;
      scanRef.current.visible = scanGlow > 0.02;
    }
    if (scanMatRef.current) {
      scanMatRef.current.opacity = 0.18 + scanGlow * 0.5;
    }

    // ---- coverage ring ----
    if (ringRef.current && ringMatRef.current) {
      ringRef.current.visible = ring > 0.02;
      const pulse = reduced ? 1 : (0.6 + 0.4 * Math.sin(t * 0.8));
      const s = 2 + ring * 12 * (reduced ? 1 : (0.85 + 0.15 * Math.sin(t * 0.5)));
      ringRef.current.scale.set(s, s, s);
      ringMatRef.current.opacity = ring * 0.35 * pulse;
    }

    // ---- instanced roofs: layout by spread, light the roofs near scan ----
    const mesh = meshRef.current;
    if (mesh) {
      for (let k = 0; k < count; k++) {
        const rf = roofs[k];
        const x = rf.gx * 1.15 * spread;
        const z = rf.gz * 1.15 * spread;
        const floatY = reduced ? 0 : Math.sin(t * 0.7 + rf.seed * 6.283) * 0.03;
        dummy.position.set(x, rf.h / 2 + floatY, z);
        dummy.scale.set(rf.w, rf.h, rf.d);
        dummy.updateMatrix();
        mesh.setMatrixAt(k, dummy.matrix);

        // proximity of this roof (in field-local x) to the scan line
        const prox = 1 - Math.min(1, Math.abs(x - scanX) / 1.2);
        const lit = prox * scanGlow;
        tmpColor.copy(ROOF_DARK).lerp(ROOF_LIT, 0.5 * prox);
        tmpColor.lerp(ACCENT, lit * 0.85);
        mesh.setColorAt(k, tmpColor);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color={BG} roughness={1} metalness={0} />
      </mesh>

      <group ref={fieldRef}>
        <instancedMesh ref={meshRef} args={[undefined, undefined, count]} castShadow={false}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial roughness={0.85} metalness={0.1} />
        </instancedMesh>

        {/* scan beam — thin bright red membrane line sweeping the field */}
        <mesh ref={scanRef} position={[0, 0.02, 0]}>
          <boxGeometry args={[0.12, 0.9, rows * 1.6]} />
          <meshBasicMaterial
            ref={scanMatRef}
            color={ACCENT}
            transparent
            opacity={0.5}
            toneMapped={false}
          />
        </mesh>

        {/* coverage range ring (COVERAGE chapter) */}
        <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} visible={false}>
          <ringGeometry args={[0.92, 1, 96]} />
          <meshBasicMaterial ref={ringMatRef} color={ACCENT} transparent opacity={0} toneMapped={false} />
        </mesh>
      </group>

      {/* lighting tuned to the palette */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[6, 12, 6]} intensity={1.1} color={"#fff4f0"} />
      <pointLight position={[-8, 4, 4]} intensity={18} distance={30} color={ACCENT} />
      <fog attach="fog" args={[BG, 16, 46]} />
    </group>
  );
}

export default function ScrollScene() {
  const progressRef = useRef(0);
  const reducedRef = useRef(false);

  // dimensions: fewer instances on small screens
  const [cols, rows] = typeof window !== "undefined" && window.innerWidth < 720 ? [10, 8] : [16, 12];

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onMq = () => (reducedRef.current = mq.matches);
    mq.addEventListener?.("change", onMq);

    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progressRef.current = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      mq.removeEventListener?.("change", onMq);
    };
  }, []);

  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance", alpha: true }}
      camera={{ position: [0, 15.5, 15], fov: 42, near: 0.1, far: 100 }}
    >
      <color attach="background" args={[BG]} />
      <Roofscape
        progressRef={progressRef}
        reduced={reducedRef.current}
        cols={cols}
        rows={rows}
      />
    </Canvas>
  );
}
