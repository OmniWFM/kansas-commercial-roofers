/* Designed fallback shown while the 3D scroll scene loads, when WebGL is
   unavailable, and for prefers-reduced-motion users. Fixed behind the page in
   the same palette/mood as the live scene: a technical blueprint sketch of a
   LONG low-slope commercial building — structural bay grid, open roof joists,
   loading docks, and the roof assembly labeled layer by layer
   (deck / insulation / red membrane / edge metal). Static — never breaks. */
export default function SceneFallback() {
  const BAYS = 6;
  const bayW = 760 / BAYS; // long elevation width in svg units

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

        {/* long commercial building — elevation blueprint, walls up, roof assembling */}
        <g
          transform="translate(220 300)"
          stroke="#F4F2EE"
          strokeWidth="1.6"
          strokeLinejoin="round"
        >
          {/* wall block (translucent fill), long and low */}
          <rect
            x="0"
            y="140"
            width="760"
            height="200"
            fill="rgba(31,31,35,0.55)"
            stroke="#F4F2EE"
            strokeOpacity="0.85"
          />

          {/* structural column bay lines */}
          {Array.from({ length: BAYS + 1 }).map((_, i) => (
            <line
              key={`col${i}`}
              x1={i * bayW}
              y1="140"
              x2={i * bayW}
              y2="340"
              stroke="#F4F2EE"
              strokeOpacity="0.5"
            />
          ))}

          {/* loading-dock bay openings along the base */}
          {Array.from({ length: 4 }).map((_, i) => (
            <rect
              key={`dock${i}`}
              x={120 + i * 150}
              y="235"
              width="95"
              height="105"
              fill="rgba(14,14,16,0.85)"
              stroke="#F4F2EE"
              strokeOpacity="0.6"
            />
          ))}

          {/* open roof joists spanning the top (construction lines) */}
          {Array.from({ length: 16 }).map((_, i) => (
            <line
              key={`joist${i}`}
              x1={i * (760 / 15)}
              y1="140"
              x2={i * (760 / 15)}
              y2="118"
              stroke="#F4F2EE"
              strokeOpacity="0.45"
            />
          ))}
          {/* top plate / eave line */}
          <line x1="0" y1="118" x2="760" y2="118" stroke="#F4F2EE" strokeOpacity="0.55" />

          {/* roof-plane construction outline (dashed, still open) */}
          <line
            x1="0"
            y1="118"
            x2="760"
            y2="118"
            stroke="#C8262B"
            strokeOpacity="0.4"
            strokeDasharray="6 6"
          />

          {/* red membrane rolling on across the roof (partial) */}
          <rect
            x="0"
            y="102"
            width="440"
            height="16"
            fill="#C8262B"
            fillOpacity="0.5"
            stroke="#C8262B"
            strokeOpacity="0.9"
          />

          {/* parapet / edge-metal cap on the sealed portion */}
          <line x1="0" y1="100" x2="440" y2="100" stroke="#8A8A93" strokeWidth="3" />
        </g>

        {/* layer callouts */}
        <g fontFamily="monospace" fontSize="15" fill="#97979E">
          <line x1="1000" y1="360" x2="900" y2="378" stroke="rgba(255,255,255,0.25)" />
          <text x="1008" y="356">04 — EDGE METAL</text>
          <line x1="1010" y1="408" x2="820" y2="400" stroke="rgba(255,255,255,0.25)" />
          <text x="1018" y="412" fill="#C8262B">03 — RED MEMBRANE</text>
          <line x1="1000" y1="452" x2="760" y2="430" stroke="rgba(255,255,255,0.25)" />
          <text x="1008" y="456">02 — INSULATION</text>
          <line x1="980" y1="500" x2="700" y2="470" stroke="rgba(255,255,255,0.25)" />
          <text x="988" y="504">01 — STEEL DECK</text>
        </g>
      </svg>
    </div>
  );
}
