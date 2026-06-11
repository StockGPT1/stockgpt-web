import fs from "node:fs";

const file = "components/PortfolioCommandCentreRevolut.tsx";
let source = fs.readFileSync(file, "utf8");

function replaceAll(search, replacement) {
  if (!source.includes(search)) return;
  source = source.split(search).join(replacement);
}

const mobileLineChart = String.raw`function MobilePortfolioLineChart({ points }: { points: ChartPoint[] }) {
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

  if (!pathD) return <div className="h-[230px] w-full max-w-full" aria-hidden="true" />;

  return (
    <div className="relative h-[270px] w-full max-w-full overflow-hidden sm:hidden">
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

function SectionIcon`;

if (source.includes("function MobilePortfolioLineChart")) {
  source = source.replace(/function MobilePortfolioLineChart\({ points }: \{ points: ChartPoint\[\] \}\) \{[\s\S]*?\n}\n\nfunction SectionIcon/, mobileLineChart);
}

source = source.replace(
  /function PortfolioChartHero\({[\s\S]*?\n}\n\nfunction AddCashPanel/,
  String.raw`function PortfolioChartHero({
  portfolioId,
  portfolios,
  portfolioName,
  currency,
  summary,
  chartData,
  createdAt,
  cashBalance = 0,
}: {
  portfolioId: string;
  portfolios: PortfolioOption[];
  portfolioName: string;
  currency: string;
  summary: ReturnType<typeof buildPortfolioHealthSummary>;
  chartData: Partial<Record<TimeRange, ChartPoint[]>>;
  createdAt?: string | null;
  cashBalance?: number;
}) {
  const router = useRouter();
  const rangeData = useMemo(() => buildRangeData(chartData, createdAt), [chartData, createdAt]);
  const [range, setRange] = useState<TimeRange>(DEFAULT_PORTFOLIO_RANGE);
  const selectedRangeHasData = hasChartPoints(rangeData, range);
  const chartRangeData = selectedRangeHasData
    ? rangeData
    : ({ [range]: [] } as Partial<Record<TimeRange, ChartPoint[]>>);
  const availableRanges = RANGE_LABELS.filter(
    ({ range: itemRange }) => itemRange === DEFAULT_PORTFOLIO_RANGE || hasChartPoints(rangeData, itemRange),
  );
  const validRangeLabel = RANGE_LABELS.find(({ range: itemRange }) => itemRange === range)?.label ?? range;
  const activePoints = chartRangeData[range] ?? [];
  const hasActiveRangePoints = activePoints.length > 1;
  const rangeStart = hasActiveRangePoints ? activePoints[0]!.close : summary.totalValue;
  const rangeEnd = hasActiveRangePoints ? activePoints[activePoints.length - 1]!.close : summary.totalValue;
  const rangeDelta = rangeEnd - rangeStart;
  const rangePct = rangeStart > 0 ? (rangeDelta / rangeStart) * 100 : 0;
  const rangeIsPositive = rangeDelta >= 0;
  const isPositive = summary.totalPnl >= 0;

  function changePortfolio(value: string) {
    if (value === "__new") {
      router.push("/portfolio?builder=1");
      return;
    }
    router.push("/portfolio?portfolio=" + value);
  }

  return (
    <section className="relative left-1/2 -mt-3 w-[100svw] max-w-[100svw] -translate-x-1/2 overflow-hidden rounded-none border-0 bg-[radial-gradient(circle_at_50%_18%,rgba(212,175,55,0.11),transparent_34%),radial-gradient(circle_at_22%_52%,rgba(16,185,129,0.16),transparent_42%),radial-gradient(circle_at_78%_68%,rgba(7,87,55,0.16),transparent_38%),linear-gradient(180deg,rgba(5,42,28,0.62)_0%,rgba(3,31,20,0.38)_42%,rgba(2,19,13,0.05)_100%)] text-[#faf6f0] shadow-none sm:left-auto sm:mt-0 sm:w-auto sm:max-w-none sm:translate-x-0 sm:rounded-[32px] sm:border sm:border-[#ddb159]/18 sm:bg-[#050706] sm:shadow-[0_18px_48px_rgba(0,0,0,0.30)]">
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-[repeating-linear-gradient(135deg,rgba(221,177,89,0.14)_0px,rgba(221,177,89,0.14)_2px,transparent_2px,transparent_9px)] opacity-50 sm:block" />
      <div className="pointer-events-none absolute inset-0 sm:hidden" />

      <div className="relative px-4 pb-0 pt-5 text-center sm:px-6 sm:pb-3 sm:pt-6 lg:text-left">
        <div className="mb-3 flex items-center justify-between sm:hidden">
          <span className="rounded-full border border-[#ddb159]/26 bg-[#061b12]/58 px-3 py-1.5 text-[11px] font-black text-[#ddb159]">
            Health {summary.score}/100
          </span>
          <label className="relative inline-flex h-8 items-center gap-1.5 rounded-full border border-[#ddb159]/24 bg-[#061b12]/72 px-3 text-[11px] font-black text-[#ddb159] backdrop-blur">
            <select
              aria-label="Chart timeframe"
              value={range}
              onChange={(event) => setRange(event.target.value as TimeRange)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            >
              {availableRanges.map(({ range: itemRange, label }) => (
                <option key={itemRange} value={itemRange}>{label}</option>
              ))}
            </select>
            <span>{validRangeLabel}</span>
            <svg viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </label>
        </div>

        <div className="flex items-start justify-center gap-3 text-center sm:justify-between sm:text-left">
          <div className="min-w-0 flex-1">
            <label className="relative mx-auto inline-flex max-w-[92vw] cursor-pointer items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159] sm:hidden">
              <select
                aria-label="Choose portfolio"
                value={portfolioId}
                onChange={(event) => changePortfolio(event.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              >
                {portfolios.map((portfolio) => (
                  <option key={portfolio.id} value={portfolio.id}>{portfolio.name}</option>
                ))}
                <option value="__new">Create new portfolio</option>
              </select>
              <span className="truncate">{portfolioName}</span>
              <svg viewBox="0 0 20 20" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </label>
            <p className="hidden truncate text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159] sm:block">{portfolioName}</p>
            <h1 className="mt-2 text-[40px] font-black leading-none tracking-[-0.065em] sm:mt-1.5 sm:text-[42px] lg:text-[46px]">
              {money(summary.totalValue, currency)}
            </h1>
            <p className="mt-1 text-[12.5px] font-black tabular-nums sm:text-[14px]">
              <span className={isPositive ? "hidden text-emerald-300 sm:inline" : "hidden text-red-200 sm:inline"}>
                {money(summary.totalPnl, currency)} total return · {pct(summary.totalPnlPct)}
              </span>
              <span className={rangeIsPositive ? "text-emerald-300 sm:hidden" : "text-red-200 sm:hidden"}>
                {money(rangeDelta, currency)} {validRangeLabel} · {pct(rangePct)}
              </span>
            </p>
          </div>
          <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
            <span className="rounded-full bg-[#ddb159] px-3 py-1 text-[10.5px] font-black text-[#072116]">
              Health {summary.score}/100
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
              {summary.label}
            </span>
          </div>
        </div>

        <div className="mt-2 hidden items-center justify-between gap-3 sm:flex">
          <p className="hidden text-[10.5px] font-semibold text-[#faf6f0]/46 sm:block">
            Since {formatDate(createdAt)} · contribution-adjusted portfolio performance
          </p>
          <div className="hidden shrink-0 items-center gap-1 rounded-full bg-white/[0.07] p-1 sm:flex">
            {availableRanges.map(({ range: itemRange, label }) => (
              <button
                key={itemRange}
                type="button"
                onClick={() => setRange(itemRange)}
                className={[
                  "h-7 rounded-full px-2.5 text-[9.5px] font-black transition",
                  range === itemRange
                    ? "bg-[#faf6f0] text-[#072116]"
                    : "text-[#faf6f0]/52 hover:text-[#faf6f0]",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative mt-1 sm:mx-0">
        <MobilePortfolioLineChart points={chartRangeData[range] ?? []} />
        <div className="hidden sm:block">
          <StockChart
            key={`${range}-${selectedRangeHasData ? "ready" : "pending"}`}
            ticker="Portfolio"
            data={chartRangeData}
            initialRange={range}
            height={190}
            compact
          />
        </div>
      </div>

      <div className="relative hidden grid-cols-3 gap-px border-t border-white/8 bg-white/5 text-center sm:grid sm:text-left">
        <div className="px-4 py-2">
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/38">Open positions</p>
          <p className="mt-0.5 text-[15px] font-black">{summary.holdingsCount}</p>
        </div>
        <div className="px-4 py-2">
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/38">Weighted score</p>
          <p className="mt-0.5 text-[15px] font-black text-[#ddb159]">{summary.weightedAvgScore ?? "—"}</p>
        </div>
        <div className="px-4 py-2">
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#faf6f0]/38">Cash</p>
          <p className="mt-0.5 text-[15px] font-black">{money(cashBalance, currency)}</p>
          <p className="mt-0.5 text-[9px] font-bold text-[#faf6f0]/42">{summary.cashDrag.toFixed(1)}% drag</p>
        </div>
      </div>
    </section>
  );
}

function AddCashPanel`,
);

source = source.replace(
  /function HoldingsRow\({ portfolioId, holding, currency, maxAllocation }: \{ portfolioId: string; holding: ExtendedHolding; currency: string; maxAllocation: number \}\) \{[\s\S]*?\n}\n\nfunction MetricCell/,
  String.raw`function HoldingsRow({ portfolioId, holding, currency, maxAllocation }: { portfolioId: string; holding: ExtendedHolding; currency: string; maxAllocation: number }) {
  const [open, setOpen] = useState(false);
  const isPositive = holding.totalPnLDollars >= 0;
  const widthPct = Math.max(0, Math.min(100, holding.currentAllocationPct));

  return (
    <div className="group relative h-[74px] w-full max-w-full overflow-hidden rounded-[18px] border border-[#072116]/8 bg-[#faf6f0] text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.10)] transition hover:border-[#ddb159]/45 hover:bg-white sm:h-auto sm:rounded-[22px]">
      <div className="absolute inset-y-0 left-0 bg-[#ddb159]/10 transition group-hover:bg-[#ddb159]/16" style={{ width: widthPct + "%" }} />
      <div className="relative grid h-full w-full max-w-full min-w-0 grid-cols-[minmax(98px,1fr)_50px_52px_36px_40px_32px] items-center gap-0.5 px-1.5 py-2 sm:grid-cols-[minmax(340px,1fr)_132px_132px_82px_104px_132px] sm:gap-3 sm:px-4 sm:py-2.5">
        <Link href={"/stock/" + holding.ticker} className="flex min-w-0 items-center gap-1.5 sm:gap-3">
          <StockLogo ticker={holding.ticker} company={holding.company} size={30} />
          <div className="min-w-0">
            <p className="truncate whitespace-nowrap text-[11px] font-black leading-tight tracking-[-0.025em] text-[#072116] sm:text-[15px]">{holding.company ?? holding.ticker}</p>
            <p className="mt-0.5 truncate whitespace-nowrap text-[9px] font-bold text-[#072116]/48 sm:mt-1 sm:text-[11px]">{holding.ticker}</p>
          </div>
        </Link>

        <MetricCell label="Value" value={money(holding.currentValue, currency)} />
        <MetricCell label="P/L" value={money(holding.totalPnLDollars, currency)} sub={pct(holding.pnlPercent)} tone={isPositive ? "positive" : "negative"} />
        <MetricCell label="Alloc." value={holding.currentAllocationPct.toFixed(1) + "%"} />
        <MetricCell label="AI" value={number(holding.score, 0)} tone="gold" />
        <button type="button" onClick={() => setOpen(true)} aria-label={"Manage " + holding.ticker} className="grid size-8 min-w-0 place-items-center rounded-full bg-[#072116] text-[#ddb159] transition hover:brightness-110 sm:h-9 sm:w-full sm:px-4">
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
  String.raw`function MetricCell({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub?: string; tone?: "neutral" | "positive" | "negative" | "gold" }) {
  const valueClass = tone === "positive" ? "text-emerald-700" : tone === "negative" ? "text-red-700" : tone === "gold" ? "text-[#8a641a]" : "text-[#072116]";
  return (
    <div className="min-w-0 text-right">
      <p className="sr-only sm:not-sr-only sm:text-[8px] sm:font-black sm:uppercase sm:tracking-[0.1em] sm:text-[#072116]/36">{label}</p>
      <p className={["truncate text-[10px] font-black tabular-nums leading-tight sm:text-[13px]", valueClass].join(" ")}>{value}</p>
      {sub && <p className={["mt-0.5 truncate text-[8px] font-bold tabular-nums leading-tight sm:text-[10px]", valueClass].join(" ")}>{sub}</p>}
    </div>
  );
}

function HoldingsPanel`,
);

source = source.replace(
  /function HoldingsPanel\({ portfolioId, holdings, currency }: \{ portfolioId: string; holdings: ExtendedHolding\[\]; currency: string \}\) \{[\s\S]*?\n}\n\nfunction ManagePanel/,
  String.raw`function HoldingsPanel({ portfolioId, holdings, currency, showControls = true }: { portfolioId: string; holdings: ExtendedHolding[]; currency: string; showControls?: boolean }) {
  const [filter, setFilter] = useState<HoldingFilter>("all");
  const [sort, setSort] = useState<HoldingSort>("value");
  const filterOptions = [
    { value: "all", label: "All holdings" },
    { value: "action", label: "Action needed" },
    { value: "winners", label: "Winners" },
    { value: "losers", label: "Losers" },
    { value: "oversized", label: "Oversized" },
  ];
  const sortOptions = [
    { value: "value", label: "Highest value" },
    { value: "urgent", label: "Most urgent" },
    { value: "worst", label: "Worst P/L" },
    { value: "best", label: "Best P/L" },
    { value: "rank", label: "Best rank" },
    { value: "ticker", label: "Ticker A-Z" },
  ];
  const filteredHoldings = useMemo(() => {
    let next = [...holdings];
    if (showControls) {
      if (filter === "action") next = next.filter((holding) => holding.actionAlerts.length > 0);
      if (filter === "winners") next = next.filter((holding) => holding.totalPnLDollars > 0);
      if (filter === "losers") next = next.filter((holding) => holding.totalPnLDollars < 0);
      if (filter === "oversized") next = next.filter(isOversized);
    }
    next.sort((a, b) => {
      if (sort === "urgent") return holdingUrgencyScore(b) - holdingUrgencyScore(a);
      if (sort === "value") return b.currentValue - a.currentValue;
      if (sort === "worst") return a.pnlPercent - b.pnlPercent;
      if (sort === "best") return b.pnlPercent - a.pnlPercent;
      if (sort === "rank") return (a.rank ?? 9999) - (b.rank ?? 9999);
      return a.ticker.localeCompare(b.ticker);
    });
    return next;
  }, [filter, holdings, showControls, sort]);
  const maxAllocation = filteredHoldings.reduce((max, holding) => Math.max(max, holding.currentAllocationPct), 0);

  return (
    <section className="grid w-full max-w-full min-w-0 gap-3 overflow-hidden">
      {showControls && (
        <div className="grid w-full max-w-full min-w-0 gap-3 overflow-hidden rounded-2xl border border-white/8 bg-white/[0.045] p-3 text-[#faf6f0] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">Holdings</p>
            <p className="mt-1 max-w-full truncate text-[12px] font-semibold text-[#faf6f0]/45 sm:whitespace-normal">Rows show value, P/L, allocation, AI score and a manage action.</p>
          </div>
          <div className="grid w-full min-w-0 gap-2 sm:flex sm:justify-end">
            <StockGPTSelect value={filter} options={filterOptions} onChange={(value) => setFilter(value as HoldingFilter)} ariaLabel="Filter holdings" className="w-full min-w-0 sm:w-[190px]" buttonClassName="h-10 rounded-full bg-[#faf6f0] !text-[#072116]" />
            <StockGPTSelect value={sort} options={sortOptions} onChange={(value) => setSort(value as HoldingSort)} ariaLabel="Sort holdings" className="w-full min-w-0 sm:w-[190px]" buttonClassName="h-10 rounded-full bg-[#faf6f0] !text-[#072116]" />
          </div>
        </div>
      )}

      {holdings.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#ddb159]/24 bg-[#061b12]/72 p-6 text-center text-[#faf6f0]">
          <p className="text-[24px] font-black tracking-[-0.05em]">No holdings yet.</p>
          <p className="mx-auto mt-2 max-w-xl text-[13px] font-semibold leading-6 text-[#faf6f0]/52">Use Add / Import to add cash, log holdings or import from Trading 212.</p>
        </div>
      ) : filteredHoldings.length === 0 ? (
        <div className="rounded-3xl border border-[#ddb159]/16 bg-[#061b12]/72 p-5 text-[#faf6f0]">
          <p className="text-[16px] font-black">No holdings match this filter.</p>
          <p className="mt-1 text-[12px] font-semibold text-[#faf6f0]/45">Try changing the filter or sort option.</p>
        </div>
      ) : (
        <div className="grid w-full max-w-full min-w-0 gap-2 overflow-hidden">
          <div className="grid grid-cols-[minmax(98px,1fr)_50px_52px_36px_40px_32px] gap-0.5 px-1.5 text-[7px] font-black uppercase tracking-[0.1em] text-[#faf6f0]/44 sm:grid-cols-[minmax(340px,1fr)_132px_132px_82px_104px_132px] sm:gap-3 sm:px-4 sm:text-[9px] sm:tracking-[0.12em]">
            <span className="pl-[37px] sm:pl-[56px]">Asset</span>
            <span className="justify-self-end text-right">Value</span>
            <span className="justify-self-end text-right">P/L</span>
            <span className="justify-self-end text-right">%</span>
            <span className="justify-self-end text-right">AI</span>
            <span className="justify-self-center text-center">Edit</span>
          </div>
          {filteredHoldings.map((holding) => (
            <HoldingsRow key={holding.ticker} portfolioId={portfolioId} holding={holding} currency={currency} maxAllocation={maxAllocation} />
          ))}
        </div>
      )}
    </section>
  );
}

function ManagePanel`,
);

source = source.replace(
  /<PortfolioChartHero\n\s*portfolioName=\{portfolioMeta\.name\}/,
  `<PortfolioChartHero
        portfolioId={portfolioId}
        portfolios={portfolios}
        portfolioName={portfolioMeta.name}`,
);

source = source.replace(
  /<HoldingsPanel portfolioId=\{portfolioId\} holdings=\{holdings\.slice\(0, 6\)\} currency=\{currency\} \/>/,
  `<HoldingsPanel portfolioId={portfolioId} holdings={holdings.slice(0, 6)} currency={currency} showControls={false} />`,
);

fs.writeFileSync(file, source);
