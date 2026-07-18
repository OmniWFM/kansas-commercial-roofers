/* Designed fallback shown while the 3D scroll scene loads, when WebGL is
   unavailable, and for prefers-reduced-motion users. Fixed behind the page in
   the same palette/mood as the live scene: an ISOMETRIC technical cutaway of a
   commercial building with one roof corner peeled open, and the roof assembly
   drawn as a separated, labeled exploded stack
   (steel deck / insulation / cover board / red membrane / edge metal).
   Static — never breaks. */
export default function SceneFallback() {
  const LINE = "#F4F2EE";
  const RED = "#C8262B";

  // Isometric projection helper: map (x, y, z) grid coords to 2D svg points.
  // 30-degree iso: x goes right+down, z goes left+down, y goes straight up.
  const ISO_X = 26; // horizontal step per x/z unit
  const ISO_Y = 15; // vertical step per x/z unit
  const UNIT_UP = 30; // vertical step per y unit (height)
  const ox = 600;
  const oy = 430;
  const P = (x: number, y: number, z: number) => {
    const px = ox + (x - z) * ISO_X;
    const py = oy + (x + z) * ISO_Y - y * UNIT_UP;
    return `${px.toFixed(1)},${py.toFixed(1)}`;
  };

  // Footprint half-extents (grid units).
  const W = 6; // x half
  const D = 4; // z half
  const H = 2.4; // wall height (y units)

  // A flat quad at height y spanning the footprint (roof plane).
  const roofQuad = (y: number) =>
    `${P(-W, y, -D)} ${P(W, y, -D)} ${P(W, y, D)} ${P(-W, y, D)}`;

  // Exploded roof-layer quads floating above the plane at increasing heights.
  const layer = (y: number) =>
    `${P(-W, y, -D)} ${P(W, y, -D)} ${P(W, y, D)} ${P(-W, y, D)}`;

  return (
    <div className="absolute inset-0" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 55% 115%, rgba(200,38,43,0.14), transparent 55%)",
        }}
      />
      <svg
        viewBox="0 0 1200 800"
        className="h-full w-full opacity-70"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        {/* faint blueprint ground grid */}
        <g stroke="rgba(255,255,255,0.05)" strokeWidth="1">
          {Array.from({ length: 16 }).map((_, i) => (
            <line key={`v${i}`} x1={i * 80} y1="0" x2={i * 80} y2="800" />
          ))}
          {Array.from({ length: 11 }).map((_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 80} x2="1200" y2={i * 80} />
          ))}
        </g>

        <g strokeLinejoin="round" strokeLinecap="round">
          {/* ---- building shell: four vertical wall edges (iso wireframe) ---- */}
          <g stroke={LINE} strokeWidth="1.6" strokeOpacity="0.85">
            <polyline points={`${P(-W, 0, -D)} ${P(-W, H, -D)}`} />
            <polyline points={`${P(W, 0, -D)} ${P(W, H, -D)}`} />
            <polyline points={`${P(W, 0, D)} ${P(W, H, D)}`} />
            <polyline points={`${P(-W, 0, D)} ${P(-W, H, D)}`} />
            {/* base footprint */}
            <polygon
              points={`${P(-W, 0, -D)} ${P(W, 0, -D)} ${P(W, 0, D)} ${P(-W, 0, D)}`}
              fill="rgba(31,31,35,0.35)"
            />
            {/* eave / top plate ring (roof plane, left open) */}
            <polygon
              points={roofQuad(H)}
              fill="rgba(31,31,35,0.25)"
              strokeOpacity="0.7"
            />
          </g>

          {/* ---- structural columns + bay lines (interior) ---- */}
          <g stroke={LINE} strokeWidth="1" strokeOpacity="0.4">
            {Array.from({ length: 5 }).map((_, i) => {
              const x = -W + (i * (2 * W)) / 4;
              return (
                <polyline key={`cx${i}`} points={`${P(x, 0, -D)} ${P(x, H, -D)}`} />
              );
            })}
            {Array.from({ length: 3 }).map((_, i) => {
              const z = -D + (i * (2 * D)) / 2;
              return (
                <polyline key={`cz${i}`} points={`${P(W, 0, z)} ${P(W, H, z)}`} />
              );
            })}
          </g>

          {/* ---- open roof joists spanning the depth (top plane) ---- */}
          <g stroke={LINE} strokeWidth="0.9" strokeOpacity="0.4">
            {Array.from({ length: 9 }).map((_, i) => {
              const x = -W + (i * (2 * W)) / 8;
              return (
                <polyline key={`j${i}`} points={`${P(x, H, -D)} ${P(x, H, D)}`} />
              );
            })}
          </g>

          {/* ---- red survey diagonals across the open roof ---- */}
          <g stroke={RED} strokeWidth="1.2" strokeOpacity="0.4" strokeDasharray="6 6">
            <polyline points={`${P(-W, H, -D)} ${P(W, H, D)}`} />
            <polyline points={`${P(-W, H, D)} ${P(W, H, D === D ? -D : -D)}`} />
          </g>

          {/* ---- EXPLODED ROOF-LAYER STACK floating above the roof plane ---- */}
          {/* 01 steel deck */}
          <polygon points={layer(H + 1.1)} fill="rgba(58,58,66,0.55)" stroke={LINE} strokeWidth="1.3" strokeOpacity="0.85" />
          {/* 02 insulation */}
          <polygon points={layer(H + 2.1)} fill="rgba(110,110,74,0.5)" stroke={LINE} strokeWidth="1.3" strokeOpacity="0.85" />
          {/* 03 cover board */}
          <polygon points={layer(H + 3.0)} fill="rgba(140,140,110,0.5)" stroke={LINE} strokeWidth="1.3" strokeOpacity="0.85" />
          {/* 04 red membrane */}
          <polygon points={layer(H + 3.9)} fill="rgba(200,38,43,0.55)" stroke={RED} strokeWidth="1.6" strokeOpacity="0.95" />
          {/* 05 edge metal cap (thin frame above membrane) */}
          <polygon points={layer(H + 4.5)} fill="none" stroke="#9AA0A6" strokeWidth="2.4" strokeOpacity="0.9" />
        </g>

        {/* ---- layer callouts with leader lines ---- */}
        <g fontFamily="monospace" fontSize="15" fill="#97979E">
          <line x1="720" y1="150" x2="640" y2="168" stroke="rgba(255,255,255,0.25)" />
          <text x="728" y="146" fill="#9AA0A6">05 — EDGE METAL</text>
          <line x1="740" y1="196" x2="650" y2="205" stroke="rgba(255,255,255,0.25)" />
          <text x="748" y="200" fill={RED}>04 — RED MEMBRANE</text>
          <line x1="720" y1="242" x2="640" y2="243" stroke="rgba(255,255,255,0.25)" />
          <text x="728" y="246">03 — COVER BOARD</text>
          <line x1="720" y1="288" x2="640" y2="281" stroke="rgba(255,255,255,0.25)" />
          <text x="728" y="292">02 — INSULATION</text>
          <line x1="720" y1="334" x2="640" y2="319" stroke="rgba(255,255,255,0.25)" />
          <text x="728" y="338">01 — STEEL DECK</text>
        </g>
      </svg>
    </div>
  );
}
