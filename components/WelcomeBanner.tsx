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
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = et.getDay();
  const mins = et.getHours() * 60 + et.getMinutes();

  if (day === 0 || day === 6) return { label: "Markets closed", tone: "closed" as const };
  if (mins < 4 * 60) return { label: "Markets closed", tone: "closed" as const };
  if (mins < 9 * 60 + 30) return { label: "Pre-market session", tone: "pre" as const };
  if (mins < 16 * 60) return { label: "Markets open", tone: "open" as const };
  if (mins < 20 * 60) return { label: "After-hours session", tone: "pre" as const };
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
    return <div className="min-h-[112px] rounded-3xl bg-[#082519] md:min-h-[124px] xl:min-h-[138px]" />;
  }

  const dotColor =
    state.market.tone === "open"
      ? "bg-emerald-400"
      : state.market.tone === "pre"
        ? "bg-[#ddb159]"
        : "bg-[#faf6f0]/40";

  return (
    <div className="relative min-h-[112px] overflow-hidden rounded-3xl border border-[#ddb159]/25 bg-[linear-gradient(120deg,#061f15,#082519_40%,#123b25)] px-4 py-3 shadow-[0_14px_38px_rgba(0,0,0,0.22)] md:min-h-[124px] md:px-5 md:py-4 xl:min-h-[138px]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_84%_18%,rgba(221,177,89,0.2),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(#fff1_1px,transparent_1px),linear-gradient(90deg,#fff1_1px,transparent_1px)] [background-size:32px_32px]" />

      <svg
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 hidden h-full w-[48%] opacity-70 sm:block"
        viewBox="0 0 500 200"
        fill="none"
      >
        <path
          d="M10 170 L90 140 L160 150 L240 100 L310 120 L390 60 L490 40"
          stroke="#ddb159"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10 170 L90 140 L160 150 L240 100 L310 120 L390 60 L490 40 V200 H10 Z"
          fill="url(#welcomeChartFill)"
        />
        <defs>
          <linearGradient id="welcomeChartFill" x1="250" y1="40" x2="250" y2="200" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ddb159" stopOpacity="0.22" />
            <stop offset="1" stopColor="#ddb159" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      <div className="relative z-10 max-w-[620px]">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-luxury text-[12px] font-semibold leading-tight tracking-[0.01em] text-[#ddb159] md:text-[13px]">
            {state.greeting}
          </p>

          <span className="flex items-center gap-1.5 rounded-full border border-[#ddb159]/20 bg-[#072116]/70 px-2 py-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <span className="relative flex h-1.5 w-1.5">
              {state.market.tone === "open" && (
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dotColor} opacity-75`} />
              )}
              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dotColor}`} />
            </span>
            <span className="text-[9px] font-bold text-[#faf6f0]/70">{state.market.label}</span>
          </span>
        </div>

        <h1 className="mt-2 text-[24px] font-black leading-tight tracking-[-0.04em] text-[#faf6f0] sm:text-[28px] xl:text-[32px]">
          {state.tagline}
        </h1>

        <p className="mt-1 max-w-[540px] text-[11px] font-medium leading-snug text-[#faf6f0]/60 sm:text-xs">
          {state.subline}
        </p>
      </div>
    </div>
  );
}
