/* Designed fallback shown while the 3D scroll scene loads, when WebGL is
   unavailable, and for prefers-reduced-motion users. Fixed behind the page
   in the same palette/mood as the live roofscape: an aerial rect grid with a
   red survey scan gradient. Static — never breaks. */
export default function SceneFallback() {
  const cells = Array.from({ length: 13 * 8 });
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 60% 120%, rgba(200,38,43,0.14), transparent 55%)",
        }}
      />
      <svg
        viewBox="0 0 1200 800"
        className="h-full w-full opacity-60"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <g transform="translate(150 140) scale(1 0.55) rotate(-18 460 300)">
          {cells.map((_, i) => {
            const col = i % 13;
            const row = Math.floor(i / 13);
            const seed = Math.abs(Math.sin(col * 12.9 + row * 4.1));
            const s = 46 + seed * 34;
            const x = col * 80;
            const y = row * 80;
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={s}
                height={s}
                rx={3}
                fill="#1F1F23"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1"
              />
            );
          })}
        </g>
        <rect x="540" y="0" width="120" height="800" fill="url(#kcrScanF)" />
        <line x1="600" y1="0" x2="600" y2="800" stroke="#C8262B" strokeWidth="2" opacity="0.6" />
        <defs>
          <linearGradient id="kcrScanF" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#C8262B" stopOpacity="0" />
            <stop offset="0.5" stopColor="#C8262B" stopOpacity="0.28" />
            <stop offset="1" stopColor="#C8262B" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
