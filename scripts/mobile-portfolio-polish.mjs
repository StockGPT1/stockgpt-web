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

  const mobileNavCode = `
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

  if (!source.includes("function MobileSectionNav")) {
    source = source.replace("function PortfolioTopBar", `${mobileNavCode}\nfunction PortfolioTopBar`);
  }

  source = replaceAll(
    source,
    'className="flex min-w-0 flex-col gap-2 rounded-2xl border border-white/8 bg-black/18 p-2 backdrop-blur sm:flex-row sm:items-center sm:justify-between"',
    'className="flex min-w-0 justify-end gap-2 border-0 bg-transparent p-0 shadow-none sm:flex-row sm:items-center sm:justify-between sm:rounded-2xl sm:border sm:border-white/8 sm:bg-black/18 sm:p-2 sm:backdrop-blur"',
  );

  source = replaceAll(
    source,
    'className="flex min-w-0 flex-col gap-2 rounded-2xl border border-white/8 bg-black/18 p-2.5 backdrop-blur sm:flex-row sm:items-center sm:justify-between"',
    'className="flex min-w-0 justify-end gap-2 border-0 bg-transparent p-0 shadow-none sm:flex-row sm:items-center sm:justify-between sm:rounded-2xl sm:border sm:border-white/8 sm:bg-black/18 sm:p-2.5 sm:backdrop-blur"',
  );

  source = replaceAll(
    source,
    '<div className="min-w-0 px-1">\n        <p className="truncate text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">Portfolio</p>\n        <p className="mt-0.5 truncate text-[13px] font-black text-[#faf6f0]">{active?.name ?? "Portfolio"}</p>\n      </div>',
    '<div className="hidden min-w-0 px-1 sm:block">\n        <p className="truncate text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">Portfolio</p>\n        <p className="mt-0.5 truncate text-[13px] font-black text-[#faf6f0]">{active?.name ?? "Portfolio"}</p>\n      </div>',
  );

  source = replaceAll(
    source,
    '<div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">',
    '<div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:justify-end">\n        {portfolios.length <= 1 && (\n          <button type="button" className="max-w-[172px] truncate rounded-full border border-[#ddb159]/20 bg-[#061b12]/82 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#ddb159] sm:hidden">\n            {active?.name ?? "Portfolio"}\n          </button>\n        )}',
  );

  source = replaceAll(
    source,
    'className="min-w-[220px] sm:w-[310px]"\n            buttonClassName="h-10 rounded-full bg-[#faf6f0] text-[#072116]"',
    'className="w-[172px] sm:w-[310px]"\n            buttonClassName="h-8 rounded-full bg-[#faf6f0] text-[#072116] sm:h-10"',
  );

  source = replaceAll(
    source,
    'className="inline-flex h-9 items-center justify-center rounded-full bg-[#ddb159] px-4 text-[10.5px] font-black text-[#072116] transition hover:brightness-105"',
    'className="hidden h-9 items-center justify-center rounded-full bg-[#ddb159] px-4 text-[10.5px] font-black text-[#072116] transition hover:brightness-105 sm:inline-flex"',
  );

  source = replaceAll(
    source,
    'className="inline-flex h-10 items-center justify-center rounded-full bg-[#ddb159] px-4 text-[11px] font-black text-[#072116] transition hover:brightness-105"',
    'className="hidden h-10 items-center justify-center rounded-full bg-[#ddb159] px-4 text-[11px] font-black text-[#072116] transition hover:brightness-105 sm:inline-flex"',
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
    'className="relative -mx-3 w-[calc(100%+1.5rem)] overflow-visible rounded-none border-0 bg-transparent text-[#faf6f0] shadow-none sm:mx-0 sm:w-auto sm:overflow-hidden sm:rounded-[28px] sm:border sm:border-[#ddb159]/18 sm:bg-[#050706] sm:shadow-[0_18px_48px_rgba(0,0,0,0.30)]"',
    'className="relative -mx-3 w-[calc(100%+1.5rem)] overflow-hidden rounded-none border-0 bg-[radial-gradient(circle_at_50%_30%,rgba(16,185,129,0.16),rgba(5,28,18,0.42)_44%,rgba(2,16,11,0.02)_78%)] text-[#faf6f0] shadow-none sm:mx-0 sm:w-auto sm:rounded-[28px] sm:border sm:border-[#ddb159]/18 sm:bg-[#050706] sm:shadow-[0_18px_48px_rgba(0,0,0,0.30)]"',
  );

  source = replaceAll(
    source,
    'className="relative -mx-3 w-[calc(100%+1.5rem)] overflow-visible rounded-none border-0 bg-transparent text-[#faf6f0] shadow-none sm:mx-0 sm:w-auto sm:overflow-hidden sm:rounded-[32px] sm:border sm:border-[#ddb159]/18 sm:bg-[#050706] sm:shadow-[0_18px_48px_rgba(0,0,0,0.30)]"',
    'className="relative -mx-3 w-[calc(100%+1.5rem)] overflow-hidden rounded-none border-0 bg-[radial-gradient(circle_at_50%_30%,rgba(16,185,129,0.16),rgba(5,28,18,0.42)_44%,rgba(2,16,11,0.02)_78%)] text-[#faf6f0] shadow-none sm:mx-0 sm:w-auto sm:rounded-[32px] sm:border sm:border-[#ddb159]/18 sm:bg-[#050706] sm:shadow-[0_18px_48px_rgba(0,0,0,0.30)]"',
  );

  source = replaceAll(
    source,
    'className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[repeating-linear-gradient(135deg,rgba(221,177,89,0.14)_0px,rgba(221,177,89,0.14)_2px,transparent_2px,transparent_9px)] opacity-50"',
    'className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-[repeating-linear-gradient(135deg,rgba(221,177,89,0.14)_0px,rgba(221,177,89,0.14)_2px,transparent_2px,transparent_9px)] opacity-50 sm:block"',
  );

  source = replaceAll(
    source,
    'className="relative px-4 pb-1 pt-3 text-center sm:px-5 sm:pt-4 lg:text-left"',
    'className="relative px-4 pb-1 pt-3 text-center sm:px-5 sm:pt-4 lg:text-left"',
  );

  source = replaceAll(
    source,
    '<div className="relative px-4 pb-1 pt-3 text-center sm:px-5 sm:pt-4 lg:text-left">\n        <div className="flex items-start justify-between gap-3">',
    '<div className="relative px-4 pb-1 pt-3 text-center sm:px-5 sm:pt-4 lg:text-left">\n        <div className="mb-2 flex items-center justify-between px-1 sm:hidden">\n          <label className="relative inline-flex h-9 items-center gap-2 rounded-full bg-white/[0.07] px-3 text-[12px] font-black text-[#faf6f0]/82 backdrop-blur">\n            <select\n              aria-label="Chart timeframe"\n              value={validRange}\n              onChange={(event) => setRange(event.target.value as TimeRange)}\n              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"\n            >\n              {availableRanges.map(({ range: itemRange, label }) => (\n                <option key={itemRange} value={itemRange}>\n                  {label}\n                </option>\n              ))}\n            </select>\n            <span>{validRangeLabel}</span>\n            <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">\n              <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />\n            </svg>\n          </label>\n          <span className="rounded-full bg-[#ddb159] px-3 py-1.5 text-[11px] font-black text-[#072116]">\n            Health {summary.score}/100\n          </span>\n        </div>\n        <div className="flex items-start justify-between gap-3">',
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
    'className="flex shrink-0 items-center gap-1 rounded-full bg-white/[0.07] p-1"',
    'className="hidden shrink-0 items-center gap-1 rounded-full bg-white/[0.07] p-1 sm:flex"',
  );

  source = replaceAll(
    source,
    'className="relative -mx-1 sm:mx-0"',
    'className="relative -mx-4 sm:mx-0"',
  );

  source = replaceAll(
    source,
    'className="relative grid grid-cols-3 gap-px border-t border-white/8 bg-white/5 text-center sm:text-left"',
    'className="relative hidden grid-cols-3 gap-px border-t border-white/8 bg-white/5 text-center sm:grid sm:text-left"',
  );

  source = replaceAll(
    source,
    'className="relative hidden grid-cols-3 gap-px border-t border-white/8 bg-white/5 text-center sm:grid sm:text-left"',
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

  source = replaceAll(
    source,
    '          compact\n        />',
    '          compact\n          bareOnMobile\n        />',
  );

  fs.writeFileSync(file, source);
}

patchStockChart();
patchPortfolioPage();
