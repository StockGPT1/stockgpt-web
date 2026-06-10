import fs from "node:fs";

const file = "app/rankings/page.tsx";
let source = fs.readFileSync(file, "utf8");

const mobileHelpers = String.raw`
function MobileWhyRankIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 17h.01" />
      <path d="M9.7 9.2a2.5 2.5 0 0 1 4.7 1.2c0 1.8-2.4 2.1-2.4 3.6" />
    </svg>
  );
}

function MobileRankingsHeader() {
  return (
    <div className="grid grid-cols-[minmax(112px,1fr)_58px_50px_54px_34px] items-end gap-1 px-2 text-[7px] font-black uppercase tracking-[0.1em] text-[#faf6f0]/44">
      <span className="pl-[64px]">Stock</span>
      <span className="justify-self-end text-right">Price</span>
      <span className="justify-self-end text-right">1D</span>
      <span className="justify-self-end text-right">AI</span>
      <span className="justify-self-center text-center">Why</span>
    </div>
  );
}

function MobileRankingRow({
  stock,
  move,
  dailyMove,
  confidence,
}: {
  stock: Ranking;
  move: ReturnType<typeof getRankMove24h>;
  dailyMove: number | null | undefined;
  confidence: ReturnType<typeof getModelConfidence>;
}) {
  const explanation = buildRankExplanation(stock, move, dailyMove);
  const factors = getFactorExplanations(stock, dailyMove);

  return (
    <details className="group w-full max-w-full overflow-hidden rounded-[18px] border border-[#072116]/8 bg-[#faf6f0] text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.10)]">
      <summary className="grid h-[74px] w-full cursor-pointer list-none grid-cols-[minmax(112px,1fr)_58px_50px_54px_34px] items-center gap-1 px-2 py-2 [&::-webkit-details-marker]:hidden">
        <Link href={"/stock/" + stock.ticker} className="flex min-w-0 items-center gap-1.5">
          <div className="grid size-7 shrink-0 place-items-center rounded-full bg-[#072116] text-[9px] font-black text-[#ddb159]">
            {stock.rank ?? "—"}
          </div>
          <StockLogo ticker={stock.ticker} company={stock.company} size={30} />
          <div className="min-w-0">
            <p className="truncate whitespace-nowrap text-[12px] font-black leading-tight tracking-[-0.025em] text-[#072116]">
              {stock.ticker ?? "—"}
            </p>
            <p className="mt-0.5 truncate whitespace-nowrap text-[9px] font-bold text-[#072116]/48">
              {stock.company ?? "—"}
            </p>
          </div>
        </Link>

        <div className="min-w-0 text-right">
          <p className="truncate text-[10px] font-black tabular-nums leading-tight text-[#072116]">
            {formatPrice(stock.price)}
          </p>
          <span title={move.title} className={["mt-1 inline-flex h-4 max-w-full items-center justify-center rounded-full border px-1 text-[7px] font-black tabular-nums", moveClassName(move.tone)].join(" ")}>{move.label}</span>
        </div>

        <div className="min-w-0 justify-self-end text-right">
          <DailyMovePill changePct={dailyMove} className="h-6 min-w-0 max-w-[48px] px-1.5 text-[8px]" />
        </div>

        <div className="min-w-0 text-right">
          <p className="truncate text-[10px] font-black tabular-nums leading-tight text-[#8a641a]">
            {formatScore(stock.score)}
          </p>
          <span className={[
            "mt-1 inline-flex max-w-full rounded-full border px-1.5 py-0.5 text-[7px] font-black",
            lightConfidenceClassName(confidence.label),
          ].join(" ")}>{confidence.label}</span>
        </div>

        <span className="grid size-8 min-w-0 place-items-center rounded-full bg-[#072116] text-[#ddb159] transition group-open:bg-[#ddb159] group-open:text-[#072116]">
          <MobileWhyRankIcon />
        </span>
      </summary>

      <div className="border-t border-[#072116]/8 bg-white/72 px-3 pb-3 pt-2">
        <p className="text-[11px] font-semibold leading-5 text-[#072116]/68">{explanation.summary}</p>
        <div className="mt-2 grid gap-2">
          {factors.slice(0, 3).map((factor) => (
            <div key={factor.label} className="rounded-xl border border-[#072116]/8 bg-[#072116]/[0.025] p-2">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[8px] font-black uppercase tracking-[0.1em] text-[#072116]/45">{factor.label}</p>
                <span className="shrink-0 rounded-full bg-[#ddb159]/18 px-2 py-0.5 text-[8px] font-black text-[#8a641a]">{factor.value}</span>
              </div>
              <p className="mt-1 text-[10px] font-semibold leading-4 text-[#072116]/58">{factor.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
`;

if (!source.includes("function MobileRankingRow")) {
  source = source.replace("function HiddenFilterValue", `${mobileHelpers}\nfunction HiddenFilterValue`);
}

source = source.replace(
  /<RankingsLock isLocked=\{rankingsLocked\} className="grid min-w-0 max-w-full gap-2 overflow-hidden lg:hidden">[\s\S]*?        <\/RankingsLock>\n\n        <RankingsLock isLocked=\{rankingsLocked\} className="relative hidden/,
  `<RankingsLock isLocked={rankingsLocked} className="grid min-w-0 max-w-full gap-2 overflow-hidden lg:hidden">
          {rankings.length > 0 ? (
            <>
              <MobileRankingsHeader />
              <div className="grid w-full max-w-full min-w-0 gap-2 overflow-hidden">
                {rankings.map((stock) => {
                  const ticker = stock.ticker ?? "";
                  const move = getRankMove24h(stock.rank, snapshotMap.get(ticker));
                  const dailyMove = dailyMoveMap.get(ticker)?.changePct;
                  const confidence = getModelConfidence(stock);

                  return (
                    <MobileRankingRow
                      key={stock.id}
                      stock={stock}
                      move={move}
                      dailyMove={dailyMove}
                      confidence={confidence}
                    />
                  );
                })}
              </div>
            </>
          ) : (
            <div className="rounded-2xl bg-[#faf6f0] px-4 py-10 text-center text-[13px] font-bold text-[#072116]/55">No stocks match those filters.</div>
          )}
        </RankingsLock>

        <RankingsLock isLocked={rankingsLocked} className="relative hidden`,
);

fs.writeFileSync(file, source);
