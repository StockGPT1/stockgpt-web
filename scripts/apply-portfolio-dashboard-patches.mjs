import fs from "node:fs";

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) return source;
  return source.replace(search, replacement);
}

function replaceBetween(source, start, end, replacement, label) {
  const startIndex = source.indexOf(start);
  if (startIndex === -1) return source;
  const endIndex = source.indexOf(end, startIndex);
  if (endIndex === -1) return source;
  return source.slice(0, startIndex) + replacement + source.slice(endIndex + end.length);
}

function patchPortfolioCommandCentre() {
  const file = "components/PortfolioCommandCentre.tsx";
  let source = fs.readFileSync(file, "utf8");

  if (!source.includes("@/lib/portfolio-trim-recommendation")) {
    source = source.replace(
      /import \{ buildPortfolioHealthSummary \} from "@\/lib\/portfolio-health";\r?\n/,
      'import { buildPortfolioHealthSummary } from "@/lib/portfolio-health";\nimport { buildPortfolioTrimRecommendation } from "@/lib/portfolio-trim-recommendation";\n',
    );
  }

  source = source.replace(
    /function recommendedTrimPercent\(holding: ExtendedHolding\) \{[\s\S]*?\r?\n\r?\nfunction SectionButton/,
    [
      "function getTrimRecommendation(holding: ExtendedHolding, riskTolerance: string | null) {",
      "  return buildPortfolioTrimRecommendation(holding, riskTolerance);",
      "}",
      "",
      "function SectionButton",
    ].join("\n"),
  );

  source = replaceOnce(
    source,
    "function ManageHoldingModal({ portfolioId, holding, recommendedPercent, onClose }: { portfolioId: string; holding: ExtendedHolding; recommendedPercent: number; onClose: () => void }) {",
    "function ManageHoldingModal({ portfolioId, holding, trimRecommendation, onClose }: { portfolioId: string; holding: ExtendedHolding; trimRecommendation: ReturnType<typeof buildPortfolioTrimRecommendation>; onClose: () => void }) {",
    "manage modal props",
  );
  source = replaceOnce(
    source,
    "const [customPercent, setCustomPercent] = useState(String(Math.min(50, recommendedPercent)));",
    "const [customPercent, setCustomPercent] = useState(String(Math.min(50, trimRecommendation.pct ?? 10)));",
    "custom trim default",
  );

  const oldRecommendedBlock = [
    '          <div className="rounded-2xl border border-[#ddb159]/20 bg-[#ddb159]/10 p-3">',
    '            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8a641a]">Recommended action</p>',
    '            <p className="mt-1 text-[13px] font-semibold leading-5 text-[#072116]/65">',
    '              StockGPT suggests reviewing a <span className="font-black text-[#072116]">{recommendedPercent}%</span> trim as a starting point. This is based on allocation versus target, alerts and the current recommendation — adjust it manually below.',
    '            </p>',
    '            <button type="button" disabled={isPending} onClick={() => runTrim(recommendedPercent)} className="mt-3 inline-flex h-10 items-center justify-center rounded-full bg-[#072116] px-4 text-[11px] font-black uppercase tracking-[0.1em] text-[#ddb159] disabled:opacity-50">',
    '              Apply recommended {recommendedPercent}%',
    '            </button>',
    '          </div>',
  ].join("\n");
  void oldRecommendedBlock;

  const newRecommendedBlock = [
    '          <div className="rounded-2xl border border-[#ddb159]/20 bg-[#ddb159]/10 p-3">',
    '            <div className="flex flex-wrap items-center justify-between gap-2">',
    '              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8a641a]">Recommended action</p>',
    '              <span className="rounded-full bg-white/75 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-[#072116]/60">Risk {trimRecommendation.riskScore}/100</span>',
    '            </div>',
    '            <p className="mt-1 text-[15px] font-black tracking-[-0.02em] text-[#072116]">{trimRecommendation.label}</p>',
    '            <p className="mt-1 text-[12px] font-semibold leading-5 text-[#072116]/65">{trimRecommendation.reason}</p>',
    '            <p className="mt-2 text-[10px] font-bold leading-4 text-[#072116]/45">Formula: risk score uses the raw signal strength; trim % only appears when a case crosses the action threshold.</p>',
    '            <div className="mt-2 grid gap-1">',
    '              {trimRecommendation.drivers.map((driver) => (',
    '                <div key={driver.name} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-xl bg-white/70 px-2 py-1.5 text-[10px] font-bold text-[#072116]/58">',
    '                  <span className="truncate">{driver.name} · weight {driver.weight}% · {driver.detail} · trim {driver.pct.toFixed(1)}%</span>',
    '                  <span className="tabular-nums">Risk {driver.riskScore}/100</span>',
    '                </div>',
    '              ))}',
    '            </div>',
    '            {trimRecommendation.pct !== null && (',
    '              <>',
    '                <p className="mt-2 text-[11px] font-semibold leading-5 text-[#072116]/58">Approx: {money(trimRecommendation.estimatedValue ?? 0)} · {number(trimRecommendation.estimatedShares ?? 0, 4)} shares.</p>',
    '                <button type="button" disabled={isPending} onClick={() => runTrim(trimRecommendation.pct ?? 0)} className="mt-3 inline-flex h-10 items-center justify-center rounded-full bg-[#072116] px-4 text-[11px] font-black uppercase tracking-[0.1em] text-[#ddb159] disabled:opacity-50">',
    '                  Apply {trimRecommendation.pct}%',
    '                </button>',
    '              </>',
    '            )}',
    '          </div>',
  ].join("\n");
  source = source.replace(
    /          <div className="rounded-2xl border border-\[#ddb159\]\/20 bg-\[#ddb159\]\/10 p-3">\r?\n\s+<p className="text-\[10px\] font-black uppercase tracking-\[0\.14em\] text-\[#8a641a\]">Recommended action<\/p>[\s\S]*?\r?\n          <\/div>/,
    newRecommendedBlock,
  );

  const oldHoldingActions = [
    'function HoldingActions({ portfolioId, holding }: { portfolioId: string; holding: ExtendedHolding }) {',
    '  const [open, setOpen] = useState(false);',
    '  const recommendedPercent = recommendedTrimPercent(holding);',
    '  return (',
    '    <div className="mt-3 flex flex-wrap items-center gap-2">',
    '      <button type="button" onClick={() => setOpen(true)} className="rounded-full border border-[#072116]/12 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#072116]/62 transition hover:border-[#ddb159]/45 hover:text-[#8a641a]">',
    '        Manage holding',
    '      </button>',
    '      <span className="text-[10px] font-bold text-[#072116]/38">Suggested trim: {recommendedPercent}%</span>',
    '      {open && <ManageHoldingModal portfolioId={portfolioId} holding={holding} recommendedPercent={recommendedPercent} onClose={() => setOpen(false)} />}',
    '    </div>',
    '  );',
    '}',
  ].join("\n");
  void oldHoldingActions;
  const newHoldingActions = [
    'function HoldingActions({ portfolioId, holding, riskTolerance }: { portfolioId: string; holding: ExtendedHolding; riskTolerance: string | null }) {',
    '  const [open, setOpen] = useState(false);',
    '  const trimRecommendation = getTrimRecommendation(holding, riskTolerance);',
    '  const labelClass = trimRecommendation.pct === null ? "text-emerald-700/70" : "text-amber-700";',
    '  return (',
    '    <div className="mt-3 flex flex-wrap items-center gap-2">',
    '      <button type="button" onClick={() => setOpen(true)} className="rounded-full border border-[#072116]/12 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#072116]/62 transition hover:border-[#ddb159]/45 hover:text-[#8a641a]">',
    '        Manage holding',
    '      </button>',
    '      <span className={`text-[10px] font-bold ${labelClass}`}>{trimRecommendation.label}</span>',
    '      {open && <ManageHoldingModal portfolioId={portfolioId} holding={holding} trimRecommendation={trimRecommendation} onClose={() => setOpen(false)} />}',
    '    </div>',
    '  );',
    '}',
  ].join("\n");
  source = source.replace(
    /function HoldingActions\(\{ portfolioId, holding \}: \{ portfolioId: string; holding: ExtendedHolding \}\) \{[\s\S]*?\r?\n\}/,
    newHoldingActions,
  );
  source = replaceOnce(source, 'function HoldingRow({ portfolioId, holding, currency }: { portfolioId: string; holding: ExtendedHolding; currency: string }) {', 'function HoldingRow({ portfolioId, holding, currency, riskTolerance }: { portfolioId: string; holding: ExtendedHolding; currency: string; riskTolerance: string | null }) {', "holding row props");
  source = replaceOnce(source, '<HoldingActions portfolioId={portfolioId} holding={holding} />', '<HoldingActions portfolioId={portfolioId} holding={holding} riskTolerance={riskTolerance} />', "holding actions usage");
  source = replaceOnce(source, '<HoldingRow key={holding.ticker} portfolioId={portfolioId} holding={holding} currency={currency} />', '<HoldingRow key={holding.ticker} portfolioId={portfolioId} holding={holding} currency={currency} riskTolerance={portfolioMeta.riskTolerance} />', "holding row usage");
  source = replaceOnce(source, "Review holdings first. Position changes are inside Manage holding to prevent accidental taps.", "Trim percentages are formula-derived from allocation, AI conviction, alerts/news and P/L. No default 10% trim is shown.", "holdings header copy");
  fs.writeFileSync(file, source);
}

function patchPortfolioAlerts() {
  const file = "lib/portfolio-alerts.ts";
  let source = fs.readFileSync(file, "utf8");
  source = replaceOnce(source, "      const eventAlerts = buildEventAlerts(ctx);", '      const eventAlerts = buildEventAlerts(ctx).filter((alert) => alert.severity === "warning" || alert.severity === "critical");', "portfolio event alert filtering");
  fs.writeFileSync(file, source);
}

function patchDashboard() {
  const file = "app/dashboard/page.tsx";
  let source = fs.readFileSync(file, "utf8");

  source = replaceOnce(source, 'lg:grid-rows-[clamp(118px,17dvh,150px)_clamp(54px,7dvh,62px)_minmax(0,1fr)]', 'lg:grid-rows-[clamp(118px,17dvh,150px)_clamp(54px,6.6dvh,64px)_minmax(0,1fr)]', "stat row height");
  source = replaceOnce(source, 'className="grid grid-cols-2 gap-2 lg:min-h-0 lg:grid-cols-4"', 'className="grid min-h-[112px] grid-cols-2 gap-[1px] overflow-hidden rounded-2xl border border-[#ddb159]/20 bg-[#072116]/10 text-[#072116] ring-1 ring-white/15 sm:min-h-[118px] lg:min-h-0 lg:grid-cols-4"', "stat strip wrapper");

  const oldStatCalls = [
    '              <StatBlock',
    '                icon="♛"',
    '                label="Top Ranked"',
    '                main={rankingsLocked ? "Locked" : topRanked?.ticker ?? "—"}',
    '                sub={rankingsLocked ? "Subscribe to unlock" : topRanked?.company ?? "—"}',
    '              />',
    '              <StatBlock icon="↗︎" label="Bullish %" main={`${bullishPct}%`} sub={sentiment} />',
    '              <StatBlock',
    '                icon="▦"',
    '                label="Total"',
    '                main={(totalCount ?? rankings.length).toLocaleString()}',
    '                sub="stocks ranked"',
    '              />',
    '              <StatBlock',
    '                icon="◷"',
    '                label="Updated"',
    '                main={formatUpdatedTime(topRanked?.updated_at)}',
    '                sub="latest model run"',
    '              />',
  ].join("\n");
  const newStatCalls = [
    '              <StatBlock',
    '                icon="♛"',
    '                label="Top Ranked"',
    '                main={rankingsLocked ? "Locked" : topRanked?.ticker ?? "—"}',
    '                sub={rankingsLocked ? "Subscribe to unlock" : topRanked?.company ?? "—"}',
    '              />',
    '              <StatBlock',
    '                icon="▦"',
    '                label="Stocks"',
    '                main={(totalCount ?? rankings.length).toLocaleString()}',
    '                sub="S&P universe"',
    '              />',
    '              <StatBlock icon="↗︎" label="Market Bias" main={`${bullishPct}%`} sub={sentiment.replace(" market", "")} />',
    '              <StatBlock',
    '                icon="◷"',
    '                label="Updated"',
    '                main={formatUpdatedTime(topRanked?.updated_at)}',
    '                sub="Model run"',
    '              />',
  ].join("\n");
  source = replaceOnce(source, oldStatCalls, newStatCalls, "stat strip order and labels");

  const newStatBlock = [
    'function StatBlock({',
    '  icon: _icon,',
    '  label,',
    '  main,',
    '  sub,',
    '}: {',
    '  icon: string;',
    '  label: string;',
    '  main: string;',
    '  sub: string;',
    '}) {',
    '  return (',
    '    <div className="grid h-full min-h-[56px] min-w-0 content-center overflow-hidden bg-[#faf6f0] px-4 py-2.5 lg:min-h-0 lg:px-[clamp(12px,1vw,16px)] lg:py-2">',
    '      <div className="grid min-w-0 gap-1 overflow-hidden">',
    '        <p className="truncate text-[8.5px] font-black uppercase leading-none tracking-[0.1em] text-[#072116]/48 sm:text-[9px] lg:text-[clamp(7.5px,0.58vw,9px)]">',
    '          {label}',
    '        </p>',
    '        <p className="truncate text-[19px] font-black leading-none tracking-[-0.04em] text-[#072116] sm:text-[20px] lg:text-[clamp(16px,1.08vw,20px)]">',
    '          {main}',
    '        </p>',
    '        <p className="truncate text-[10px] font-semibold leading-none text-[#072116]/48 sm:text-[10.5px] lg:text-[clamp(8.5px,0.65vw,10.5px)]">',
    '          {sub}',
    '        </p>',
    '      </div>',
    '    </div>',
    '  );',
    '}',
    '',
    'function PortfolioDashboardWidget',
  ].join("\n");
  source = replaceBetween(source, "function StatBlock({", "\n\nfunction PortfolioDashboardWidget", newStatBlock, "compact stat strip component");

  source = source.replace(/\r?\n\s+dailyMove=\{dailyMoveMap\.get\(stock\.ticker \?\? ""\)\?\.changePct \?\? undefined\}/, "");
  source = source.replace(/\r?\n\s+<DailyMovePill changePct=\{dailyMoveMap\.get\(stock\.ticker \?\? ""\)\?\.changePct\} \/>/, "");
  source = replaceOnce(source, 'function RankingMobileRow({ stock, dailyMove }: { stock: Ranking; dailyMove?: number }) {', 'function RankingMobileRow({ stock }: { stock: Ranking }) {', "mobile row props");
  source = source.replace(/\r?\n\s+<DailyMovePill\r?\n\s+changePct=\{dailyMove\}\r?\n\s+className="h-4 min-w-\[38px\] px-1 text-\[7\.5px\]"\r?\n\s+\/>/, "");

  fs.writeFileSync(file, source);
}

patchPortfolioCommandCentre();
patchPortfolioAlerts();
patchDashboard();
