import fs from "node:fs";

const file = "components/PortfolioCommandCentreRevolut.tsx";
let source = fs.readFileSync(file, "utf8");

function replaceAll(search, replacement) {
  if (!source.includes(search)) return;
  source = source.split(search).join(replacement);
}

source = source.replace(
  /function buildRangeData\([\s\S]*?\n}\n\nfunction preferredInitialRange/,
  `function buildRangeData(
  source: Partial<Record<TimeRange, ChartPoint[]>>,
  createdAt?: string | null,
): Partial<Record<TimeRange, ChartPoint[]>> {
  const maxPoints = source.MAX ?? [];
  const data: Partial<Record<TimeRange, ChartPoint[]>> = { ...source };

  if (maxPoints.length < 2) return data;

  const createdMs = createdAt ? new Date(createdAt).getTime() : new Date(maxPoints[0].date).getTime();
  const nowMs = Date.now();

  RANGE_LABELS.forEach(({ range, days }) => {
    if (range === "MAX" || days == null) return;
    if ((source[range]?.length ?? 0) > 1) return;
    if (range === "1D") return;

    const startMs = Math.max(createdMs, nowMs - days * 86_400_000);
    const points = maxPoints.filter((point) => new Date(point.date).getTime() >= startMs);
    if (points.length > 1) data[range] = points;
  });

  return data;
}

function preferredInitialRange`,
);

source = source.replace(
  /function MobilePortfolioLineChart\({ points }: \{ points: ChartPoint\[\] \}\) \{[\s\S]*?\n}\n\nfunction SectionIcon/,
  `function MobilePortfolioLineChart({ points }: { points: ChartPoint[] }) {
  const height = 270;
  const pathD = useMemo(() => {
    if (points.length < 2) return "";

    const closes = points.map((point) => point.close);
    let min = Math.min(...closes);
    let max = Math.max(...closes);

    if (min === max) {
      min -= 1;
      max += 1;
    } else {
      const buffer = (max - min) * 0.16;
      min -= buffer;
      max += buffer;
    }

    const plotH = height - 34;
    const y = (value: number) => 14 + plotH * (1 - (value - min) / (max - min));
    const xStep = 800 / Math.max(1, points.length - 1);

    return points
      .map((point, index) => {
        const x = index * xStep;
        const command = index === 0 ? "M" : "L";
        return command + " " + x.toFixed(2) + " " + y(point.close).toFixed(2);
      })
      .join(" ");
  }, [points]);

  if (!pathD) {
    return <div className="h-[230px] w-full max-w-full" aria-hidden="true" />;
  }

  return (
    <div className="relative -mx-4 h-[270px] w-[calc(100%+2rem)] max-w-[calc(100%+2rem)] overflow-hidden sm:hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_22%,rgba(212,175,55,0.15),transparent_34%),radial-gradient(circle_at_74%_62%,rgba(16,185,129,0.13),transparent_42%),linear-gradient(180deg,rgba(4,40,26,0.18)_0%,rgba(1,17,11,0.05)_68%,transparent_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#061b12]/28 to-transparent" />
      <svg viewBox="0 0 800 270" preserveAspectRatio="none" className="relative h-full w-full overflow-hidden" aria-hidden="true">
        <defs>
          <linearGradient id="mobilePortfolioGoldLine" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#d4af37" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#f2d77a" stopOpacity="1" />
          </linearGradient>
        </defs>
        <path
          d={pathD}
          fill="none"
          stroke="url(#mobilePortfolioGoldLine)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

function SectionIcon`,
);

source = source.replace(
  /function MobileSectionNav\({ active, setSection }: \{ active: Section; setSection: \(section: Section\) => void \}\) \{[\s\S]*?\n}\n\nfunction PortfolioTopBar/,
  `function MobileSectionNav({ active, setSection }: { active: Section; setSection: (section: Section) => void }) {
  const items: Array<{ section: Section; label: string }> = [
    { section: "overview", label: "Overview" },
    { section: "holdings", label: "Holdings" },
    { section: "add", label: "Add or import" },
    { section: "news", label: "News" },
    { section: "activity", label: "Activity" },
    { section: "manage", label: "Manage" },
  ];

  return (
    <nav
      aria-label="Portfolio sections"
      className="grid w-full max-w-full min-w-0 grid-cols-6 gap-1 overflow-hidden rounded-[22px] border border-white/8 bg-black/16 p-1 sm:hidden"
    >
      {items.map((item) => (
        <button
          key={item.section}
          type="button"
          aria-label={item.label}
          title={item.label}
          onClick={() => setSection(item.section)}
          className={[
            "grid h-11 min-w-0 place-items-center rounded-[15px] transition",
            active === item.section
              ? "bg-[#ddb159] text-[#072116] shadow-[0_10px_24px_rgba(221,177,89,0.16)]"
              : "bg-white/[0.055] text-[#faf6f0]/58 hover:bg-white/[0.08] hover:text-[#faf6f0]",
          ].join(" ")}
        >
          <SectionIcon section={item.section} />
        </button>
      ))}
    </nav>
  );
}

function PortfolioTopBar`,
);

const safeHero = 'className="relative -mx-4 w-[calc(100%+2rem)] max-w-[calc(100%+2rem)] overflow-hidden rounded-none border-0 bg-[radial-gradient(circle_at_52%_14%,rgba(212,175,55,0.10),transparent_34%),radial-gradient(circle_at_18%_62%,rgba(16,185,129,0.14),transparent_42%),linear-gradient(180deg,rgba(5,42,28,0.54)_0%,rgba(2,23,15,0.28)_58%,rgba(2,23,15,0)_100%)] text-[#faf6f0] shadow-none sm:mx-0 sm:w-auto sm:max-w-none sm:rounded-[28px] sm:border sm:border-[#ddb159]/18 sm:bg-[#050706] sm:shadow-[0_18px_48px_rgba(0,0,0,0.30)]"';
source = source.replace(/className="relative left-1\/2 w-screen[^\"]*sm:shadow-\[0_18px_48px_rgba\(0,0,0,0\.30\)\]"/g, safeHero);
source = source.replace(/className="relative -mx-3 w-\[calc\(100%\+1\.5rem\)\][^\"]*sm:shadow-\[0_18px_48px_rgba\(0,0,0,0\.30\)\]"/g, safeHero);

replaceAll('className="relative px-5 pb-0 pt-2 text-center sm:px-5 sm:pb-1 sm:pt-4 lg:text-left"', 'className="relative px-4 pb-0 pt-2 text-center sm:px-5 sm:pb-1 sm:pt-4 lg:text-left"');
replaceAll('className="relative px-5 pb-0 pt-2 text-center sm:px-6 sm:pb-3 sm:pt-6 lg:text-left"', 'className="relative px-4 pb-0 pt-2 text-center sm:px-6 sm:pb-3 sm:pt-6 lg:text-left"');

replaceAll(
  'const isPositive = summary.totalPnl >= 0;\n  const validRangeLabel = RANGE_LABELS.find(({ range: itemRange }) => itemRange === validRange)?.label ?? validRange;',
  'const isPositive = summary.totalPnl >= 0;\n  const validRangeLabel = RANGE_LABELS.find(({ range: itemRange }) => itemRange === validRange)?.label ?? validRange;\n  const activePoints = rangeData[validRange] ?? [];\n  const rangeStart = activePoints[0]?.close ?? summary.totalValue - summary.totalPnl;\n  const rangeEnd = activePoints[activePoints.length - 1]?.close ?? summary.totalValue;\n  const rangeDelta = rangeEnd - rangeStart;\n  const rangePct = rangeStart > 0 ? (rangeDelta / rangeStart) * 100 : 0;\n  const rangeIsPositive = rangeDelta >= 0;',
);

source = source.replace(
  /<p\s+className=\{\[\s*"mt-1 text-\[12\.5px\] font-black tabular-nums sm:text-\[14px\]",\s*isPositive \? "text-emerald-300" : "text-red-200",\s*\]\.join\(" "\)\}\s*>\s*\{money\(summary\.totalPnl, currency\)\} total return · \{pct\(summary\.totalPnlPct\)\}\s*<\/p>/,
  `<p className="mt-1 text-[12.5px] font-black tabular-nums sm:text-[14px]">
              <span className={isPositive ? "hidden text-emerald-300 sm:inline" : "hidden text-red-200 sm:inline"}>
                {money(summary.totalPnl, currency)} total return · {pct(summary.totalPnlPct)}
              </span>
              <span className={rangeIsPositive ? "text-emerald-300 sm:hidden" : "text-red-200 sm:hidden"}>
                {money(rangeDelta, currency)} {validRangeLabel} · {pct(rangePct)}
              </span>
            </p>`,
);

source = source.replace(
  /function HoldingsRow\({ portfolioId, holding, currency, maxAllocation }: \{ portfolioId: string; holding: ExtendedHolding; currency: string; maxAllocation: number \}\) \{[\s\S]*?\n}\n\nfunction MetricCell/,
  `function HoldingsRow({ portfolioId, holding, currency, maxAllocation }: { portfolioId: string; holding: ExtendedHolding; currency: string; maxAllocation: number }) {
  const [open, setOpen] = useState(false);
  const isPositive = holding.totalPnLDollars >= 0;
  const widthPct = Math.max(0, Math.min(100, holding.currentAllocationPct));

  return (
    <div className="group relative w-full max-w-full overflow-hidden rounded-[18px] border border-[#072116]/8 bg-[#faf6f0] text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.10)] transition hover:border-[#ddb159]/45 hover:bg-white sm:rounded-[22px]">
      <div className="absolute inset-y-0 left-0 bg-[#ddb159]/10 transition group-hover:bg-[#ddb159]/16" style={{ width: \`${'${widthPct}%'}\` }} />
      <div className="relative grid w-full max-w-full min-w-0 grid-cols-[minmax(88px,1fr)_58px_58px_42px_46px_34px] items-center gap-1 px-2 py-2 sm:grid-cols-[minmax(340px,1fr)_132px_132px_82px_104px_132px] sm:gap-3 sm:px-4 sm:py-2.5">
        <Link href={\`/stock/${'${holding.ticker}'}\`} className="flex min-w-0 items-center gap-2 sm:gap-3">
          <StockLogo ticker={holding.ticker} company={holding.company} size={34} />
          <div className="min-w-0">
            <p className="truncate text-[12px] font-black leading-tight tracking-[-0.025em] text-[#072116] sm:text-[15px]">{holding.company ?? holding.ticker}</p>
            <p className="mt-0.5 truncate text-[9.5px] font-bold text-[#072116]/48 sm:mt-1 sm:text-[11px]">{holding.ticker}</p>
          </div>
        </Link>

        <MetricCell label="Value" value={money(holding.currentValue, currency)} />
        <MetricCell label="P/L" value={money(holding.totalPnLDollars, currency)} sub={pct(holding.pnlPercent)} tone={isPositive ? "positive" : "negative"} />
        <MetricCell label="Alloc." value={\`${'${holding.currentAllocationPct.toFixed(1)}%'}\`} />
        <MetricCell label="AI" value={number(holding.score, 0)} tone="gold" />
        <button type="button" onClick={() => setOpen(true)} aria-label={\`Manage ${'${holding.ticker}'}\`} className="grid size-9 min-w-0 place-items-center rounded-full bg-[#072116] text-[#ddb159] transition hover:brightness-110 sm:h-9 sm:w-full sm:px-4">
          <svg viewBox="0 0 24 24" className="size-4 sm:hidden" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          <span className="hidden text-[10px] font-black uppercase tracking-[0.08em] sm:inline">Manage</span>
        </button>
      </div>
      {open && <ManageHoldingModal portfolioId={portfolioId} holding={holding} recommendedPercent={recommendedTrimPercent(holding)} onClose={() => setOpen(false)} />}
    </div>
  );
}

function MetricCell`,
);

source = source.replace(
  /function MetricCell\({ label, value, sub, tone = "neutral" }: \{ label: string; value: string; sub\?: string; tone\?: "neutral" \| "positive" \| "negative" \| "gold" \}\) \{[\s\S]*?\n}\n\nfunction HoldingsPanel/,
  `function MetricCell({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub?: string; tone?: "neutral" | "positive" | "negative" | "gold" }) {
  const valueClass = tone === "positive" ? "text-emerald-700" : tone === "negative" ? "text-red-700" : tone === "gold" ? "text-[#8a641a]" : "text-[#072116]";
  return (
    <div className="min-w-0 text-right">
      <p className="sr-only sm:not-sr-only sm:text-[8px] sm:font-black sm:uppercase sm:tracking-[0.1em] sm:text-[#072116]/36">{label}</p>
      <p className={\`truncate text-[11px] font-black tabular-nums leading-tight sm:text-[13px] ${'${valueClass}'}\`}>{value}</p>
      {sub && <p className={\`mt-0.5 truncate text-[8.5px] font-bold tabular-nums leading-tight sm:text-[10px] ${'${valueClass}'}/80\`}>{sub}</p>}
    </div>
  );
}

function HoldingsPanel`,
);

replaceAll(
  'className="grid gap-3"',
  'className="grid w-full max-w-full min-w-0 gap-3 overflow-hidden"',
);
replaceAll(
  'className="grid gap-2"',
  'className="grid w-full max-w-full min-w-0 gap-2 overflow-hidden"',
);
replaceAll(
  'className="grid gap-3 rounded-2xl border border-white/8 bg-white/[0.045] p-3 text-[#faf6f0] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"',
  'className="grid w-full max-w-full min-w-0 gap-3 overflow-hidden rounded-2xl border border-white/8 bg-white/[0.045] p-3 text-[#faf6f0] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"',
);
replaceAll(
  'className="mt-1 text-[12px] font-semibold text-[#faf6f0]/45"',
  'className="mt-1 max-w-full truncate text-[12px] font-semibold text-[#faf6f0]/45 sm:whitespace-normal"',
);
replaceAll(
  'className="grid gap-2 sm:flex sm:justify-end"',
  'className="grid w-full min-w-0 gap-2 sm:flex sm:justify-end"',
);
replaceAll(
  'className="sm:w-[190px]" buttonClassName="h-10 rounded-full bg-[#faf6f0] !text-[#072116]"',
  'className="w-full min-w-0 sm:w-[190px]" buttonClassName="h-10 rounded-full bg-[#faf6f0] !text-[#072116]"',
);
replaceAll(
  'className="sm:w-[190px]" buttonClassName="h-10 rounded-full bg-[#faf6f0] text-[#072116]"',
  'className="w-full min-w-0 sm:w-[190px]" buttonClassName="h-10 rounded-full bg-[#faf6f0] !text-[#072116]"',
);

source = source.replace(
  /<div className="hidden [^\"]*sm:grid">\s*<span[^>]*>Asset<\/span><span[^>]*>Value<\/span><span[^>]*>Net P\/L<\/span><span[^>]*>%<\/span><span[^>]*>AI<\/span><span[^>]*>Action<\/span>\s*<\/div>/,
  `<div className="grid grid-cols-[minmax(88px,1fr)_58px_58px_42px_46px_34px] gap-1 px-2 text-[7px] font-black uppercase tracking-[0.1em] text-[#faf6f0]/44 sm:grid-cols-[minmax(340px,1fr)_132px_132px_82px_104px_132px] sm:gap-3 sm:px-4 sm:text-[9px] sm:tracking-[0.12em]">
            <span className="pl-[42px] sm:pl-[56px]">Asset</span>
            <span className="justify-self-end text-right">Value</span>
            <span className="justify-self-end text-right">P/L</span>
            <span className="justify-self-end text-right">%</span>
            <span className="justify-self-end text-right">AI</span>
            <span className="justify-self-center text-center">Edit</span>
          </div>`,
);

fs.writeFileSync(file, source);
