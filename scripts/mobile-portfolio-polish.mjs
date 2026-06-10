import fs from "node:fs";

function replaceAll(source, search, replacement) {
  return source.includes(search) ? source.split(search).join(replacement) : source;
}

function patchStockChart() {
  const chartFile = "components/StockChart.tsx";
  let chart = fs.readFileSync(chartFile, "utf8");

  chart = replaceAll(
    chart,
    '  color?: string;\n};',
    '  color?: string;\n  bareOnMobile?: boolean;\n};',
  );

  chart = replaceAll(
    chart,
    '  color,\n}: Props) {',
    '  color,\n  bareOnMobile = false,\n}: Props) {',
  );

  chart = replaceAll(
    chart,
    'className="relative overflow-hidden rounded-xl bg-[#072116]/40"',
    'className={[\n          "relative overflow-hidden",\n          bareOnMobile\n            ? "rounded-none bg-transparent sm:rounded-xl sm:bg-[#072116]/40"\n            : "rounded-xl bg-[#072116]/40",\n        ].join(" ")}',
  );

  fs.writeFileSync(chartFile, chart);
}

function patchPortfolioPage() {
  const file = "components/PortfolioCommandCentreRevolut.tsx";
  let source = fs.readFileSync(file, "utf8");

  source = source.replace(
    /function buildRangeData\([\s\S]*?\n}\n\nfunction preferredInitialRange/,
    `function buildRangeData(
  source: Partial<Record<TimeRange, ChartPoint[]>>,
  createdAt?: string | null,
): Partial<Record<TimeRange, ChartPoint[]>> {
  const maxPoints = source.MAX ?? [];
  if (maxPoints.length < 2) return source;

  const createdMs = createdAt ? new Date(createdAt).getTime() : new Date(maxPoints[0].date).getTime();
  const nowMs = Date.now();
  const data: Partial<Record<TimeRange, ChartPoint[]>> = { MAX: maxPoints };

  RANGE_LABELS.forEach(({ range, days }) => {
    if (range === "MAX" || days == null) return;
    const startMs = Math.max(createdMs, nowMs - days * 86_400_000);
    const points = maxPoints.filter((point) => new Date(point.date).getTime() >= startMs);

    if (points.length > 1) {
      data[range] = points;
      return;
    }

    if (range === "1D" && maxPoints.length > 1) {
      data[range] = maxPoints.slice(-2);
    }
  });

  return data;
}

function preferredInitialRange`,
  );

  source = source.replace(
    /function preferredInitialRange\(data: Partial<Record<TimeRange, ChartPoint\[\]>>\) \{[\s\S]*?\n}\n\nfunction SectionButton/,
    `function preferredInitialRange(data: Partial<Record<TimeRange, ChartPoint[]>>) {
  if ((data["1D"]?.length ?? 0) > 1) return "1D" as TimeRange;
  if ((data["1M"]?.length ?? 0) > 1) return "1M" as TimeRange;
  if ((data["6M"]?.length ?? 0) > 1) return "6M" as TimeRange;
  if ((data["1Y"]?.length ?? 0) > 1) return "1Y" as TimeRange;
  return "MAX" as TimeRange;
}

function SectionButton`,
  );

  const mobileHelpers = `
function MobilePortfolioLineChart({ points }: { points: ChartPoint[] }) {
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
      const buffer = (max - min) * 0.12;
      min -= buffer;
      max += buffer;
    }

    const plotH = height - 34;
    const y = (value: number) => 12 + plotH * (1 - (value - min) / (max - min));
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
    return <div className="h-[230px] w-screen" aria-hidden="true" />;
  }

  return (
    <div className="relative left-1/2 h-[270px] w-screen -translate-x-1/2 overflow-visible sm:hidden">
      <svg viewBox="0 0 800 270" preserveAspectRatio="none" className="h-full w-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id="mobilePortfolioGoldLine" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#d4af37" stopOpacity="0.9" />
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

function SectionIcon({ section }: { section: Section }) {
  const common = "size-5";

  if (section === "overview") {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 18V6" />
        <path d="M4 18h16" />
        <path d="m7 15 3.2-4 3 2.5L19 7" />
      </svg>
    );
  }

  if (section === "holdings") {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 7h16" />
        <path d="M4 12h16" />
        <path d="M4 17h16" />
        <path d="M8 5v14" />
      </svg>
    );
  }

  if (section === "add") {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 5v14" />
        <path d="M5 12h14" />
        <path d="M17 4h3v3" />
        <path d="m20 4-5 5" />
      </svg>
    );
  }

  if (section === "news") {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 5h12a2 2 0 0 1 2 2v12H7a2 2 0 0 1-2-2V5Z" />
        <path d="M9 9h6" />
        <path d="M9 13h6" />
        <path d="M9 17h3" />
      </svg>
    );
  }

  if (section === "activity") {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 8v5l3 2" />
        <path d="M21 12a9 9 0 1 1-3-6.7" />
        <path d="M21 4v5h-5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.8 1.8 0 0 0 .36 2l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.8 1.8 0 0 0-2-.36 1.8 1.8 0 0 0-1 1.63V21a2 2 0 1 1-4 0v-.09a1.8 1.8 0 0 0-1-1.63 1.8 1.8 0 0 0-2 .36l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.8 1.8 0 0 0 .36-2 1.8 1.8 0 0 0-1.63-1H3a2 2 0 1 1 0-4h.09a1.8 1.8 0 0 0 1.63-1 1.8 1.8 0 0 0-.36-2l-.06-.06A2 2 0 1 1 7.13 3.9l.06.06a1.8 1.8 0 0 0 2 .36 1.8 1.8 0 0 0 1-1.63V3a2 2 0 1 1 4 0v.09a1.8 1.8 0 0 0 1 1.63 1.8 1.8 0 0 0 2-.36l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.8 1.8 0 0 0-.36 2 1.8 1.8 0 0 0 1.63 1H21a2 2 0 1 1 0 4h-.09a1.8 1.8 0 0 0-1.51 1Z" />
    </svg>
  );
}

function MobileSectionNav({ active, setSection }: { active: Section; setSection: (section: Section) => void }) {
  const items: Array<{ section: Section; label: string }> = [
    { section: "overview", label: "Overview" },
    { section: "holdings", label: "Holdings" },
    { section: "add", label: "Add or import" },
    { section: "news", label: "News" },
    { section: "activity", label: "Activity" },
    { section: "manage", label: "Manage" },
  ];

  return (
    <nav aria-label="Portfolio sections" className="grid grid-cols-6 gap-1 rounded-[24px] border border-white/8 bg-black/16 p-1.5 sm:hidden">
      {items.map((item) => (
        <button
          key={item.section}
          type="button"
          aria-label={item.label}
          title={item.label}
          onClick={() => setSection(item.section)}
          className={[
            "grid h-12 place-items-center rounded-2xl transition",
            active === item.section
              ? "bg-[#ddb159] text-[#072116] shadow-[0_10px_24px_rgba(221,177,89,0.18)]"
              : "bg-white/[0.055] text-[#faf6f0]/58 hover:bg-white/[0.08] hover:text-[#faf6f0]",
          ].join(" ")}
        >
          <SectionIcon section={item.section} />
        </button>
      ))}
    </nav>
  );
}
`;

  if (!source.includes("function MobilePortfolioLineChart")) {
    source = source.replace("function PortfolioTopBar", `${mobileHelpers}\nfunction PortfolioTopBar`);
  }

  source = replaceAll(
    source,
    'className="flex min-w-0 flex-col gap-2 rounded-2xl border border-white/8 bg-black/18 p-2 backdrop-blur sm:flex-row sm:items-center sm:justify-between"',
    'className="hidden min-w-0 gap-2 border-0 bg-transparent p-0 shadow-none sm:flex sm:flex-row sm:items-center sm:justify-between sm:rounded-2xl sm:border sm:border-white/8 sm:bg-black/18 sm:p-2 sm:backdrop-blur"',
  );

  source = replaceAll(
    source,
    'className="flex min-w-0 flex-col gap-2 rounded-2xl border border-white/8 bg-black/18 p-2.5 backdrop-blur sm:flex-row sm:items-center sm:justify-between"',
    'className="hidden min-w-0 gap-2 border-0 bg-transparent p-0 shadow-none sm:flex sm:flex-row sm:items-center sm:justify-between sm:rounded-2xl sm:border sm:border-white/8 sm:bg-black/18 sm:p-2.5 sm:backdrop-blur"',
  );

  source = replaceAll(
    source,
    'className="flex min-w-0 gap-2 overflow-x-auto rounded-2xl border border-white/8 bg-black/18 p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"',
    'className="hidden min-w-0 gap-2 overflow-x-auto rounded-2xl border border-white/8 bg-black/18 p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex"',
  );

  source = replaceAll(
    source,
    'className="flex min-w-0 gap-2 overflow-x-auto rounded-2xl border border-white/8 bg-black/18 p-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"',
    'className="hidden min-w-0 gap-2 overflow-x-auto rounded-2xl border border-white/8 bg-black/18 p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex"',
  );

  source = replaceAll(
    source,
    'const isPositive = summary.totalPnl >= 0;',
    'const isPositive = summary.totalPnl >= 0;\n  const validRangeLabel = RANGE_LABELS.find(({ range: itemRange }) => itemRange === validRange)?.label ?? validRange;',
  );

  source = replaceAll(
    source,
    'className="relative overflow-hidden rounded-[24px] border border-[#ddb159]/18 bg-[#050706] text-[#faf6f0] shadow-[0_18px_48px_rgba(0,0,0,0.30)] sm:rounded-[28px]"',
    'className="relative left-1/2 w-screen -translate-x-1/2 overflow-visible rounded-none border-0 bg-transparent text-[#faf6f0] shadow-none sm:left-auto sm:w-auto sm:translate-x-0 sm:overflow-hidden sm:rounded-[28px] sm:border sm:border-[#ddb159]/18 sm:bg-[#050706] sm:shadow-[0_18px_48px_rgba(0,0,0,0.30)]"',
  );

  source = replaceAll(
    source,
    'className="relative overflow-hidden rounded-[28px] border border-[#ddb159]/18 bg-[#050706] text-[#faf6f0] shadow-[0_18px_48px_rgba(0,0,0,0.30)] sm:rounded-[32px]"',
    'className="relative left-1/2 w-screen -translate-x-1/2 overflow-visible rounded-none border-0 bg-transparent text-[#faf6f0] shadow-none sm:left-auto sm:w-auto sm:translate-x-0 sm:overflow-hidden sm:rounded-[32px] sm:border sm:border-[#ddb159]/18 sm:bg-[#050706] sm:shadow-[0_18px_48px_rgba(0,0,0,0.30)]"',
  );

  source = replaceAll(
    source,
    'className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[repeating-linear-gradient(135deg,rgba(221,177,89,0.14)_0px,rgba(221,177,89,0.14)_2px,transparent_2px,transparent_9px)] opacity-50"',
    'className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-[repeating-linear-gradient(135deg,rgba(221,177,89,0.14)_0px,rgba(221,177,89,0.14)_2px,transparent_2px,transparent_9px)] opacity-50 sm:block"',
  );

  source = replaceAll(
    source,
    'className="relative px-4 pb-1 pt-4 text-center sm:px-5 sm:pt-4 lg:text-left"',
    'className="relative px-5 pb-0 pt-2 text-center sm:px-5 sm:pb-1 sm:pt-4 lg:text-left"',
  );

  source = replaceAll(
    source,
    'className="relative px-5 pb-3 pt-5 text-center sm:px-6 sm:pt-6 lg:text-left"',
    'className="relative px-5 pb-0 pt-2 text-center sm:px-6 sm:pb-3 sm:pt-6 lg:text-left"',
  );

  source = replaceAll(
    source,
    '<div className="relative px-5 pb-0 pt-2 text-center sm:px-5 sm:pb-1 sm:pt-4 lg:text-left">\n        <div className="flex items-start justify-between gap-3">',
    '<div className="relative px-5 pb-0 pt-2 text-center sm:px-5 sm:pb-1 sm:pt-4 lg:text-left">\n        <div className="mb-3 flex items-center justify-between sm:hidden">\n          <span className="rounded-full border border-[#ddb159]/26 bg-[#061b12]/58 px-3 py-1.5 text-[11px] font-black text-[#ddb159]">\n            Health {summary.score}/100\n          </span>\n          <label className="relative inline-flex h-8 items-center gap-1.5 rounded-full border border-[#ddb159]/24 bg-[#061b12]/72 px-3 text-[11px] font-black text-[#ddb159] backdrop-blur">\n            <select\n              aria-label="Chart timeframe"\n              value={validRange}\n              onChange={(event) => setRange(event.target.value as TimeRange)}\n              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"\n            >\n              {availableRanges.map(({ range: itemRange, label }) => (\n                <option key={itemRange} value={itemRange}>\n                  {label}\n                </option>\n              ))}\n            </select>\n            <span>{validRangeLabel}</span>\n            <svg viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">\n              <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />\n            </svg>\n          </label>\n        </div>\n        <div className="flex items-start justify-center gap-3 text-center sm:justify-between sm:text-left">',
  );

  source = replaceAll(
    source,
    '<div className="relative px-5 pb-0 pt-2 text-center sm:px-6 sm:pb-3 sm:pt-6 lg:text-left">\n        <div className="flex items-start justify-between gap-3">',
    '<div className="relative px-5 pb-0 pt-2 text-center sm:px-6 sm:pb-3 sm:pt-6 lg:text-left">\n        <div className="mb-3 flex items-center justify-between sm:hidden">\n          <span className="rounded-full border border-[#ddb159]/26 bg-[#061b12]/58 px-3 py-1.5 text-[11px] font-black text-[#ddb159]">\n            Health {summary.score}/100\n          </span>\n          <label className="relative inline-flex h-8 items-center gap-1.5 rounded-full border border-[#ddb159]/24 bg-[#061b12]/72 px-3 text-[11px] font-black text-[#ddb159] backdrop-blur">\n            <select\n              aria-label="Chart timeframe"\n              value={validRange}\n              onChange={(event) => setRange(event.target.value as TimeRange)}\n              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"\n            >\n              {availableRanges.map(({ range: itemRange, label }) => (\n                <option key={itemRange} value={itemRange}>\n                  {label}\n                </option>\n              ))}\n            </select>\n            <span>{validRangeLabel}</span>\n            <svg viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">\n              <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />\n            </svg>\n          </label>\n        </div>\n        <div className="flex items-start justify-center gap-3 text-center sm:justify-between sm:text-left">',
  );

  source = replaceAll(
    source,
    'className="flex shrink-0 flex-col items-end gap-1"',
    'className="hidden shrink-0 flex-col items-end gap-1 sm:flex"',
  );

  source = replaceAll(
    source,
    'className="flex shrink-0 flex-col items-end gap-2"',
    'className="hidden shrink-0 flex-col items-end gap-2 sm:flex"',
  );

  source = replaceAll(
    source,
    'className="mt-4 flex items-center justify-between gap-3"',
    'className="mt-3 hidden items-center justify-between gap-3 sm:flex"',
  );

  source = replaceAll(
    source,
    'className="mt-2 flex items-center justify-between gap-3"',
    'className="mt-2 hidden items-center justify-between gap-3 sm:flex"',
  );

  source = source.replace(
    /<div className="relative -mx-[^\"]* sm:mx-0">\s*<StockChart[\s\S]*?compact\s*(?:bareOnMobile\s*)?\/>\s*<\/div>/,
    `<div className="relative mt-1 sm:mx-0">
        <MobilePortfolioLineChart points={rangeData[validRange] ?? []} />
        <div className="hidden sm:block">
          <StockChart
            key={validRange}
            ticker="Portfolio"
            data={rangeData}
            initialRange={validRange}
            height={190}
            compact
          />
        </div>
      </div>`,
  );

  source = replaceAll(
    source,
    'className="relative grid grid-cols-3 gap-px border-t border-white/8 bg-white/5 text-center sm:text-left"',
    'className="relative hidden grid-cols-3 gap-px border-t border-white/8 bg-white/5 text-center sm:grid sm:text-left"',
  );

  source = replaceAll(
    source,
    '          cashBalance={portfolioMeta.cashBalance}\n        />\n      )}',
    '          cashBalance={portfolioMeta.cashBalance}\n        />\n      )}\n\n      <MobileSectionNav active={section} setSection={setSection} />',
  );

  source = replaceAll(
    source,
    '          cashBalance={portfolioMeta.cashBalance}\n        />\n      )}\n\n      <MobileSectionNav active={section} setSection={setSection} />\n\n      <MobileSectionNav active={section} setSection={setSection} />',
    '          cashBalance={portfolioMeta.cashBalance}\n        />\n      )}\n\n      <MobileSectionNav active={section} setSection={setSection} />',
  );

  fs.writeFileSync(file, source);
}

patchStockChart();
patchPortfolioPage();
