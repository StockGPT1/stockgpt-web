export function DemoMiniChart({
  height = 150,
  gold = false,
}: {
  height?: number;
  gold?: boolean;
}) {
  const colour = gold ? "#ddb159" : "#34d399";

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 800 220"
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
    >
      <defs>
        <linearGradient id={`demo-chart-${gold ? "gold" : "green"}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colour} stopOpacity="0.28" />
          <stop offset="100%" stopColor={colour} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[45, 90, 135, 180].map((y) => (
        <line key={y} x1="0" x2="800" y1={y} y2={y} stroke="#ddb159" strokeOpacity="0.08" />
      ))}
      <path
        d="M0 182 L58 170 L108 176 L166 136 L218 146 L275 112 L326 124 L388 82 L448 96 L505 64 L566 78 L626 45 L690 58 L748 29 L800 38 L800 220 L0 220 Z"
        fill={`url(#demo-chart-${gold ? "gold" : "green"})`}
      />
      <path
        d="M0 182 L58 170 L108 176 L166 136 L218 146 L275 112 L326 124 L388 82 L448 96 L505 64 L566 78 L626 45 L690 58 L748 29 L800 38"
        fill="none"
        stroke={colour}
        strokeWidth="4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
