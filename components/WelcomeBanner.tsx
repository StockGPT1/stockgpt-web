"use client";

import { useEffect, useState } from "react";

const taglines = [
  "Make smarter investment decisions.",
  "500 stocks. Scored. Ranked.",
  "Trade the signal, skip the noise.",
  "AI conviction for every position.",
  "Ranked by data, not by hype.",
  "The model ran. Check the results.",
  "Your edge isn't luck. It's data.",
  "Rankings update as the market does.",
  "Cut through the noise of 500 stocks.",
];

const sublines: Record<number, string> = {
  0: "Markets are closed — use the quiet to review your watchlist.",
  1: "New week, new rankings — see what the model thinks.",
  2: "Tuesday — the quietest tape often has the loudest signal.",
  3: "Midweek — time to re-check the top movers.",
  4: "Thursday — earnings season favourite. Stay sharp.",
  5: "Friday close incoming — review your positions.",
  6: "Weekend mode — catch up on the latest research.",
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getMarketStatus(now: Date) {
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
      ? "Late session"
      : h < 12
        ? "Good morning"
        : h < 17
          ? "Good afternoon"
          : h < 22
            ? "Good evening"
            : "Late session";
  return name ? `${base}, ${name}` : base;
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

  if (!state) {
    // Skeleton — same height as final content to prevent layout shift
    return (
      <div className="min-h-0 rounded-3xl border border-[#ddb159]/25 bg-[linear-gradient(90deg,#082519,#123b25)] px-6 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.16)]">
        <div className="h-3 w-32 rounded bg-[#ddb159]/15" />
        <div className="mt-2 h-7 w-2/3 rounded bg-[#faf6f0]/10" />
        <div className="mt-1.5 h-3 w-1/2 rounded bg-[#faf6f0]/8" />
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
    <div className="relative min-h-0 overflow-hidden rounded-3xl border border-[#ddb159]/25 bg-[linear-gradient(90deg,#082519,#123b25)] px-6 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.16)]">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#ddb159]/8 blur-3xl" />

      {/* Greeting + market pill — tighter line */}
      <div className="flex items-center gap-2.5">
        <p className="font-luxury text-[14px] font-semibold leading-none tracking-[0.01em] text-[#ddb159]">
          {state.greeting}
        </p>
        <span className="flex items-center gap-1.5 rounded-full border border-[#ddb159]/20 bg-[#072116]/60 px-2 py-0.5">
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
          <span className="text-[9px] font-bold text-[#faf6f0]/60">
            {state.market.label}
          </span>
        </span>
      </div>

      {/* Tagline — smaller, fits in the 106px row */}
      <h1 className="luxury-heading mt-1 max-w-[1000px] truncate text-[28px] leading-[1.05] text-[#faf6f0]">
        {state.tagline}
      </h1>

      <p className="mt-1 truncate text-[12px] font-medium text-[#faf6f0]/55">
        {state.subline}
      </p>
    </div>
  );
}
