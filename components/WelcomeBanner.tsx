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
h < 5 ? "Late session"
: h < 12 ? "Good morning"
: h < 17 ? "Good afternoon"
: h < 22 ? "Good evening"
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

if (!state) return <div className="min-h-[180px] rounded-3xl bg-[#082519]" />;

const dotColor =
state.market.tone === "open"
? "bg-emerald-400"
: state.market.tone === "pre"
? "bg-[#ddb159]"
: "bg-[#faf6f0]/40";

return ( <div className="relative min-h-[180px] overflow-hidden rounded-3xl border border-[#ddb159]/25 bg-[linear-gradient(120deg,#061f15,#082519_40%,#123b25)] px-6 py-6 shadow-[0_18px_50px_rgba(0,0,0,0.25)]">

```
  {/* Glow */}
  <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(221,177,89,0.25),transparent_35%)]" />

  {/* Grid */}
  <div className="absolute inset-0 opacity-[0.1] [background-image:linear-gradient(#fff1_1px,transparent_1px),linear-gradient(90deg,#fff1_1px,transparent_1px)] [background-size:32px_32px]" />

  {/* Chart graphic */}
  <svg className="absolute right-0 bottom-0 w-[55%] opacity-80" viewBox="0 0 500 200">
    <path d="M10 170 L90 140 L160 150 L240 100 L310 120 L390 60 L490 40"
      stroke="#ddb159" strokeWidth="4" fill="none" />
  </svg>

  <div className="relative z-10 max-w-[600px]">
    <div className="flex items-center gap-2">
      <p className="text-[#ddb159] font-semibold">{state.greeting}</p>
      <span className="flex items-center gap-1 text-xs text-[#faf6f0]/60">
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        {state.market.label}
      </span>
    </div>

    <h1 className="mt-3 text-[36px] font-black text-[#faf6f0] leading-tight">
      {state.tagline}
    </h1>

    <p className="mt-2 text-[#faf6f0]/60 text-sm">
      {state.subline}
    </p>
  </div>
</div>
```

);
}
