"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import * as THREE from "three";

/* ------------------------------------------------------------------------
 * Persistent scroll-driven "Blueprint Build" scene.
 * ONE canvas fixed behind the whole page. Native scroll is the scrubber.
 *
 * A LARGE low-slope commercial building is drawn as a 3D technical sketch:
 * a real structural bay grid (steel columns + edge beams), open roof joists
 * spanning the bays, loading-dock bays, a parapet, and rooftop units —
 * so it reads as an actual commercial building blueprint, not a box.
 *
 * It opens as bare steel structure with an OPEN top (no roof). As you scroll
 * the roof assembles one layer at a time:
 *   deck panels -> insulation boards -> red membrane -> perimeter edge metal.
 *
 * Scroll progress lives in a mutable ref (never state). Six chapters, one per
 * page section, each defining a camera target + how far the build has gone.
 * useFrame smoothsteps between chapters and damps toward targets.
 * ---------------------------------------------------------------------- */

const BG = "#0E0E10";
const ACCENT = new THREE.Color("#C8262B");
const LINE = "#F4F2EE"; // blueprint edge line
const STEEL = new THREE.Color("#3A3A42"); // deck panels
const INSUL = new THREE.Color("#6E6E4A"); // insulation boards (muted)
const METAL = new THREE.Color("#8A8A93"); // edge metal

// Building footprint (world units) — LONG and low, like a real commercial box.
const BW = 20; // width  (x)  long axis
const BD = 9; // depth  (z)
const BH = 3.0; // wall / eave height (y)
const ROOF_Y = BH; // top of walls = roof plane

// Structural bay grid.
const BAYS_X = 6; // bays along the long axis
const BAYS_Z = 3; // bays across the depth

// Roof joists span the short (depth) direction, spaced along the length.
const JOISTS = 15;

// Roof layer stacking heights (thin), sitting just above the eave.
const DECK_Y = ROOF_Y + 0.08;
const INSUL_Y = ROOF_Y + 0.2;
const MEMB_Y = ROOF_Y + 0.32;
const EDGE_Y = ROOF_Y + 0.26;

// Deck / insulation grid resolution.
const DECK_COLS = 12; // long thin planks running across the depth, along length
const INSUL_COLS = 10;
const INSUL_ROWS = 4;

type ChapterState = {
  camPos: [number, number, number];
  camTarget: [number, number, number];
  // build phase 0..1 for each roof layer (drives assemble + fade-in)
  deck: number;
  insul: number;
  memb: number;
  edge: number;
  lineDraw: number; // 0..1 blueprint construction-line intensity (fades as built)
  glow: number; // warm red glow behind finished roof
};

// Chapter map — order matches page sections:
// 0 HERO, 1 SYSTEMS, 2 VERTICALS, 3 APPROACH, 4 COVERAGE, 5 CONTACT
const CHAPTERS: ChapterState[] = [
  {
    // HERO — open steel frame, no roof. Wide establishing angle down the long
    // elevation; blueprint construction lines drawing in.
    camPos: [17, 7.5, 18],
    camTarget: [0, 1.8, 0],
    deck: 0,
    insul: 0,
    memb: 0,
    edge: 0,
    lineDraw: 1,
    glow: 0,
  },
  {
    // SYSTEMS — descend to a top-down oblique over the roof; steel DECK planks
    // drop across the joists.
    camPos: [8, 12, 15],
    camTarget: [0, 2.6, 0],
    deck: 1,
    insul: 0,
    memb: 0,
    edge: 0,
    lineDraw: 0.85,
    glow: 0,
  },
  {
    // VERTICALS — pull back + rotate to the far corner; INSULATION boards tile
    // in over the deck.
    camPos: [-16, 9, 15],
    camTarget: [0, 2.5, 0],
    deck: 1,
    insul: 1,
    memb: 0,
    edge: 0,
    lineDraw: 0.6,
    glow: 0,
  },
  {
    // APPROACH — low tracking dolly along the long roof edge; RED MEMBRANE
    // unrolls across the whole roof.
    camPos: [14, 4.2, 9],
    camTarget: [-1, 2.9, -0.5],
    deck: 1,
    insul: 1,
    memb: 1,
    edge: 0,
    lineDraw: 0.35,
    glow: 0.5,
  },
  {
    // COVERAGE — lift to the widest establishing shot; perimeter EDGE METAL /
    // parapet caps snap on and seal the building.
    camPos: [0, 15, 22],
    camTarget: [0, 1.8, 0],
    deck: 1,
    insul: 1,
    memb: 1,
    edge: 1,
    lineDraw: 0.12,
    glow: 0.6,
  },
  {
    // CONTACT — calm slow framing; finished building, warm red glow from the
    // sealed roof.
    camPos: [13, 6, 16],
    camTarget: [0, 2.0, 0],
    deck: 1,
    insul: 1,
    memb: 1,
    edge: 1,
    lineDraw: 0,
    glow: 0.85,
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

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ss = (v: number) => THREE.MathUtils.smoothstep(clamp01(v), 0, 1);

type ProgressRef = { current: number };

function BlueprintBuild({
  progressRef,
  reduced,
}: {
  progressRef: ProgressRef;
  reduced: boolean;
}) {
  const { camera } = useThree();
  const buildingRef = useRef<THREE.Group>(null);
  const deckRef = useRef<THREE.InstancedMesh>(null);
  const insulRef = useRef<THREE.InstancedMesh>(null);
  const membRef = useRef<THREE.Mesh>(null);
  const membMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const edgeGroupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.PointLight>(null);
  const wallMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const guideRef = useRef<THREE.Group>(null);

  const camTarget = useRef(new THREE.Vector3(0, 1.8, 0));
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // ---- Structural columns on the bay grid (perimeter + interior line) ----
  const columns = useMemo(() => {
    const arr: [number, number][] = [];
    const stepX = BW / BAYS_X;
    const stepZ = BD / BAYS_Z;
    for (let c = 0; c <= BAYS_X; c++) {
      for (let r = 0; r <= BAYS_Z; r++) {
        arr.push([-BW / 2 + stepX * c, -BD / 2 + stepZ * r]);
      }
    }
    return arr;
  }, []);

  // ---- Edge beams: top plates running the full perimeter + interior grid ----
  const beams = useMemo(() => {
    const arr: { pos: [number, number, number]; size: [number, number, number] }[] =
      [];
    const stepX = BW / BAYS_X;
    const stepZ = BD / BAYS_Z;
    // beams running along X at each Z grid line
    for (let r = 0; r <= BAYS_Z; r++) {
      arr.push({
        pos: [0, ROOF_Y, -BD / 2 + stepZ * r],
        size: [BW, 0.14, 0.12],
      });
    }
    // beams running along Z at each X grid line
    for (let c = 0; c <= BAYS_X; c++) {
      arr.push({
        pos: [-BW / 2 + stepX * c, ROOF_Y, 0],
        size: [0.12, 0.14, BD],
      });
    }
    return arr;
  }, []);

  // ---- Open roof joists spanning the depth, spaced down the length ----
  const joists = useMemo(() => {
    const arr: number[] = [];
    for (let j = 0; j < JOISTS; j++) {
      arr.push(-BW / 2 + (BW / (JOISTS - 1)) * j);
    }
    return arr;
  }, []);

  // ---- Loading-dock bay openings along the front (long) wall ----
  const dockBays = useMemo(() => {
    const arr: number[] = [];
    const n = 4;
    const span = BW * 0.6;
    for (let i = 0; i < n; i++) {
      arr.push(-span / 2 + (span / (n - 1)) * i);
    }
    return arr;
  }, []);

  // Deck panel layout (long thin steel planks running across the depth).
  const deckPanels = useMemo(() => {
    const arr: { x: number; w: number; seed: number }[] = [];
    const w = BW / DECK_COLS;
    for (let c = 0; c < DECK_COLS; c++) {
      arr.push({
        x: -BW / 2 + w * (c + 0.5),
        w: w * 0.92,
        seed: c / DECK_COLS,
      });
    }
    return arr;
  }, []);

  // Insulation board layout (tiled grid).
  const insulBoards = useMemo(() => {
    const arr: { x: number; z: number; w: number; d: number; seed: number }[] =
      [];
    const w = BW / INSUL_COLS;
    const dd = BD / INSUL_ROWS;
    let n = 0;
    for (let c = 0; c < INSUL_COLS; c++) {
      for (let r = 0; r < INSUL_ROWS; r++) {
        arr.push({
          x: -BW / 2 + w * (c + 0.5),
          z: -BD / 2 + dd * (r + 0.5),
          w: w * 0.93,
          d: dd * 0.93,
          seed: n / (INSUL_COLS * INSUL_ROWS),
        });
        n++;
      }
    }
    return arr;
  }, []);

  useFrame((st, delta) => {
    const d = Math.min(delta, 0.05);
    const p = progressRef.current;
    const t = reduced ? 0 : st.clock.elapsedTime;

    // progress -> chapter pair + smoothstepped local blend
    const seg = p * (CHAPTERS.length - 1);
    const i0 = Math.min(CHAPTERS.length - 1, Math.floor(seg));
    const i1 = Math.min(CHAPTERS.length - 1, i0 + 1);
    const local = ss(seg - i0);
    const A = CHAPTERS[i0];
    const B = CHAPTERS[i1];

    const camPos = lerp3(A.camPos, B.camPos, local);
    const camTgt = lerp3(A.camTarget, B.camTarget, local);
    const deck = THREE.MathUtils.lerp(A.deck, B.deck, local);
    const insul = THREE.MathUtils.lerp(A.insul, B.insul, local);
    const memb = THREE.MathUtils.lerp(A.memb, B.memb, local);
    const edge = THREE.MathUtils.lerp(A.edge, B.edge, local);
    const lineDraw = THREE.MathUtils.lerp(A.lineDraw, B.lineDraw, local);
    const glow = THREE.MathUtils.lerp(A.glow, B.glow, local);

    // ---- camera: damp toward target position + lookAt ----
    const damp = reduced ? 12 : 3.4;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, camPos[0], damp, d);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, camPos[1], damp, d);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, camPos[2], damp, d);
    camTarget.current.x = THREE.MathUtils.damp(camTarget.current.x, camTgt[0], damp, d);
    camTarget.current.y = THREE.MathUtils.damp(camTarget.current.y, camTgt[1], damp, d);
    camTarget.current.z = THREE.MathUtils.damp(camTarget.current.z, camTgt[2], damp, d);
    if (!reduced) {
      camera.position.x += Math.sin(t * 0.16) * 0.28;
      camera.position.y += Math.cos(t * 0.13) * 0.14;
    }
    camera.lookAt(camTarget.current);

    // ---- building: gentle idle rotation ----
    if (buildingRef.current) {
      const idleRotY = reduced ? 0 : Math.sin(t * 0.07) * 0.1;
      buildingRef.current.rotation.y = THREE.MathUtils.damp(
        buildingRef.current.rotation.y,
        idleRotY,
        2,
        d
      );
    }

    // ---- blueprint construction guide lines fade as the build completes ----
    if (guideRef.current) {
      guideRef.current.visible = lineDraw > 0.02;
      const flick = reduced ? 1 : 0.75 + 0.25 * Math.sin(t * 1.4);
      guideRef.current.children.forEach((c) => {
        const m = (c as THREE.LineSegments).material as THREE.LineBasicMaterial;
        if (m) m.opacity = lineDraw * 0.5 * flick;
      });
    }

    // wall fill brightens slightly as it "becomes real"
    if (wallMatRef.current) {
      wallMatRef.current.opacity = 0.1 + (1 - lineDraw) * 0.14;
    }

    // ---- DECK: thin steel planks drop from above into place, staggered ----
    const deckMesh = deckRef.current;
    if (deckMesh) {
      for (let k = 0; k < deckPanels.length; k++) {
        const pl = deckPanels[k];
        const a = clamp01((deck - pl.seed * 0.35) / 0.65);
        const ease = ss(a);
        const dropY = DECK_Y + (1 - ease) * 5;
        const sc = ease < 0.001 ? 0.0001 : 1;
        dummy.position.set(pl.x, dropY, 0);
        dummy.scale.set(pl.w, 0.05, BD * 0.96 * sc);
        dummy.updateMatrix();
        deckMesh.setMatrixAt(k, dummy.matrix);
      }
      deckMesh.instanceMatrix.needsUpdate = true;
      deckMesh.visible = deck > 0.001;
    }

    // ---- INSULATION: boards tile in, slight lift-and-settle ----
    const insulMesh = insulRef.current;
    if (insulMesh) {
      for (let k = 0; k < insulBoards.length; k++) {
        const b = insulBoards[k];
        const a = clamp01((insul - b.seed * 0.4) / 0.6);
        const ease = ss(a);
        const y = INSUL_Y + (1 - ease) * 2.5;
        const sc = ease < 0.001 ? 0.0001 : ease;
        dummy.position.set(b.x, y, b.z);
        dummy.scale.set(b.w * sc, 0.08, b.d * sc);
        dummy.updateMatrix();
        insulMesh.setMatrixAt(k, dummy.matrix);
      }
      insulMesh.instanceMatrix.needsUpdate = true;
      insulMesh.visible = insul > 0.001;
    }

    // ---- MEMBRANE: red sheet rolls across the roof (scale X 0 -> full) ----
    if (membRef.current && membMatRef.current) {
      const roll = ss(memb);
      membRef.current.visible = roll > 0.001;
      membRef.current.scale.x = Math.max(0.0001, roll);
      // anchor the roll to one edge so it appears to unroll across
      membRef.current.position.x = -((BW * 0.98) / 2) * (1 - roll);
      membMatRef.current.emissiveIntensity = 0.25 + glow * 0.9;
      membMatRef.current.opacity = 0.35 + roll * 0.55;
    }

    // ---- EDGE METAL: perimeter parapet caps snap on ----
    if (edgeGroupRef.current) {
      const e = ss(edge);
      edgeGroupRef.current.visible = e > 0.01;
      const s = e < 0.001 ? 0.0001 : e;
      edgeGroupRef.current.scale.set(1, s, 1);
      edgeGroupRef.current.position.y = (1 - e) * 1.5;
    }

    // ---- warm red glow from the sealed roof ----
    if (glowRef.current) {
      const pulse = reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 0.7);
      glowRef.current.intensity = glow * 30 * pulse;
    }
  });

  return (
    <group>
      {/* subtle blueprint ground grid */}
      <gridHelper
        args={[80, 80, "#1c1c22", "#141418"]}
        position={[0, -0.001, 0]}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color={BG} roughness={1} metalness={0} />
      </mesh>

      <group ref={buildingRef}>
        {/* ---- translucent wall skin (low, open top so roof is clearly missing) ---- */}
        {[
          { pos: [0, BH / 2, BD / 2], size: [BW, BH, 0.05] },
          { pos: [0, BH / 2, -BD / 2], size: [BW, BH, 0.05] },
          { pos: [BW / 2, BH / 2, 0], size: [0.05, BH, BD] },
          { pos: [-BW / 2, BH / 2, 0], size: [0.05, BH, BD] },
        ].map((w, i) => (
          <mesh key={`wall${i}`} position={w.pos as [number, number, number]}>
            <boxGeometry args={w.size as [number, number, number]} />
            <meshStandardMaterial
              ref={i === 0 ? wallMatRef : undefined}
              color="#1F1F23"
              transparent
              opacity={0.11}
              roughness={0.9}
              metalness={0.05}
            />
            <Edges threshold={12} color={LINE} />
          </mesh>
        ))}

        {/* ---- structural steel columns on the bay grid ---- */}
        {columns.map((p, i) => (
          <mesh key={`col${i}`} position={[p[0], BH / 2, p[1]]}>
            <boxGeometry args={[0.12, BH, 0.12]} />
            <meshStandardMaterial color="#26262c" roughness={0.7} metalness={0.35} />
            <Edges threshold={12} color={LINE} />
          </mesh>
        ))}

        {/* ---- edge / interior top beams (the roof-plate grid) ---- */}
        {beams.map((b, i) => (
          <mesh key={`beam${i}`} position={b.pos}>
            <boxGeometry args={b.size} />
            <meshStandardMaterial color="#2b2b32" roughness={0.65} metalness={0.4} />
            <Edges threshold={12} color={LINE} />
          </mesh>
        ))}

        {/* ---- open roof joists spanning the depth (the visible open structure) ---- */}
        {joists.map((x, i) => (
          <mesh key={`joist${i}`} position={[x, ROOF_Y - 0.06, 0]}>
            <boxGeometry args={[0.05, 0.16, BD * 0.98]} />
            <meshStandardMaterial color="#33333a" roughness={0.6} metalness={0.45} />
          </mesh>
        ))}

        {/* ---- loading-dock bay openings on the front wall (detail) ---- */}
        {dockBays.map((x, i) => (
          <mesh key={`dock${i}`} position={[x, 0.85, BD / 2 + 0.03]}>
            <boxGeometry args={[1.4, 1.7, 0.06]} />
            <meshStandardMaterial
              color="#0E0E10"
              transparent
              opacity={0.85}
              roughness={1}
            />
            <Edges threshold={12} color={LINE} />
          </mesh>
        ))}

        {/* ---- entrance canopy at one end (detail) ---- */}
        <mesh position={[-BW / 2 - 0.6, 1.9, 0]}>
          <boxGeometry args={[1.2, 0.08, 3]} />
          <meshStandardMaterial color="#26262c" roughness={0.7} metalness={0.35} />
          <Edges threshold={12} color={LINE} />
        </mesh>

        {/* ---- construction guide lines (fade as build completes) ---- */}
        <group ref={guideRef}>
          {/* roof-plane outline drawn as a thin frame */}
          <lineSegments position={[0, ROOF_Y + 0.02, 0]}>
            <edgesGeometry args={[new THREE.BoxGeometry(BW, 0.01, BD)]} />
            <lineBasicMaterial color={LINE} transparent opacity={0.4} />
          </lineSegments>
          {/* red survey diagonals across the open roof */}
          <lineSegments position={[0, ROOF_Y + 0.03, 0]}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                array={
                  new Float32Array([
                    -BW / 2, 0, -BD / 2, BW / 2, 0, BD / 2,
                    -BW / 2, 0, BD / 2, BW / 2, 0, -BD / 2,
                  ])
                }
                count={4}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color={ACCENT} transparent opacity={0.35} />
          </lineSegments>
        </group>

        {/* ---- ROOF LAYER 1: steel deck panels ---- */}
        <instancedMesh
          ref={deckRef}
          args={[undefined, undefined, deckPanels.length]}
          visible={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={STEEL} roughness={0.5} metalness={0.6} />
        </instancedMesh>

        {/* ---- ROOF LAYER 2: insulation boards ---- */}
        <instancedMesh
          ref={insulRef}
          args={[undefined, undefined, insulBoards.length]}
          visible={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={INSUL} roughness={0.95} metalness={0} />
        </instancedMesh>

        {/* ---- ROOF LAYER 3: red membrane (unrolls across) ---- */}
        <mesh ref={membRef} position={[0, MEMB_Y, 0]} visible={false}>
          <boxGeometry args={[BW * 0.98, 0.04, BD * 0.98]} />
          <meshStandardMaterial
            ref={membMatRef}
            color={ACCENT}
            emissive={ACCENT}
            emissiveIntensity={0.4}
            transparent
            opacity={0.85}
            roughness={0.5}
            metalness={0.1}
          />
        </mesh>

        {/* ---- ROOF LAYER 4: perimeter edge metal / parapet caps (snaps on) ---- */}
        <group ref={edgeGroupRef} position={[0, EDGE_Y, 0]} visible={false}>
          {[
            { pos: [0, 0, BD / 2], size: [BW, 0.16, 0.1] },
            { pos: [0, 0, -BD / 2], size: [BW, 0.16, 0.1] },
            { pos: [BW / 2, 0, 0], size: [0.1, 0.16, BD] },
            { pos: [-BW / 2, 0, 0], size: [0.1, 0.16, BD] },
          ].map((f, i) => (
            <mesh key={`edge${i}`} position={f.pos as [number, number, number]}>
              <boxGeometry args={f.size as [number, number, number]} />
              <meshStandardMaterial color={METAL} roughness={0.35} metalness={0.75} />
              <Edges threshold={12} color={LINE} />
            </mesh>
          ))}
          {/* rooftop units (HVAC) sitting on the finished roof — commercial detail */}
          {[
            [-BW * 0.28, 0.28, -BD * 0.15],
            [BW * 0.05, 0.28, BD * 0.12],
            [BW * 0.3, 0.28, -BD * 0.1],
          ].map((p, i) => (
            <mesh key={`rtu${i}`} position={p as [number, number, number]}>
              <boxGeometry args={[1.1, 0.5, 0.9]} />
              <meshStandardMaterial color="#26262c" roughness={0.7} metalness={0.4} />
              <Edges threshold={12} color={LINE} />
            </mesh>
          ))}
        </group>
      </group>

      {/* lighting tuned to the palette */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 16, 8]} intensity={1.15} color="#fff4f0" />
      <pointLight position={[-14, 6, 7]} intensity={12} distance={44} color={ACCENT} />
      {/* warm glow that rises from the sealed roof in the final chapters */}
      <pointLight
        ref={glowRef}
        position={[0, ROOF_Y + 1.4, 0]}
        intensity={0}
        distance={22}
        color={ACCENT}
      />
      <fog attach="fog" args={[BG, 20, 60]} />
    </group>
  );
}

export default function ScrollScene() {
  const progressRef = useRef(0);
  const reducedRef = useRef(false);

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
      camera={{ position: [17, 7.5, 18], fov: 42, near: 0.1, far: 120 }}
    >
      <color attach="background" args={[BG]} />
      <BlueprintBuild progressRef={progressRef} reduced={reducedRef.current} />
    </Canvas>
  );
}
