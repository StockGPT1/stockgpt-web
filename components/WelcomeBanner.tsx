"use client";

import { useEffect, useState } from "react";

const taglines = [
  "Make smarter investment decisions.",
  "500 stocks. Scored. Ranked. Updated.",
  "Trade the signal, skip the noise.",
  "AI-powered conviction for every position.",
  "From thousands of features to one ranked list.",
  "The model ran. The rankings moved. Check them.",
  "Ranked by the algorithm. Decided by you.",
  "Your edge isn't luck. It's data.",
  "Markets move fast. Your rankings moved faster.",
];

const sublines: Record<number, string> = {
  0: "Markets are closed — use the quiet to review your watchlist.",
  1: "New week, new rankings — see what the model thinks.",
  2: "Tuesday — the quietest tape often has the loudest signal.",
  3: "Midweek. Time to re-check the top movers.",
  4: "Thursday — earnings season favourite. Stay sharp.",
  5: "Friday close incoming. Review your positions before the bell.",
  6: "Weekend mode — catch up on the latest research.",
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getMarketStatus(now: Date) {
  // Convert to Eastern Time (NYSE timezone)
  const et = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const day = et.getDay();
  const mins = et.getHours() * 60 + et.getMinutes();

  if (day === 0 || day === 6)
    return { label: "Markets closed", tone: "closed" as const };
  if (mins < 4 * 60) return { label: "Markets closed", tone: "closed" as const };
  if (mins < 9 * 60 + 30)
    return { label: "Pre-market session", tone: "pre" as const };
  if (mins < 16 * 60) return { label: "Markets open", tone: "open" as const };
  if (mins < 20 * 60)
    return { label: "After-hours session", tone: "pre" as const };
  return { label: "Markets closed", tone: "closed" as const };
}

function getGreeting(now: Date, name?: string) {
  const h = now.getHours();
  const base =
    h < 5
      ? "Burning the midnight oil"
      : h < 12
        ? "Good morning"
        : h < 17
          ? "Good afternoon"
          : h < 22
            ? "Good evening"
            : "Late-night session";
  return name ? `${base}, ${name}` : `${base}`;
}

export function WelcomeBanner({ name }: { name?: string }) {
  const [state, setState] = useState<null | {
    greeting: string;
    tagline: string;
    subline: string;
    market: ReturnType<typeof getMarketStatus>;
  }>(null);

  useEffect(() => {
    const now = new Date();
    setState({
      greeting: getGreeting(now, name),
      tagline: pick(taglines),
      subline: sublines[now.getDay()] ?? "",
      market: getMarketStatus(now),
    });
  }, [name]);

  // Skeleton while hydrating (prevents layout shift)
  if (!state) {
    return (
      <div className="min-h-0 rounded-3xl border border-[#ddb159]/25 bg-[linear-gradient(90deg,#082519,#123b25)] px-6 py-4 shadow-[0_12px_30px_rgba(0,0,0,0.16)]">
        <div className="h-4 w-32 rounded bg-[#ddb159]/20" />
        <div className="mt-2 h-9 w-2/3 rounded bg-[#faf6f0]/10" />
        <div className="mt-2 h-3.5 w-1/2 rounded bg-[#faf6f0]/8" />
      </div>
    );
  }

  const dotColor =
    state.market.tone === "open"
      ? "bg-emerald-400"
      : state.market.tone === "pre"
        ? "bg-[#ddb159]"
        : "bg-[#faf6f0]/40";

  return (
    <div className="relative min-h-0 overflow-hidden rounded-3xl border border-[#ddb159]/25 bg-[linear-gradient(90deg,#082519,#123b25)] px-6 py-4 shadow-[0_12px_30px_rgba(0,0,0,0.16)]">
      {/* Subtle glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#ddb159]/8 blur-3xl" />

      {/* Market status + greeting */}
      <div className="flex items-center gap-3">
        <p className="text-[18px] font-semibold leading-none text-[#ddb159]">
          {state.greeting}
        </p>

        <span className="flex items-center gap-1.5 rounded-full border border-[#ddb159]/20 bg-[#072116]/60 px-2.5 py-1">
          <span className="relative flex h-1.5 w-1.5">
            {state.market.tone === "open" && (
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dotColor} opacity-75`}
              />
            )}
            <span
              className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dotColor}`}
            />
          </span>
          <span className="text-[10px] font-bold text-[#faf6f0]/60">
            {state.market.label}
          </span>
        </span>
      </div>

      {/* Tagline */}
      <h1 className="mt-1.5 max-w-[1000px] text-[36px] font-black leading-[0.95] tracking-[-0.045em] text-[#faf6f0]">
        {state.tagline}
      </h1>

      {/* Day-aware subline */}
      <p className="mt-2 truncate text-[14px] font-medium text-[#faf6f0]/62">
        {state.subline}
      </p>
    </div>
  );
}
