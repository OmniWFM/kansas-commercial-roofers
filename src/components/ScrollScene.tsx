"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import * as THREE from "three";

/* ---------------------------------------------------------------------------
 * Persistent scroll-driven "Isometric Cutaway" scene.
 * ONE canvas fixed behind the whole page. Native scroll is the scrubber.
 *
 * A commercial building is drawn as an ISOMETRIC 3D technical cutaway —
 * translucent panel fills + glowing white edge lines (blueprint look). One
 * corner of the roof is peeled back so the FULL roof assembly is exposed as a
 * stack of separated, labeled layers:
 *   STEEL DECK -> INSULATION -> COVER BOARD -> RED MEMBRANE -> EDGE METAL.
 *
 * The framing stays isometric the whole time (fixed camera angle). Scroll does
 * NOT orbit — it zooms/pans and drives an EXPLODED-VIEW assembly: the layers
 * begin lifted apart in the hero, then settle down onto the deck one at a time
 * as you move through the sections, ending as a finished, sealed roof.
 *
 * Scroll progress lives in a mutable ref (never state). Six chapters, one per
 * section. useFrame smoothsteps between chapters and damps toward targets.
 * ------------------------------------------------------------------------- */

const BG = "#0E0E10";
const ACCENT = new THREE.Color("#C8262B"); // red membrane
const LINE = "#F4F2EE"; // blueprint edge line
const STEEL = new THREE.Color("#3A3A42"); // steel deck
const INSUL = new THREE.Color("#6E6E4A"); // polyiso insulation (muted)
const COVER = new THREE.Color("#8C8C6E"); // cover board
const METAL = new THREE.Color("#9AA0A6"); // edge metal / parapet

// Building footprint (world units) — long, low commercial box.
const BW = 16; // width  (x) long axis
const BD = 10; // depth  (z)
const BH = 3.2; // wall height (y)
const ROOF_Y = BH; // top of walls = roof plane

// Structural bay grid.
const BAYS_X = 5;
const BAYS_Z = 3;

// Roof joists span the depth, spaced along the length.
const JOISTS = 12;

// The roof-layer stack sits at the roof plane. Each layer has a "seated"
// height; in the exploded state they lift by these extra offsets.
const T_DECK = 0.1;
const T_INSUL = 0.16;
const T_COVER = 0.08;
const T_MEMB = 0.05;

const Y_DECK = ROOF_Y + 0.12;
const Y_INSUL = Y_DECK + T_DECK / 2 + T_INSUL / 2;
const Y_COVER = Y_INSUL + T_INSUL / 2 + T_COVER / 2;
const Y_MEMB = Y_COVER + T_COVER / 2 + T_MEMB / 2;

// Exploded lift amounts (how high each layer floats before it settles).
const EX_DECK = 1.6;
const EX_INSUL = 3.0;
const EX_COVER = 4.2;
const EX_MEMB = 5.6;

// The cutaway: the roof layers only cover this fraction of the footprint on
// the +x / +z corner is peeled OPEN so you can see down into the structure.
const CUT = 0.62; // covered fraction of the roof (rest is the open cutaway)

// Isometric camera angle. We keep this fixed and only move distance/pan.
const ISO = new THREE.Vector3(1, 0.82, 1).normalize();

type ChapterState = {
  dist: number; // camera distance along the iso vector
  panX: number; // look-target x pan
  panY: number; // look-target y pan
  // per-layer settle 0..1 (0 = fully exploded/hidden, 1 = seated)
  deck: number;
  insul: number;
  cover: number;
  memb: number;
  edge: number;
  lineDraw: number; // blueprint construction-line intensity (fades as built)
  glow: number; // warm red glow behind finished roof
};

// Chapter map — order matches the page sections:
// 0 HERO, 1 SYSTEMS, 2 VERTICALS, 3 APPROACH, 4 COVERAGE, 5 CONTACT
const CHAPTERS: ChapterState[] = [
  {
    // HERO — wide isometric establishing shot. Full layer stack floats above
    // the open structure, exploded and fanned out; construction lines drawing.
    dist: 30,
    panX: 0,
    panY: 2.4,
    deck: 0,
    insul: 0,
    cover: 0,
    memb: 0,
    edge: 0,
    lineDraw: 1,
    glow: 0,
  },
  {
    // SYSTEMS — push in toward the cutaway corner; STEEL DECK descends and
    // seats onto the joists first.
    dist: 22,
    panX: 1.2,
    panY: 2.0,
    deck: 1,
    insul: 0,
    cover: 0,
    memb: 0,
    edge: 0,
    lineDraw: 0.8,
    glow: 0,
  },
  {
    // VERTICALS — hold the iso cutaway; INSULATION boards, then COVER BOARD
    // settle down onto the deck.
    dist: 21,
    panX: 1.0,
    panY: 2.2,
    deck: 1,
    insul: 1,
    cover: 1,
    memb: 0,
    edge: 0,
    lineDraw: 0.55,
    glow: 0.1,
  },
  {
    // APPROACH — the RED MEMBRANE lowers and seals across the assembly. The
    // accent moment.
    dist: 20,
    panX: 0.6,
    panY: 2.4,
    deck: 1,
    insul: 1,
    cover: 1,
    memb: 1,
    edge: 0,
    lineDraw: 0.35,
    glow: 0.55,
  },
  {
    // COVERAGE — pull back to the widest iso; perimeter EDGE METAL / parapet
    // caps snap on and the building reads sealed and complete.
    dist: 30,
    panX: 0,
    panY: 2.2,
    deck: 1,
    insul: 1,
    cover: 1,
    memb: 1,
    edge: 1,
    lineDraw: 0.12,
    glow: 0.6,
  },
  {
    // CONTACT — calm framing on the finished isometric building, warm red glow
    // rising off the sealed roof.
    dist: 24,
    panX: 0.2,
    panY: 2.2,
    deck: 1,
    insul: 1,
    cover: 1,
    memb: 1,
    edge: 1,
    lineDraw: 0,
    glow: 0.9,
  },
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ss = (v: number) => THREE.MathUtils.smoothstep(clamp01(v), 0, 1);
const lerp = THREE.MathUtils.lerp;

type ProgressRef = { current: number };

function IsoCutaway({
  progressRef,
  reduced,
}: {
  progressRef: ProgressRef;
  reduced: boolean;
}) {
  const { camera } = useThree();
  const buildingRef = useRef<THREE.Group>(null);
  const deckRef = useRef<THREE.Group>(null);
  const insulRef = useRef<THREE.InstancedMesh>(null);
  const coverRef = useRef<THREE.Group>(null);
  const membRef = useRef<THREE.Mesh>(null);
  const membMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const edgeGroupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.PointLight>(null);
  const guideRef = useRef<THREE.Group>(null);
  const wallMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const camTarget = useRef(new THREE.Vector3(0, 2.2, 0));
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Covered roof area (the cutaway leaves the far +x/+z corner open).
  const roofW = BW * CUT;
  const roofD = BD * CUT;
  // Centered so the OPEN corner is on +x / +z (nearest the camera iso corner).
  const roofCX = -BW / 2 + roofW / 2;
  const roofCZ = -BD / 2 + roofD / 2;

  // ---- Structural columns on the bay grid ----
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

  // ---- Top edge beams (roof-plate grid) ----
  const beams = useMemo(() => {
    const arr: { pos: [number, number, number]; size: [number, number, number] }[] =
      [];
    const stepX = BW / BAYS_X;
    const stepZ = BD / BAYS_Z;
    for (let r = 0; r <= BAYS_Z; r++) {
      arr.push({
        pos: [0, ROOF_Y, -BD / 2 + stepZ * r],
        size: [BW, 0.16, 0.14],
      });
    }
    for (let c = 0; c <= BAYS_X; c++) {
      arr.push({
        pos: [-BW / 2 + stepX * c, ROOF_Y, 0],
        size: [0.14, 0.16, BD],
      });
    }
    return arr;
  }, []);

  // ---- Open roof joists spanning the depth ----
  const joists = useMemo(() => {
    const arr: number[] = [];
    for (let j = 0; j < JOISTS; j++) {
      arr.push(-BW / 2 + (BW / (JOISTS - 1)) * j);
    }
    return arr;
  }, []);

  // ---- Loading-dock bay openings along the front (+z) wall ----
  const dockBays = useMemo(() => {
    const arr: number[] = [];
    const n = 4;
    const span = BW * 0.6;
    for (let i = 0; i < n; i++) arr.push(-span / 2 + (span / (n - 1)) * i);
    return arr;
  }, []);

  // ---- Deck panels (corrugated planks running across the depth) ----
  const deckPlanks = useMemo(() => {
    const arr: { x: number; w: number; seed: number }[] = [];
    const cols = 8;
    const w = roofW / cols;
    for (let c = 0; c < cols; c++) {
      arr.push({
        x: roofCX - roofW / 2 + w * (c + 0.5),
        w: w * 0.9,
        seed: c / cols,
      });
    }
    return arr;
  }, [roofW, roofCX]);

  // ---- Insulation board tile layout ----
  const insulBoards = useMemo(() => {
    const arr: { x: number; z: number; w: number; d: number; seed: number }[] =
      [];
    const cols = 6;
    const rows = 3;
    const w = roofW / cols;
    const dd = roofD / rows;
    let n = 0;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        arr.push({
          x: roofCX - roofW / 2 + w * (c + 0.5),
          z: roofCZ - roofD / 2 + dd * (r + 0.5),
          w: w * 0.93,
          d: dd * 0.93,
          seed: n / (cols * rows),
        });
        n++;
      }
    }
    return arr;
  }, [roofW, roofD, roofCX, roofCZ]);

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

    const dist = lerp(A.dist, B.dist, local);
    const panX = lerp(A.panX, B.panX, local);
    const panY = lerp(A.panY, B.panY, local);
    const deck = lerp(A.deck, B.deck, local);
    const insul = lerp(A.insul, B.insul, local);
    const cover = lerp(A.cover, B.cover, local);
    const memb = lerp(A.memb, B.memb, local);
    const edge = lerp(A.edge, B.edge, local);
    const lineDraw = lerp(A.lineDraw, B.lineDraw, local);
    const glow = lerp(A.glow, B.glow, local);

    // ---- ISOMETRIC camera: fixed angle, damp distance + pan only ----
    const damp = reduced ? 12 : 3.4;
    const tx = ISO.x * dist;
    const ty = ISO.y * dist;
    const tz = ISO.z * dist;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, tx, damp, d);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, ty, damp, d);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, tz, damp, d);

    camTarget.current.x = THREE.MathUtils.damp(camTarget.current.x, panX, damp, d);
    camTarget.current.y = THREE.MathUtils.damp(camTarget.current.y, panY, damp, d);
    camTarget.current.z = THREE.MathUtils.damp(camTarget.current.z, 0, damp, d);

    // gentle idle float on the iso angle (parallax feel without breaking iso)
    if (!reduced) {
      camera.position.x += Math.sin(t * 0.14) * 0.25;
      camera.position.y += Math.cos(t * 0.11) * 0.14;
    }
    camera.lookAt(camTarget.current);

    // building idle micro-rotation
    if (buildingRef.current) {
      const idle = reduced ? 0 : Math.sin(t * 0.06) * 0.05;
      buildingRef.current.rotation.y = THREE.MathUtils.damp(
        buildingRef.current.rotation.y,
        idle,
        2,
        d
      );
    }

    // ---- blueprint construction guide lines fade as build completes ----
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
      wallMatRef.current.opacity = 0.1 + (1 - lineDraw) * 0.12;
    }

    // ---- DECK: planks descend from exploded height and seat, staggered ----
    if (deckRef.current) {
      deckRef.current.children.forEach((child, k) => {
        const pl = deckPlanks[k];
        if (!pl) return;
        const a = clamp01((deck - pl.seed * 0.3) / 0.7);
        const e = ss(a);
        child.visible = deck > 0.001;
        child.position.y = Y_DECK + (1 - e) * EX_DECK;
        const m = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (m) m.opacity = 0.55 + e * 0.45;
      });
    }

    // ---- INSULATION: boards lower and tile in ----
    const insulMesh = insulRef.current;
    if (insulMesh) {
      for (let k = 0; k < insulBoards.length; k++) {
        const b = insulBoards[k];
        const a = clamp01((insul - b.seed * 0.4) / 0.6);
        const e = ss(a);
        const y = Y_INSUL + (1 - e) * EX_INSUL;
        const sc = e < 0.001 ? 0.0001 : 1;
        dummy.position.set(b.x, y, b.z);
        dummy.scale.set(b.w * sc, T_INSUL, b.d * sc);
        dummy.updateMatrix();
        insulMesh.setMatrixAt(k, dummy.matrix);
      }
      insulMesh.instanceMatrix.needsUpdate = true;
      insulMesh.visible = insul > 0.001;
    }

    // ---- COVER BOARD: single slab lowers over insulation ----
    if (coverRef.current) {
      const e = ss(cover);
      coverRef.current.visible = cover > 0.001;
      coverRef.current.position.y = Y_COVER + (1 - e) * EX_COVER;
      const m = (coverRef.current.children[0] as THREE.Mesh)
        ?.material as THREE.MeshStandardMaterial;
      if (m) m.opacity = 0.5 + e * 0.45;
    }

    // ---- MEMBRANE: red sheet lowers then unrolls across (scale x) ----
    if (membRef.current && membMatRef.current) {
      const e = ss(memb);
      membRef.current.visible = memb > 0.001;
      // lower into place over first half, unroll across second half
      const lowering = clamp01(e / 0.45);
      const rolling = clamp01((e - 0.45) / 0.55);
      membRef.current.position.y = Y_MEMB + (1 - ss(lowering)) * EX_MEMB;
      const roll = Math.max(0.0001, ss(rolling));
      membRef.current.scale.x = roll;
      membRef.current.position.x = roofCX - (roofW / 2) * (1 - roll);
      membMatRef.current.emissiveIntensity = 0.25 + glow * 0.9;
      membMatRef.current.opacity = 0.4 + e * 0.55;
    }

    // ---- EDGE METAL: perimeter parapet caps snap on ----
    if (edgeGroupRef.current) {
      const e = ss(edge);
      edgeGroupRef.current.visible = e > 0.01;
      const s = e < 0.001 ? 0.0001 : e;
      edgeGroupRef.current.scale.set(1, s, 1);
      edgeGroupRef.current.position.y = (1 - e) * 1.2;
    }

    // ---- warm red glow from the sealed roof ----
    if (glowRef.current) {
      const pulse = reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 0.7);
      glowRef.current.intensity = glow * 26 * pulse;
    }
  });

  return (
    <group>
      {/* faint blueprint ground grid */}
      <gridHelper
        args={[80, 80, "#1c1c22", "#141418"]}
        position={[0, -0.001, 0]}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color={BG} roughness={1} metalness={0} />
      </mesh>

      <group ref={buildingRef}>
        {/* ---- translucent wall skin (open top so roof is clearly the focus) ---- */}
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

        {/* ---- edge / interior top beams (roof-plate grid) ---- */}
        {beams.map((b, i) => (
          <mesh key={`beam${i}`} position={b.pos}>
            <boxGeometry args={b.size} />
            <meshStandardMaterial color="#2b2b32" roughness={0.65} metalness={0.4} />
            <Edges threshold={12} color={LINE} />
          </mesh>
        ))}

        {/* ---- open roof joists spanning the depth ---- */}
        {joists.map((x, i) => (
          <mesh key={`joist${i}`} position={[x, ROOF_Y - 0.06, 0]}>
            <boxGeometry args={[0.05, 0.16, BD * 0.98]} />
            <meshStandardMaterial color="#33333a" roughness={0.6} metalness={0.45} />
          </mesh>
        ))}

        {/* ---- loading-dock bay openings on the front wall ---- */}
        {dockBays.map((x, i) => (
          <mesh key={`dock${i}`} position={[x, 0.9, BD / 2 + 0.03]}>
            <boxGeometry args={[1.4, 1.8, 0.06]} />
            <meshStandardMaterial color="#0E0E10" transparent opacity={0.85} roughness={1} />
            <Edges threshold={12} color={LINE} />
          </mesh>
        ))}

        {/* ---- entrance canopy at one end ---- */}
        <mesh position={[-BW / 2 - 0.6, 2.0, 0]}>
          <boxGeometry args={[1.2, 0.08, 3]} />
          <meshStandardMaterial color="#26262c" roughness={0.7} metalness={0.35} />
          <Edges threshold={12} color={LINE} />
        </mesh>

        {/* ---- construction guide lines (fade as build completes) ---- */}
        <group ref={guideRef}>
          {/* full roof-plane outline drawn as a thin frame */}
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

        {/* ============================================================
            EXPOSED ROOF ASSEMBLY — sits on the covered corner; the rest of
            the roof plane stays OPEN (the cutaway). Layers explode/settle.
            ============================================================ */}

        {/* ---- LAYER 1: steel deck planks ---- */}
        <group ref={deckRef}>
          {deckPlanks.map((pl, i) => (
            <mesh key={`deck${i}`} position={[pl.x, Y_DECK, roofCZ]} visible={false}>
              <boxGeometry args={[pl.w, T_DECK, roofD * 0.98]} />
              <meshStandardMaterial
                color={STEEL}
                roughness={0.5}
                metalness={0.6}
                transparent
                opacity={1}
              />
              <Edges threshold={14} color={LINE} />
            </mesh>
          ))}
        </group>

        {/* ---- LAYER 2: insulation boards (instanced) ---- */}
        <instancedMesh
          ref={insulRef}
          args={[undefined, undefined, insulBoards.length]}
          visible={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={INSUL} roughness={0.95} metalness={0} />
        </instancedMesh>

        {/* ---- LAYER 3: cover board (single slab) ---- */}
        <group ref={coverRef} visible={false}>
          <mesh position={[roofCX, Y_COVER, roofCZ]}>
            <boxGeometry args={[roofW * 0.99, T_COVER, roofD * 0.99]} />
            <meshStandardMaterial
              color={COVER}
              roughness={0.85}
              metalness={0.05}
              transparent
              opacity={0.9}
            />
            <Edges threshold={14} color={LINE} />
          </mesh>
        </group>

        {/* ---- LAYER 4: red membrane (lowers, then unrolls across) ---- */}
        <mesh ref={membRef} position={[roofCX, Y_MEMB, roofCZ]} visible={false}>
          <boxGeometry args={[roofW * 0.99, T_MEMB, roofD * 0.99]} />
          <meshStandardMaterial
            ref={membMatRef}
            color={ACCENT}
            emissive={ACCENT}
            emissiveIntensity={0.4}
            transparent
            opacity={0.9}
            roughness={0.5}
            metalness={0.1}
          />
        </mesh>

        {/* ---- LAYER 5: perimeter edge metal / parapet caps (snap on) ---- */}
        <group ref={edgeGroupRef} position={[roofCX, Y_MEMB + T_MEMB / 2 + 0.06, roofCZ]} visible={false}>
          {[
            { pos: [0, 0, roofD / 2], size: [roofW, 0.16, 0.1] },
            { pos: [0, 0, -roofD / 2], size: [roofW, 0.16, 0.1] },
            { pos: [roofW / 2, 0, 0], size: [0.1, 0.16, roofD] },
            { pos: [-roofW / 2, 0, 0], size: [0.1, 0.16, roofD] },
          ].map((f, i) => (
            <mesh key={`edge${i}`} position={f.pos as [number, number, number]}>
              <boxGeometry args={f.size as [number, number, number]} />
              <meshStandardMaterial color={METAL} roughness={0.35} metalness={0.75} />
              <Edges threshold={12} color={LINE} />
            </mesh>
          ))}
          {/* rooftop HVAC units on the finished roof — commercial detail */}
          {[
            [roofCX - roofW * 0.22, 0.28, roofCZ - roofD * 0.12],
            [roofCX + roofW * 0.05, 0.28, roofCZ + roofD * 0.1],
            [roofCX + roofW * 0.26, 0.28, roofCZ - roofD * 0.08],
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
      <directionalLight position={[12, 18, 8]} intensity={1.15} color="#fff4f0" />
      <pointLight position={[-14, 6, 7]} intensity={10} distance={44} color={ACCENT} />
      {/* warm glow that rises from the sealed roof in the final chapters */}
      <pointLight
        ref={glowRef}
        position={[roofCX, ROOF_Y + 1.4, roofCZ]}
        intensity={0}
        distance={22}
        color={ACCENT}
      />
      <fog attach="fog" args={[BG, 22, 66]} />
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
      camera={{ position: [24, 20, 24], fov: 34, near: 0.1, far: 140 }}
    >
      <color attach="background" args={[BG]} />
      <IsoCutaway progressRef={progressRef} reduced={reducedRef.current} />
    </Canvas>
  );
}
