import fs from "node:fs";

const file = "app/dashboard/page.tsx";
let source = fs.readFileSync(file, "utf8");

function replaceOnce(search, replacement) {
  if (source.includes(search)) {
    source = source.replace(search, replacement);
  }
}

function replaceBetween(start, end, replacement) {
  const startIndex = source.indexOf(start);
  if (startIndex === -1) return;
  const endIndex = source.indexOf(end, startIndex);
  if (endIndex === -1) return;
  source = source.slice(0, startIndex) + replacement + source.slice(endIndex + end.length);
}

if (!source.includes("function formatShortCompany")) {
  replaceOnce(
    `function formatUpdatedTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function cleanPortfolioName`,
    `function formatUpdatedTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortCompany(value: string | null | undefined) {
  const clean = String(value ?? "")
    .replace(/\(Class [A-Z]\)/gi, "")
    .replace(/\bIncorporated\b/gi, "")
    .replace(/\bCorporation\b/gi, "")
    .replace(/\bCorp\.?\b/gi, "")
    .replace(/\bCompany\b/gi, "")
    .replace(/\bCo\.?\b/gi, "")
    .replace(/\bTechnology\b/gi, "Tech.")
    .replace(/\s+/g, " ")
    .replace(/[,\.\s]+$/g, "")
    .trim();

  return clean || "—";
}

function cleanPortfolioName`,
  );
}

replaceOnce(
  `lg:grid-rows-[clamp(118px,17dvh,150px)_clamp(54px,6.6dvh,64px)_minmax(0,1fr)]`,
  `lg:grid-rows-[clamp(118px,17dvh,150px)_clamp(50px,6dvh,58px)_minmax(0,1fr)]`,
);

replaceOnce(
  `className="grid min-h-[112px] grid-cols-2 gap-[1px] overflow-hidden rounded-2xl border border-[#ddb159]/20 bg-[#072116]/10 text-[#072116] ring-1 ring-white/15 sm:min-h-[118px] lg:min-h-0 lg:grid-cols-4"`,
  `className="grid min-h-[96px] grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[#ddb159]/18 bg-[#072116]/5 text-[#072116] ring-1 ring-white/10 sm:min-h-[102px] lg:min-h-0 lg:grid-cols-4"`,
);

replaceOnce(`label="Top Ranked"`, `label="Top Ranked"`);
replaceOnce(
  `sub={rankingsLocked ? "Subscribe to unlock" : topRanked?.company ?? "—"}`,
  `sub={rankingsLocked ? "Subscribe to unlock" : formatShortCompany(topRanked?.company)}`,
);
replaceOnce(`label="Stocks"`, `label="Stocks Scored"`);
replaceOnce(`sub="S&P universe"`, `sub="S&P 500 checked"`);
replaceOnce(`label="Market Bias"`, `label="Bullish"`);
replaceOnce(`main={formatUpdatedTime(topRanked?.updated_at)}`, `main={formatUpdatedTime(topRanked?.updated_at).replace(/^0/, "")}`);

replaceBetween(
  "function StatBlock({",
  "\n\nfunction PortfolioDashboardWidget",
  [
    "function StatBlock({",
    "  icon: _icon,",
    "  label,",
    "  main,",
    "  sub,",
    "}: {",
    "  icon: string;",
    "  label: string;",
    "  main: string;",
    "  sub: string;",
    "}) {",
    "  return (",
    '    <div className="grid h-full min-h-[47px] min-w-0 content-center overflow-hidden bg-[#faf6f0] px-4 py-2 lg:min-h-0 lg:px-[clamp(14px,1.1vw,18px)] lg:py-1.5">',
    '      <div className="grid min-w-0 gap-0.5 overflow-hidden">',
    '        <p className="truncate text-[8px] font-black uppercase leading-none tracking-[0.075em] text-[#072116]/46 sm:text-[8.5px] lg:text-[clamp(7px,0.52vw,8.5px)]">',
    "          {label}",
    "        </p>",
    '        <p className="truncate text-[18px] font-extrabold leading-none tracking-[-0.035em] text-[#072116] sm:text-[19px] lg:text-[clamp(15px,0.98vw,19px)]">',
    "          {main}",
    "        </p>",
    '        <p className="truncate text-[9.5px] font-semibold leading-none text-[#072116]/48 sm:text-[10px] lg:text-[clamp(8px,0.6vw,10px)]">',
    "          {sub}",
    "        </p>",
    "      </div>",
    "    </div>",
    "  );",
    "}",
    "",
    "function PortfolioDashboardWidget",
  ].join("\n"),
);

fs.writeFileSync(file, source);
