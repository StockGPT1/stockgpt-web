import fs from "node:fs";

function write(path, content) {
  fs.writeFileSync(path, content);
}

// Restore ticker tape movement and candle scrollbar thumb.
{
  const path = "app/globals.css";
  let css = fs.readFileSync(path, "utf8");

  if (!css.includes("@keyframes stockTickerScroll")) {
    css += `

@keyframes stockTickerScroll {
  from { transform: translate3d(0, 0, 0); }
  to { transform: translate3d(-33.333%, 0, 0); }
}

.stock-ticker-track {
  animation: stockTickerScroll 42s linear infinite;
  will-change: transform;
}

.stock-ticker-track:hover { animation-play-state: paused; }

@media (prefers-reduced-motion: reduce) {
  .stock-ticker-track { animation-duration: 120s; }
}
`;
  }

  if (!css.includes("--sg-scrollbar-thumb-restored")) {
    css += `

:root { --sg-scrollbar-thumb-restored: 1; }

.sg-candle-scrollbar,
.sg-public-candle-scrollbar,
.sg-landing,
.affiliate-page,
#affiliate-scroll-root {
  scrollbar-color: var(--sg-candle-body) var(--sg-scrollbar-track);
}

.sg-candle-scrollbar::-webkit-scrollbar-thumb,
.sg-candle-scrollbar *::-webkit-scrollbar-thumb,
.sg-public-candle-scrollbar::-webkit-scrollbar-thumb,
.sg-public-candle-scrollbar *::-webkit-scrollbar-thumb,
.sg-landing::-webkit-scrollbar-thumb,
.sg-landing *::-webkit-scrollbar-thumb,
.affiliate-page::-webkit-scrollbar-thumb,
.affiliate-page *::-webkit-scrollbar-thumb,
#affiliate-scroll-root::-webkit-scrollbar-thumb,
#affiliate-scroll-root *::-webkit-scrollbar-thumb {
  min-height: 54px;
  min-width: 54px;
  border: 7px solid var(--sg-scrollbar-track);
  border-radius: 999px;
  background: linear-gradient(to bottom, var(--sg-candle-body-light), var(--sg-candle-body) 48%, var(--sg-candle-body-dark));
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -1px 0 rgba(0,0,0,0.22), 0 0 0 1px rgba(221,177,89,0.22), 0 0 18px rgba(221,177,89,0.18);
}

.sg-candle-scrollbar::-webkit-scrollbar-thumb:hover,
.sg-candle-scrollbar *::-webkit-scrollbar-thumb:hover,
.sg-public-candle-scrollbar::-webkit-scrollbar-thumb:hover,
.sg-public-candle-scrollbar *::-webkit-scrollbar-thumb:hover,
.sg-landing::-webkit-scrollbar-thumb:hover,
.sg-landing *::-webkit-scrollbar-thumb:hover,
.affiliate-page::-webkit-scrollbar-thumb:hover,
.affiliate-page *::-webkit-scrollbar-thumb:hover,
#affiliate-scroll-root::-webkit-scrollbar-thumb:hover,
#affiliate-scroll-root *::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(to bottom, #ffe39a, var(--sg-candle-body-hover) 48%, #a98231);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.34), inset 0 -1px 0 rgba(0,0,0,0.24), 0 0 0 1px rgba(221,177,89,0.35), 0 0 24px rgba(221,177,89,0.28);
}

.sg-candle-scrollbar::-webkit-scrollbar-corner,
.sg-public-candle-scrollbar::-webkit-scrollbar-corner,
.sg-landing::-webkit-scrollbar-corner,
.affiliate-page::-webkit-scrollbar-corner,
#affiliate-scroll-root::-webkit-scrollbar-corner {
  background: var(--sg-scrollbar-track-deep);
}
`;
  }

  write(path, css);
}

// Plain coloured 1D text instead of pill shapes on rankings.
{
  const path = "app/rankings/page.tsx";
  let source = fs.readFileSync(path, "utf8");
  source = source.replace(
    /function DailyMovePill\([\s\S]*?\n}\n\nfunction matchesMoveFilter/,
    `function DailyMovePill({
  changePct,
  className = "text-[10px]",
}: {
  changePct: number | null | undefined;
  className?: string;
}) {
  const valid = Number.isFinite(changePct);
  const value = valid ? Number(changePct) : null;
  const tone = value == null ? "text-[#072116]/35" : value >= 0 ? "text-emerald-700" : "text-red-700";

  return (
    <span
      title="1D price move"
      className={["inline-flex shrink-0 items-center justify-end font-black tabular-nums", className, tone].join(" ")}
    >
      {value == null ? "—" : (value >= 0 ? "+" : "") + value.toFixed(1) + "%"}
    </span>
  );
}

function matchesMoveFilter`,
  );
  write(path, source);
}

// Alert generated timestamps.
{
  const path = "components/NotificationsList.tsx";
  let source = fs.readFileSync(path, "utf8");

  if (!source.includes("function formatAlertTimestamp")) {
    source = source.replace(
      "function severityStyle",
      `function formatAlertTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Generated just now";
  return "Generated " + date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) + " · " + date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function severityStyle`,
    );
  }

  if (!source.includes("formatAlertTimestamp(notification.createdAt)")) {
    source = source.replace(
      `            </Link>
            {notification.company && (`,
      `            </Link>
            <span className="rounded-full border border-[#072116]/10 bg-white/70 px-2 py-0.5 text-[9px] font-black text-[#072116]/48">
              {formatAlertTimestamp(notification.createdAt)}
            </span>
            {notification.company && (`,
    );
  }

  write(path, source);
}
