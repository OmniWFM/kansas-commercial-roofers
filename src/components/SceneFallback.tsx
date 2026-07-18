/* Designed fallback shown while the 3D scroll scene loads, when WebGL is
   unavailable, and for prefers-reduced-motion users. Fixed behind the page in
   the same palette/mood as the live scene: an ISOMETRIC technical sketch of a
   FULL commercial building — a taller office/entry block joined to a long
   low-slope warehouse wing — with the roof CAUGHT MID-COVERAGE: red membrane
   swept across roughly the first half, bare steel deck still open beyond a
   glowing install front. Static — never breaks. */
export default function SceneFallback() {
  const LINE = "#F4F2EE";
  const RED = "#C8262B";

  // Isometric projection helper: map (x, y, z) grid coords to 2D svg points.
  const ISO_X = 24; // horizontal step per x/z unit
  const ISO_Y = 13; // vertical step per x/z unit
  const UNIT_UP = 26; // vertical step per y unit (height)
  const ox = 600;
  const oy = 470;
  const P = (x: number, y: number, z: number) => {
    const px = ox + (x - z) * ISO_X;
    const py = oy + (x + z) * ISO_Y - y * UNIT_UP;
    return `${px.toFixed(1)},${py.toFixed(1)}`;
  };

  // Warehouse wing footprint half-extents (grid units).
  const W = 8; // x half (long axis)
  const D = 4.5; // z half
  const H = 2.4; // wall height (y units)

  // Office block (taller, at the -x / +z corner).
  const oX0 = -W;
  const oX1 = -W + 4.5;
  const oZ0 = D - 4;
  const oZ1 = D;
  const OHt = 4.2;

  // Flat roof quad at height y over the warehouse footprint.
  const roofQuad = (y: number) =>
    `${P(-W, y, -D)} ${P(W, y, -D)} ${P(W, y, D)} ${P(-W, y, D)}`;

  // Coverage front at ~45% across the warehouse length.
  const cov = 0.46;
  const fx = -W + cov * (2 * W);

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
          {/* ---- warehouse footprint ---- */}
          <polygon
            points={`${P(-W, 0, -D)} ${P(W, 0, -D)} ${P(W, 0, D)} ${P(-W, 0, D)}`}
            fill="rgba(31,31,35,0.35)"
            stroke={LINE}
            strokeWidth="1.2"
            strokeOpacity="0.55"
          />

          {/* ---- warehouse vertical wall edges ---- */}
          <g stroke={LINE} strokeWidth="1.6" strokeOpacity="0.85">
            <polyline points={`${P(-W, 0, -D)} ${P(-W, H, -D)}`} />
            <polyline points={`${P(W, 0, -D)} ${P(W, H, -D)}`} />
            <polyline points={`${P(W, 0, D)} ${P(W, H, D)}`} />
            <polyline points={`${P(-W, 0, D)} ${P(-W, H, D)}`} />
            {/* roof plate ring */}
            <polygon points={roofQuad(H)} fill="rgba(31,31,35,0.2)" strokeOpacity="0.7" />
          </g>

          {/* ---- structural bay columns + open joists (visible where roof is open) ---- */}
          <g stroke={LINE} strokeWidth="0.9" strokeOpacity="0.35">
            {Array.from({ length: 6 }).map((_, i) => {
              const x = -W + (i * (2 * W)) / 5;
              return <polyline key={`cx${i}`} points={`${P(x, 0, -D)} ${P(x, H, -D)}`} />;
            })}
            {Array.from({ length: 11 }).map((_, i) => {
              const x = -W + (i * (2 * W)) / 10;
              return <polyline key={`j${i}`} points={`${P(x, H, -D)} ${P(x, H, D)}`} />;
            })}
          </g>

          {/* ---- loading-dock bays on the front wall ---- */}
          <g stroke={LINE} strokeWidth="1" strokeOpacity="0.5">
            {Array.from({ length: 5 }).map((_, i) => {
              const x = -2 + i * 2.2;
              return (
                <polygon
                  key={`dock${i}`}
                  points={`${P(x - 0.7, 0, D)} ${P(x + 0.7, 0, D)} ${P(x + 0.7, 1.4, D)} ${P(
                    x - 0.7,
                    1.4,
                    D
                  )}`}
                  fill="rgba(14,14,16,0.6)"
                />
              );
            })}
          </g>

          {/* ---- OFFICE / ENTRY BLOCK (taller, front-left) ---- */}
          <g stroke={LINE} strokeWidth="1.6" strokeOpacity="0.9">
            <polygon
              points={`${P(oX0, 0, oZ0)} ${P(oX1, 0, oZ0)} ${P(oX1, 0, oZ1)} ${P(oX0, 0, oZ1)}`}
              fill="rgba(34,34,42,0.4)"
            />
            <polyline points={`${P(oX0, 0, oZ1)} ${P(oX0, OHt, oZ1)}`} />
            <polyline points={`${P(oX1, 0, oZ1)} ${P(oX1, OHt, oZ1)}`} />
            <polyline points={`${P(oX1, 0, oZ0)} ${P(oX1, OHt, oZ0)}`} />
            {/* office roof cap */}
            <polygon
              points={`${P(oX0, OHt, oZ0)} ${P(oX1, OHt, oZ0)} ${P(oX1, OHt, oZ1)} ${P(
                oX0,
                OHt,
                oZ1
              )}`}
              fill="rgba(200,38,43,0.4)"
              stroke={RED}
              strokeWidth="1.4"
            />
            {/* curtain-wall mullions on office front face */}
            <g stroke={LINE} strokeWidth="0.7" strokeOpacity="0.5">
              {[1, 2, 3].map((i) => {
                const x = oX0 + ((oX1 - oX0) * i) / 4;
                return <polyline key={`mv${i}`} points={`${P(x, 0, oZ1)} ${P(x, OHt, oZ1)}`} />;
              })}
              {[1, 2, 3].map((i) => {
                const y = (OHt * i) / 4;
                return (
                  <polyline key={`mh${i}`} points={`${P(oX0, y, oZ1)} ${P(oX1, y, oZ1)}`} />
                );
              })}
            </g>
          </g>

          {/* ---- ROOF COVERAGE: red membrane swept across ~first half ---- */}
          <polygon
            points={`${P(-W, H + 0.06, -D)} ${P(fx, H + 0.06, -D)} ${P(fx, H + 0.06, D)} ${P(
              -W,
              H + 0.06,
              D
            )}`}
            fill="rgba(200,38,43,0.55)"
            stroke={RED}
            strokeWidth="1.4"
            strokeOpacity="0.9"
          />
          {/* membrane seam lines */}
          <g stroke={RED} strokeWidth="0.7" strokeOpacity="0.55">
            {Array.from({ length: 4 }).map((_, i) => {
              const x = -W + ((fx - -W) * (i + 1)) / 5;
              return <polyline key={`seam${i}`} points={`${P(x, H + 0.07, -D)} ${P(x, H + 0.07, D)}`} />;
            })}
          </g>

          {/* ---- glowing install front line ---- */}
          <polyline
            points={`${P(fx, H + 0.16, -D)} ${P(fx, H + 0.16, D)}`}
            stroke={RED}
            strokeWidth="3"
            strokeOpacity="0.95"
          />

          {/* ---- bare steel deck beyond the front (open, uncovered) ---- */}
          <g stroke={LINE} strokeWidth="0.7" strokeOpacity="0.3">
            {Array.from({ length: 6 }).map((_, i) => {
              const x = fx + ((W - fx) * (i + 1)) / 7;
              return <polyline key={`deck${i}`} points={`${P(x, H, -D)} ${P(x, H, D)}`} />;
            })}
          </g>
        </g>

        {/* ---- callouts ---- */}
        <g fontFamily="monospace" fontSize="15">
          <line x1="470" y1="250" x2="540" y2="300" stroke="rgba(255,255,255,0.25)" />
          <text x="330" y="246" fill={RED}>
            RED MEMBRANE — INSTALLED
          </text>
          <line x1="760" y1="250" x2="700" y2="300" stroke="rgba(255,255,255,0.25)" />
          <text x="766" y="246" fill="#9AA0A6">
            STEEL DECK — OPEN
          </text>
        </g>
      </svg>
    </div>
  );
}
