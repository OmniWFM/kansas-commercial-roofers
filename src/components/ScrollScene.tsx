"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Edges, Instances, Instance } from "@react-three/drei";
import * as THREE from "three";

/* ------------------------------------------------------------------------
 * Persistent scroll-driven "Blueprint Build" scene.
 * ONE canvas fixed behind the whole page. Native scroll is the scrubber.
 *
 * A FULL commercial building is drawn as an isometric 3D technical sketch —
 * translucent panel fills + glowing white edge lines (blueprint look). It is
 * NOT a box: two connected volumes (a taller office/entry block + a long
 * low-slope warehouse wing), a structural steel bay grid, open roof joists,
 * loading-dock bays, an entrance canopy, and rooftop units.
 *
 * The roof starts OPEN (bare deck grid / joists). As you scroll, the roof is
 * progressively COVERED — a red membrane floods across the ENTIRE roof plane
 * panel by panel, following an install front, until the whole building is
 * sealed with edge metal, rooftop HVAC and drains, and a warm red glow.
 *
 * Scroll progress lives in a mutable ref (never state). Six chapters, one per
 * section, steer the camera + which roof furniture reveals; roof coverage is a
 * continuous 0..1 across the whole scroll. useFrame smoothsteps between
 * chapters and damps toward targets.
 * ---------------------------------------------------------------------- */

const BG = "#0E0E10";
const ACCENT = new THREE.Color("#C8262B"); // red membrane
const ACCENT_DARK = new THREE.Color("#7E1418");
const LINE = "#F4F2EE"; // blueprint edge line
const DECK_COL = new THREE.Color("#33333A"); // bare steel deck (uncovered)

// Isometric camera direction (kept fixed; scroll only moves distance + pan).
const ISO = new THREE.Vector3(1, 0.8, 1).normalize();

// ---- Warehouse wing (main long volume) ----
const WW = 20; // width  (x, long axis)
const WD = 11; // depth  (z)
const WH = 3.2; // wall height (y)

// ---- Office / entry block (taller, narrower, front-left corner) ----
const OW = 6; // width  (x)
const OD = 5.5; // depth (z)
const OH = 5.0; // height (y) — taller than the warehouse
// office sits at the -x end, pushed toward the +z (front) side
const OX = -WW / 2 + OW / 2;
const OZ = WD / 2 - OD / 2;

// Roof panel grid over the WAREHOUSE roof plane (this is the star mechanic).
const RC = 12; // columns along x
const RR = 6; //  rows along z
// Roof panel grid over the OFFICE roof (smaller).
const ORC = 3;
const ORR = 3;

type PanelDef = {
  x: number;
  z: number;
  w: number;
  d: number;
  order: number; // 0..1 install order (sweep across the whole roof)
  office: boolean;
};

type ChapterState = {
  dist: number; // camera distance along the iso vector
  panX: number; // look-target x
  panY: number; // look-target y
  cov: number; // roof coverage 0..1 (fraction of panels installed)
  furniture: number; // rooftop HVAC/drains reveal 0..1
  edge: number; // perimeter edge-metal / parapet caps 0..1
  lineDraw: number; // blueprint construction-line intensity (fades as built)
  glow: number; // warm red glow behind the finished roof
};

// Chapter map — order matches the page sections:
// 0 HERO, 1 SYSTEMS, 2 VERTICALS, 3 APPROACH, 4 COVERAGE, 5 CONTACT
const CHAPTERS: ChapterState[] = [
  {
    // HERO — wide iso establishing shot. Full building outline, roof OPEN
    // (bare deck grid + joists), construction lines drawing, install front parked.
    dist: 32,
    panX: 0,
    panY: 2.2,
    cov: 0.04,
    furniture: 0,
    edge: 0,
    lineDraw: 1,
    glow: 0,
  },
  {
    // SYSTEMS — push toward the warehouse roof; the red membrane starts
    // flooding across from the office end.
    dist: 24,
    panX: -1.5,
    panY: 2.6,
    cov: 0.34,
    furniture: 0,
    edge: 0,
    lineDraw: 0.8,
    glow: 0.15,
  },
  {
    // VERTICALS — pull back a touch; coverage keeps sweeping across the field,
    // office-block roof begins covering too.
    dist: 27,
    panX: 0.5,
    panY: 2.6,
    cov: 0.6,
    furniture: 0.1,
    edge: 0,
    lineDraw: 0.55,
    glow: 0.25,
  },
  {
    // APPROACH — low tracking along the install front as the membrane keeps
    // laying across the roof. The accent-red moment.
    dist: 22,
    panX: 2.0,
    panY: 2.3,
    cov: 0.82,
    furniture: 0.35,
    edge: 0.2,
    lineDraw: 0.35,
    glow: 0.5,
  },
  {
    // COVERAGE — pull to the widest iso; the LAST panels close, perimeter edge
    // metal / parapet caps snap on, rooftop units + drains appear.
    dist: 31,
    panX: 0,
    panY: 2.5,
    cov: 1,
    furniture: 1,
    edge: 1,
    lineDraw: 0.12,
    glow: 0.6,
  },
  {
    // CONTACT — calm framing on the finished, fully-roofed building; warm red
    // glow rising off the sealed roof.
    dist: 25,
    panX: 0.2,
    panY: 2.4,
    cov: 1,
    furniture: 1,
    edge: 1,
    lineDraw: 0,
    glow: 0.95,
  },
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ss = (v: number) => THREE.MathUtils.smoothstep(clamp01(v), 0, 1);
const lerp = THREE.MathUtils.lerp;

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
  const wePanelsRef = useRef<THREE.InstancedMesh>(null);
  const deckPanelsRef = useRef<THREE.InstancedMesh>(null);
  const membMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const frontRef = useRef<THREE.Mesh>(null);
  const frontMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const edgeGroupRef = useRef<THREE.Group>(null);
  const furnitureRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.PointLight>(null);
  const guideRef = useRef<THREE.Group>(null);

  const camTarget = useRef(new THREE.Vector3(0, 2.2, 0));
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);

  const WROOF_Y = WH; // warehouse roof plane
  const OROOF_Y = OH; // office roof plane

  // ---- Build the ordered list of roof panels (warehouse + office) ----
  // Install order sweeps across x (office end -> far end); a small z bias makes
  // the front look organic rather than a hard vertical line.
  const panels = useMemo(() => {
    const arr: PanelDef[] = [];
    const wcell = WW / RC;
    const dcell = WD / RR;
    for (let c = 0; c < RC; c++) {
      for (let r = 0; r < RR; r++) {
        const x = -WW / 2 + wcell * (c + 0.5);
        const z = -WD / 2 + dcell * (r + 0.5);
        // sweep left(-x) to right(+x); slight per-row offset
        const order = (c + (r / RR) * 0.55) / (RC + 0.55);
        arr.push({ x, z, w: wcell * 0.94, d: dcell * 0.94, order, office: false });
      }
    }
    const owcell = OW / ORC;
    const odcell = OD / ORR;
    for (let c = 0; c < ORC; c++) {
      for (let r = 0; r < ORR; r++) {
        const x = OX - OW / 2 + owcell * (c + 0.5);
        const z = OZ - OD / 2 + odcell * (r + 0.5);
        // office roof covers early (it's at the start of the sweep)
        const order = 0.02 + (c + r * 0.4) / (ORC * 6);
        arr.push({ x, z, w: owcell * 0.94, d: odcell * 0.94, order, office: true });
      }
    }
    return arr;
  }, []);

  const TOTAL = panels.length;

  // ---- Structural columns on the warehouse bay grid ----
  const columns = useMemo(() => {
    const arr: [number, number][] = [];
    const bx = 5;
    const bz = 3;
    for (let c = 0; c <= bx; c++) {
      for (let r = 0; r <= bz; r++) {
        arr.push([-WW / 2 + (WW / bx) * c, -WD / 2 + (WD / bz) * r]);
      }
    }
    return arr;
  }, []);

  // ---- Top edge/interior beams forming the roof plate ----
  const beams = useMemo(() => {
    const arr: { pos: [number, number, number]; size: [number, number, number] }[] = [];
    const bx = 5;
    const bz = 3;
    for (let r = 0; r <= bz; r++) {
      arr.push({ pos: [0, WROOF_Y, -WD / 2 + (WD / bz) * r], size: [WW, 0.16, 0.14] });
    }
    for (let c = 0; c <= bx; c++) {
      arr.push({ pos: [-WW / 2 + (WW / bx) * c, WROOF_Y, 0], size: [0.14, 0.16, WD] });
    }
    return arr;
  }, [WROOF_Y]);

  // ---- Open roof joists spanning the depth ----
  const joists = useMemo(() => {
    const arr: number[] = [];
    const n = 15;
    for (let j = 0; j < n; j++) arr.push(-WW / 2 + (WW / (n - 1)) * j);
    return arr;
  }, []);

  // ---- Loading-dock bay openings on the front (+z) warehouse wall ----
  const docks = useMemo(() => {
    const arr: number[] = [];
    const n = 5;
    const span = WW * 0.55;
    const start = WW * 0.02; // shift toward +x, away from the office block
    for (let i = 0; i < n; i++) arr.push(start - span / 2 + (span / (n - 1)) * i);
    return arr;
  }, []);

  // ---- Office curtain-wall mullion lines (front + side faces) ----
  const mullions = useMemo(() => {
    const v: number[] = [];
    for (let i = 1; i < 5; i++) v.push(OX - OW / 2 + (OW / 5) * i);
    const h: number[] = [];
    for (let i = 1; i < 5; i++) h.push((OH / 5) * i);
    return { v, h };
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

    const dist = lerp(A.dist, B.dist, local);
    const panX = lerp(A.panX, B.panX, local);
    const panY = lerp(A.panY, B.panY, local);
    const cov = lerp(A.cov, B.cov, local);
    const furniture = lerp(A.furniture, B.furniture, local);
    const edge = lerp(A.edge, B.edge, local);
    const lineDraw = lerp(A.lineDraw, B.lineDraw, local);
    const glow = lerp(A.glow, B.glow, local);

    // ---- ISOMETRIC camera: fixed angle, damp distance + pan only ----
    const damp = reduced ? 12 : 3.6;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, ISO.x * dist, damp, d);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, ISO.y * dist, damp, d);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, ISO.z * dist, damp, d);
    camTarget.current.x = THREE.MathUtils.damp(camTarget.current.x, panX, damp, d);
    camTarget.current.y = THREE.MathUtils.damp(camTarget.current.y, panY, damp, d);
    camTarget.current.z = THREE.MathUtils.damp(camTarget.current.z, 0, damp, d);

    if (!reduced) {
      camera.position.x += Math.sin(t * 0.13) * 0.22;
      camera.position.y += Math.cos(t * 0.1) * 0.13;
    }
    camera.lookAt(camTarget.current);

    // idle micro-rotation
    if (buildingRef.current) {
      const idle = reduced ? 0 : Math.sin(t * 0.06) * 0.045;
      buildingRef.current.rotation.y = THREE.MathUtils.damp(
        buildingRef.current.rotation.y,
        idle,
        2,
        d
      );
    }

    // ---- COVERAGE: red membrane panels flood across the whole roof ----
    // Each panel installs when coverage passes its order threshold; a soft band
    // (feather) animates the panel rising + fading in as the front reaches it.
    const feather = 0.06;
    const memb = wePanelsRef.current;
    const bareDeck = deckPanelsRef.current;
    if (memb && bareDeck) {
      for (let k = 0; k < TOTAL; k++) {
        const pn = panels[k];
        const a = ss((cov - pn.order) / feather);
        const roofY = pn.office ? OROOF_Y : WROOF_Y;

        // installed red membrane panel: drops the last bit into place + fades in
        const my = roofY + 0.14 + (1 - a) * 0.9;
        dummy.position.set(pn.x, my, pn.z);
        const msc = a < 0.001 ? 0.0001 : 1;
        dummy.scale.set(pn.w * msc, 0.06, pn.d * msc);
        dummy.updateMatrix();
        memb.setMatrixAt(k, dummy.matrix);
        // color: warm red, slightly darker for office block for depth
        tmpColor.copy(pn.office ? ACCENT_DARK : ACCENT).lerp(ACCENT, a * 0.4);
        memb.setColorAt(k, tmpColor);

        // bare steel deck patch shows until this panel is covered (1 - a)
        const bshow = 1 - a;
        dummy.position.set(pn.x, roofY + 0.08, pn.z);
        const bsc = bshow < 0.02 ? 0.0001 : 1;
        dummy.scale.set(pn.w * bsc, 0.05, pn.d * bsc);
        dummy.updateMatrix();
        bareDeck.setMatrixAt(k, dummy.matrix);
      }
      memb.instanceMatrix.needsUpdate = true;
      if (memb.instanceColor) memb.instanceColor.needsUpdate = true;
      bareDeck.instanceMatrix.needsUpdate = true;
    }
    if (membMatRef.current) {
      membMatRef.current.emissiveIntensity = 0.28 + glow * 0.9;
    }

    // ---- the glowing "install front" line that sweeps across the roof ----
    if (frontRef.current && frontMatRef.current) {
      const active = cov > 0.02 && cov < 0.99;
      frontRef.current.visible = active;
      // front x-position follows coverage across the warehouse width
      const fx = -WW / 2 + cov * WW;
      frontRef.current.position.set(fx, WROOF_Y + 0.2, 0);
      const pulse = reduced ? 1 : 0.7 + 0.3 * Math.sin(t * 3);
      frontMatRef.current.opacity = active ? 0.85 * pulse : 0;
    }

    // ---- perimeter edge metal / parapet caps snap on ----
    if (edgeGroupRef.current) {
      const e = ss(edge);
      edgeGroupRef.current.visible = e > 0.01;
      const s = e < 0.001 ? 0.0001 : e;
      edgeGroupRef.current.scale.set(1, s, 1);
      edgeGroupRef.current.position.y = (1 - e) * 1.0;
    }

    // ---- rooftop HVAC units + drains appear as the roof completes ----
    if (furnitureRef.current) {
      const f = ss(furniture);
      furnitureRef.current.visible = f > 0.01;
      furnitureRef.current.children.forEach((child, idx) => {
        const local2 = clamp01((f - (idx % 5) * 0.08) / 0.5);
        const e = ss(local2);
        child.scale.setScalar(e < 0.001 ? 0.0001 : e);
      });
    }

    // ---- construction guide lines fade as the build completes ----
    if (guideRef.current) {
      guideRef.current.visible = lineDraw > 0.02;
      const flick = reduced ? 1 : 0.75 + 0.25 * Math.sin(t * 1.4);
      guideRef.current.children.forEach((c) => {
        const m = (c as THREE.LineSegments).material as THREE.LineBasicMaterial;
        if (m) m.opacity = lineDraw * 0.45 * flick;
      });
    }

    // ---- warm red glow rising off the sealed roof ----
    if (glowRef.current) {
      const pulse = reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 0.7);
      glowRef.current.intensity = glow * 30 * pulse;
    }
  });

  return (
    <group>
      {/* faint blueprint ground grid */}
      <gridHelper args={[90, 90, "#1c1c22", "#141418"]} position={[0, -0.001, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[140, 140]} />
        <meshStandardMaterial color={BG} roughness={1} metalness={0} />
      </mesh>

      <group ref={buildingRef}>
        {/* ============ WAREHOUSE WING (long low volume) ============ */}
        {/* translucent walls (open top so the roof is the focus) */}
        {[
          { pos: [0, WH / 2, WD / 2], size: [WW, WH, 0.05] },
          { pos: [0, WH / 2, -WD / 2], size: [WW, WH, 0.05] },
          { pos: [WW / 2, WH / 2, 0], size: [0.05, WH, WD] },
          { pos: [-WW / 2, WH / 2, 0], size: [0.05, WH, WD] },
        ].map((w, i) => (
          <mesh key={`ww${i}`} position={w.pos as [number, number, number]}>
            <boxGeometry args={w.size as [number, number, number]} />
            <meshStandardMaterial
              color="#1F1F23"
              transparent
              opacity={0.1}
              roughness={0.9}
              metalness={0.05}
            />
            <Edges threshold={12} color={LINE} />
          </mesh>
        ))}

        {/* structural steel columns on the bay grid */}
        {columns.map((p, i) => (
          <mesh key={`col${i}`} position={[p[0], WH / 2, p[1]]}>
            <boxGeometry args={[0.12, WH, 0.12]} />
            <meshStandardMaterial color="#26262c" roughness={0.7} metalness={0.35} />
            <Edges threshold={12} color={LINE} />
          </mesh>
        ))}

        {/* roof-plate beams */}
        {beams.map((b, i) => (
          <mesh key={`beam${i}`} position={b.pos}>
            <boxGeometry args={b.size} />
            <meshStandardMaterial color="#2b2b32" roughness={0.65} metalness={0.4} />
            <Edges threshold={12} color={LINE} />
          </mesh>
        ))}

        {/* open roof joists spanning the depth */}
        {joists.map((x, i) => (
          <mesh key={`joist${i}`} position={[x, WROOF_Y - 0.06, 0]}>
            <boxGeometry args={[0.05, 0.14, WD * 0.98]} />
            <meshStandardMaterial color="#33333a" roughness={0.6} metalness={0.45} />
          </mesh>
        ))}

        {/* loading-dock bay openings on the front wall */}
        {docks.map((x, i) => (
          <mesh key={`dock${i}`} position={[x, 0.95, WD / 2 + 0.03]}>
            <boxGeometry args={[1.5, 1.9, 0.06]} />
            <meshStandardMaterial color="#0E0E10" transparent opacity={0.85} roughness={1} />
            <Edges threshold={12} color={LINE} />
          </mesh>
        ))}

        {/* ============ OFFICE / ENTRY BLOCK (taller, front-left) ============ */}
        <group>
          {/* solid-ish translucent volume */}
          {[
            { pos: [OX, OH / 2, OZ + OD / 2], size: [OW, OH, 0.05] },
            { pos: [OX, OH / 2, OZ - OD / 2], size: [OW, OH, 0.05] },
            { pos: [OX + OW / 2, OH / 2, OZ], size: [0.05, OH, OD] },
            { pos: [OX - OW / 2, OH / 2, OZ], size: [0.05, OH, OD] },
          ].map((w, i) => (
            <mesh key={`ow${i}`} position={w.pos as [number, number, number]}>
              <boxGeometry args={w.size as [number, number, number]} />
              <meshStandardMaterial
                color="#22222a"
                transparent
                opacity={0.16}
                roughness={0.85}
                metalness={0.1}
              />
              <Edges threshold={12} color={LINE} />
            </mesh>
          ))}

          {/* curtain-wall mullions on the front (+z) face */}
          {mullions.v.map((x, i) => (
            <mesh key={`mv${i}`} position={[x, OH / 2, OZ + OD / 2 + 0.03]}>
              <boxGeometry args={[0.04, OH, 0.02]} />
              <meshStandardMaterial color={LINE} transparent opacity={0.55} />
            </mesh>
          ))}
          {mullions.h.map((y, i) => (
            <mesh key={`mh${i}`} position={[OX, y, OZ + OD / 2 + 0.03]}>
              <boxGeometry args={[OW, 0.04, 0.02]} />
              <meshStandardMaterial color={LINE} transparent opacity={0.55} />
            </mesh>
          ))}

          {/* entrance canopy off the office front */}
          <mesh position={[OX, 2.2, OZ + OD / 2 + 0.7]}>
            <boxGeometry args={[OW * 0.7, 0.08, 1.4]} />
            <meshStandardMaterial color="#26262c" roughness={0.7} metalness={0.35} />
            <Edges threshold={12} color={LINE} />
          </mesh>
          {/* stepped parapet cap on the office roof */}
          <mesh position={[OX, OH + 0.12, OZ]}>
            <boxGeometry args={[OW + 0.1, 0.22, OD + 0.1]} />
            <meshStandardMaterial color="#2b2b32" transparent opacity={0.4} roughness={0.6} />
            <Edges threshold={12} color={LINE} />
          </mesh>
        </group>

        {/* construction guide lines (fade as build completes) */}
        <group ref={guideRef}>
          <lineSegments position={[0, WROOF_Y + 0.02, 0]}>
            <edgesGeometry args={[new THREE.BoxGeometry(WW, 0.01, WD)]} />
            <lineBasicMaterial color={LINE} transparent opacity={0.4} />
          </lineSegments>
          <lineSegments position={[0, WROOF_Y + 0.03, 0]}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                array={
                  new Float32Array([
                    -WW / 2, 0, -WD / 2, WW / 2, 0, WD / 2,
                    -WW / 2, 0, WD / 2, WW / 2, 0, -WD / 2,
                  ])
                }
                count={4}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color={ACCENT} transparent opacity={0.35} />
          </lineSegments>
        </group>

        {/* ============ ROOF COVERAGE — the star mechanic ============ */}
        {/* bare steel-deck patches (show until each panel is covered) */}
        <instancedMesh
          ref={deckPanelsRef}
          args={[undefined as unknown as THREE.BufferGeometry, undefined as unknown as THREE.Material, TOTAL]}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={DECK_COL} roughness={0.6} metalness={0.55} />
        </instancedMesh>

        {/* red membrane panels (flood across the roof as you scroll) */}
        <instancedMesh
          ref={wePanelsRef}
          args={[undefined as unknown as THREE.BufferGeometry, undefined as unknown as THREE.Material, TOTAL]}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            ref={membMatRef}
            color={ACCENT}
            emissive={ACCENT}
            emissiveIntensity={0.3}
            roughness={0.5}
            metalness={0.1}
          />
        </instancedMesh>

        {/* glowing install-front line sweeping across the roof */}
        <mesh ref={frontRef} position={[0, WROOF_Y + 0.2, 0]}>
          <boxGeometry args={[0.08, 0.1, WD]} />
          <meshBasicMaterial ref={frontMatRef} color={ACCENT} transparent opacity={0.85} />
        </mesh>

        {/* perimeter edge metal / parapet caps (snap on when sealed) */}
        <group ref={edgeGroupRef} position={[0, WROOF_Y + 0.22, 0]}>
          {[
            { pos: [0, 0, WD / 2], size: [WW, 0.16, 0.1] },
            { pos: [0, 0, -WD / 2], size: [WW, 0.16, 0.1] },
            { pos: [WW / 2, 0, 0], size: [0.1, 0.16, WD] },
            { pos: [-WW / 2, 0, 0], size: [0.1, 0.16, WD] },
          ].map((f, i) => (
            <mesh key={`edge${i}`} position={f.pos as [number, number, number]}>
              <boxGeometry args={f.size as [number, number, number]} />
              <meshStandardMaterial color="#9AA0A6" roughness={0.35} metalness={0.75} />
              <Edges threshold={12} color={LINE} />
            </mesh>
          ))}
        </group>

        {/* rooftop HVAC units, roof hatch, drains (reveal as roof completes) */}
        <group ref={furnitureRef}>
          {[
            [-WW * 0.28, WROOF_Y + 0.42, -WD * 0.14],
            [-WW * 0.05, WROOF_Y + 0.42, WD * 0.16],
            [WW * 0.2, WROOF_Y + 0.42, -WD * 0.1],
            [WW * 0.36, WROOF_Y + 0.42, WD * 0.12],
          ].map((p, i) => (
            <mesh key={`rtu${i}`} position={p as [number, number, number]}>
              <boxGeometry args={[1.4, 0.55, 1.0]} />
              <meshStandardMaterial color="#2b2b32" roughness={0.7} metalness={0.4} />
              <Edges threshold={12} color={LINE} />
            </mesh>
          ))}
          {/* roof hatch */}
          <mesh position={[WW * 0.08, WROOF_Y + 0.32, -WD * 0.28]}>
            <boxGeometry args={[0.7, 0.28, 0.7]} />
            <meshStandardMaterial color="#26262c" roughness={0.7} metalness={0.35} />
            <Edges threshold={12} color={LINE} />
          </mesh>
          {/* roof drains */}
          {[
            [-WW * 0.15, WROOF_Y + 0.2, WD * 0.28],
            [WW * 0.3, WROOF_Y + 0.2, -WD * 0.28],
          ].map((p, i) => (
            <mesh key={`drain${i}`} position={p as [number, number, number]}>
              <cylinderGeometry args={[0.22, 0.22, 0.14, 16]} />
              <meshStandardMaterial color="#1c1c22" roughness={0.8} metalness={0.3} />
              <Edges threshold={12} color={LINE} />
            </mesh>
          ))}
        </group>
      </group>

      {/* lighting tuned to the palette */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[12, 18, 8]} intensity={1.15} color="#fff4f0" />
      <pointLight position={[-16, 6, 8]} intensity={9} distance={48} color={ACCENT} />
      <pointLight
        ref={glowRef}
        position={[0, WROOF_Y + 1.6, 0]}
        intensity={0}
        distance={26}
        color={ACCENT}
      />
      <fog attach="fog" args={[BG, 26, 74]} />
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
      camera={{ position: [26, 21, 26], fov: 34, near: 0.1, far: 150 }}
    >
      <color attach="background" args={[BG]} />
      <BlueprintBuild progressRef={progressRef} reduced={reducedRef.current} />
    </Canvas>
  );
}
