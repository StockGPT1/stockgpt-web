import fs from "node:fs";

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    return source;
  }
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
    source = replaceOnce(
      source,
      'import { buildPortfolioHealthSummary } from "@/lib/portfolio-health";\n',
      'import { buildPortfolioHealthSummary } from "@/lib/portfolio-health";\nimport { buildPortfolioTrimRecommendation } from "@/lib/portfolio-trim-recommendation";\n',
      "trim engine import",
    );
  }

  source = replaceBetween(
    source,
    "function recommendedTrimPercent(holding: ExtendedHolding) {",
    "\n\nfunction SectionButton",
    [
      "function getTrimRecommendation(holding: ExtendedHolding, riskTolerance: string | null) {",
      "  return buildPortfolioTrimRecommendation(holding, riskTolerance);",
      "}",
      "",
      "function SectionButton",
    ].join("\n"),
    "recommended trim function",
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

  const newRecommendedBlock = [
    '          <div className="rounded-2xl border border-[#ddb159]/20 bg-[#ddb159]/10 p-3">',
    '            <div className="flex flex-wrap items-center justify-between gap-2">',
    '              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8a641a]">Recommended action</p>',
    '              <span className="rounded-full bg-white/75 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-[#072116]/60">Risk {trimRecommendation.riskScore}/100</span>',
    '            </div>',
    '            <p className="mt-1 text-[15px] font-black tracking-[-0.02em] text-[#072116]">{trimRecommendation.label}</p>',
    '            <p className="mt-1 text-[12px] font-semibold leading-5 text-[#072116]/65">{trimRecommendation.reason}</p>',
    '            <p className="mt-2 text-[10px] font-bold leading-4 text-[#072116]/45">Formula: exact case % from allocation, AI conviction, alerts/news and P/L. The largest calculated case drives the final %.</p>',
    '            <div className="mt-2 grid gap-1">',
    '              {trimRecommendation.drivers.map((driver) => (',
    '                <div key={driver.name} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-xl bg-white/70 px-2 py-1.5 text-[10px] font-bold text-[#072116]/58">',
    '                  <span className="truncate">{driver.name} · weight {driver.weight}% · {driver.detail}</span>',
    '                  <span className="tabular-nums">{driver.pct.toFixed(1)}%</span>',
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

  source = replaceOnce(source, oldRecommendedBlock, newRecommendedBlock, "recommended action block");

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

  source = replaceOnce(source, oldHoldingActions, newHoldingActions, "holding actions");

  source = replaceOnce(
    source,
    'function HoldingRow({ portfolioId, holding, currency }: { portfolioId: string; holding: ExtendedHolding; currency: string }) {',
    'function HoldingRow({ portfolioId, holding, currency, riskTolerance }: { portfolioId: string; holding: ExtendedHolding; currency: string; riskTolerance: string | null }) {',
    "holding row props",
  );
  source = replaceOnce(
    source,
    '<HoldingActions portfolioId={portfolioId} holding={holding} />',
    '<HoldingActions portfolioId={portfolioId} holding={holding} riskTolerance={riskTolerance} />',
    "holding actions usage",
  );
  source = replaceOnce(
    source,
    '<HoldingRow key={holding.ticker} portfolioId={portfolioId} holding={holding} currency={currency} />',
    '<HoldingRow key={holding.ticker} portfolioId={portfolioId} holding={holding} currency={currency} riskTolerance={portfolioMeta.riskTolerance} />',
    "holding row usage",
  );
  source = replaceOnce(
    source,
    "Review holdings first. Position changes are inside Manage holding to prevent accidental taps.",
    "Trim percentages are formula-derived from allocation, AI conviction, alerts/news and P/L. No default 10% trim is shown.",
    "holdings header copy",
  );

  fs.writeFileSync(file, source);
}

function patchPortfolioAlerts() {
  const file = "lib/portfolio-alerts.ts";
  let source = fs.readFileSync(file, "utf8");
  source = replaceOnce(
    source,
    "      const eventAlerts = buildEventAlerts(ctx);",
    '      const eventAlerts = buildEventAlerts(ctx).filter((alert) => alert.severity === "warning" || alert.severity === "critical");',
    "portfolio event alert filtering",
  );
  fs.writeFileSync(file, source);
}

function patchDashboard() {
  const file = "app/dashboard/page.tsx";
  let source = fs.readFileSync(file, "utf8");

  source = replaceOnce(
    source,
    '                  dailyMove={dailyMoveMap.get(stock.ticker ?? "")?.changePct ?? undefined}\n',
    "",
    "mobile daily move prop",
  );
  source = replaceOnce(
    source,
    '                      <DailyMovePill changePct={dailyMoveMap.get(stock.ticker ?? "")?.changePct} />\n',
    "",
    "desktop daily move pill",
  );
  source = replaceOnce(
    source,
    'function RankingMobileRow({ stock, dailyMove }: { stock: Ranking; dailyMove?: number }) {',
    'function RankingMobileRow({ stock }: { stock: Ranking }) {',
    "mobile row props",
  );
  source = source.replace(
    /\n            <DailyMovePill\n              changePct=\{dailyMove\}\n              className="h-4 min-w-\[38px\] px-1 text-\[7\.5px\]"\n            \/>/,
    "",
  );

  fs.writeFileSync(file, source);
}

patchPortfolioCommandCentre();
patchPortfolioAlerts();
patchDashboard();
