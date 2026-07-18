/* Designed fallback shown while the 3D scroll scene loads, when WebGL is
   unavailable, and for prefers-reduced-motion users. Fixed behind the page in
   the same palette/mood as the live scene: a technical blueprint sketch of a
   commercial building with its roof assembly labeled layer by layer
   (deck / insulation / red membrane / edge metal). Static — never breaks. */
export default function SceneFallback() {
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

        {/* isometric commercial building — walls up, roof assembling */}
        <g
          transform="translate(600 470)"
          stroke="#F4F2EE"
          strokeWidth="1.6"
          strokeLinejoin="round"
        >
          {/* --- wall block (translucent fill) --- */}
          {/* front-left face */}
          <path
            d="M -280 40 L -280 -120 L 0 40 L 0 200 Z"
            fill="rgba(31,31,35,0.55)"
            stroke="#F4F2EE"
            strokeOpacity="0.85"
          />
          {/* front-right face */}
          <path
            d="M 0 40 L 280 -120 L 280 40 L 0 200 Z"
            fill="rgba(24,24,28,0.6)"
            stroke="#F4F2EE"
            strokeOpacity="0.85"
          />

          {/* --- open top: roof outline (construction line) --- */}
          <path
            d="M -280 -120 L 0 -280 L 280 -120 L 0 40 Z"
            fill="rgba(20,20,24,0.5)"
            stroke="#F4F2EE"
            strokeOpacity="0.5"
            strokeDasharray="7 7"
          />
          {/* survey diagonals across the open roof */}
          <line x1="-280" y1="-120" x2="280" y2="-120" stroke="#C8262B" strokeOpacity="0.4" strokeDasharray="5 6" />
          <line x1="0" y1="-280" x2="0" y2="40" stroke="#C8262B" strokeOpacity="0.4" strokeDasharray="5 6" />

          {/* --- red membrane sheet (half rolled on) --- */}
          <path
            d="M -280 -120 L -40 -257 L 120 -166 L -120 -30 Z"
            fill="#C8262B"
            fillOpacity="0.5"
            stroke="#C8262B"
            strokeOpacity="0.9"
          />
        </g>

        {/* layer callouts */}
        <g fontFamily="monospace" fontSize="15" fill="#97979E">
          <line x1="820" y1="250" x2="700" y2="285" stroke="rgba(255,255,255,0.25)" />
          <text x="828" y="246">04 — EDGE METAL</text>
          <line x1="840" y1="300" x2="640" y2="330" stroke="rgba(255,255,255,0.25)" />
          <text x="848" y="304" fill="#C8262B">03 — RED MEMBRANE</text>
          <line x1="820" y1="352" x2="560" y2="378" stroke="rgba(255,255,255,0.25)" />
          <text x="828" y="356">02 — INSULATION</text>
          <line x1="800" y1="404" x2="500" y2="424" stroke="rgba(255,255,255,0.25)" />
          <text x="808" y="408">01 — STEEL DECK</text>
        </g>
      </svg>
    </div>
  );
}
