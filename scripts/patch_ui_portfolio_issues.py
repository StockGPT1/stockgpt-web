from pathlib import Path
import re


def patch_rankings_header_design():
    path = Path("app/rankings/page.tsx")
    text = path.read_text()

    old = '''        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-[26px] font-black tracking-[-0.03em] text-[#faf6f0] sm:text-[28px]">
              Stock Rankings
            </h1>

            <p className="mt-0.5 text-[12px] font-medium text-[#faf6f0]/50 sm:text-[13px]">
              {hasAccess
                ? `${rankings.length} stocks shown · ${allRankings.length} available`
                : "Top 10 preview — sign in for full access"}
            </p>
          </div>

          {!hasAccess && (
            <Link
              href="/pricing"
              style={{ backgroundColor: "#ddb159", color: "#072116" }}
              className="w-fit rounded-full px-4 py-2 text-[12px] font-black transition hover:opacity-90"
            >
              Unlock full rankings
            </Link>
          )}
        </div>

        <form className="grid shrink-0 grid-cols-1 gap-2 rounded-2xl border border-[#ddb159]/18 bg-[#04180f] p-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_170px_140px_auto]">
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Filter by ticker or company..."
            className="h-10 min-w-0 rounded-xl border border-[#ddb159]/18 bg-[#072116] px-3 text-[12px] font-semibold text-[#faf6f0] outline-none placeholder:text-[#faf6f0]/35 focus:border-[#ddb159]/60"
          />

          <select
            name="sector"
            defaultValue={sectorFilter}
            className="h-10 min-w-0 rounded-xl border border-[#ddb159]/18 bg-[#072116] px-3 text-[12px] font-bold text-[#faf6f0] outline-none focus:border-[#ddb159]/60"
          >
            <option value="all">All sectors</option>
            {sectors.map((sector) => (
              <option key={sector} value={sector}>
                {sector}
              </option>
            ))}
          </select>

          <select
            name="move"
            defaultValue={moveFilter}
            className="h-10 min-w-0 rounded-xl border border-[#ddb159]/18 bg-[#072116] px-3 text-[12px] font-bold text-[#faf6f0] outline-none focus:border-[#ddb159]/60"
          >
            <option value="all">All moves</option>
            <option value="up">Moved up</option>
            <option value="down">Moved down</option>
            <option value="flat">No change</option>
            <option value="none">No 24h snapshot</option>
          </select>

          <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-1 lg:flex">
            <button
              type="submit"
              className="h-10 rounded-xl bg-[#ddb159] px-4 text-[12px] font-black text-[#072116] transition hover:brightness-105"
            >
              Filter
            </button>

            <Link
              href="/rankings"
              className="grid h-10 place-items-center rounded-xl border border-[#ddb159]/20 px-4 text-[12px] font-black text-[#ddb159] transition hover:bg-[#ddb159]/10"
            >
              Clear
            </Link>
          </div>
        </form>'''

    new = '''        <section className="relative shrink-0 overflow-hidden rounded-[28px] border border-[#ddb159]/20 bg-[linear-gradient(135deg,rgba(250,246,240,0.075),rgba(250,246,240,0.025)_46%,rgba(221,177,89,0.07))] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.20)] backdrop-blur-xl sm:p-5">
          <div className="pointer-events-none absolute -right-20 -top-24 size-56 rounded-full bg-[#ddb159]/12 blur-3xl" />
          <div className="pointer-events-none absolute -left-16 bottom-0 size-44 rounded-full bg-emerald-400/10 blur-3xl" />

          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#ddb159]/24 bg-[#072116]/45 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <span className="size-1.5 rounded-full bg-[#ddb159] shadow-[0_0_12px_rgba(221,177,89,0.8)]" />
                AI Ranking Engine
              </div>

              <h1 className="text-[30px] font-black leading-none tracking-[-0.055em] text-[#faf6f0] sm:text-[38px]">
                Stock Rankings
              </h1>

              <p className="mt-2 max-w-[560px] text-[13px] font-medium leading-relaxed text-[#faf6f0]/58">
                {hasAccess
                  ? `${rankings.length} stocks shown from ${allRankings.length} ranked names. Filter by ticker, sector, or 24-hour rank movement.`
                  : "Top 10 preview — sign in for full access to the complete AI ranking table."}
              </p>
            </div>

            {!hasAccess && (
              <Link
                href="/pricing"
                className="group relative w-fit overflow-hidden rounded-full bg-[#ddb159] px-5 py-3 text-[12px] font-black text-[#072116] shadow-[0_14px_30px_rgba(221,177,89,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(221,177,89,0.32)]"
              >
                <span className="relative">Unlock full rankings →</span>
              </Link>
            )}
          </div>

          <form className="relative mt-4 grid grid-cols-1 gap-2 rounded-[22px] border border-[#ddb159]/16 bg-[#02150d]/62 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.055),0_14px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl md:grid-cols-2 lg:grid-cols-[minmax(280px,1fr)_190px_170px_auto]">
            <label className="group flex h-12 min-w-0 items-center gap-3 rounded-2xl border border-[#faf6f0]/8 bg-[#faf6f0]/[0.055] px-4 transition focus-within:border-[#ddb159]/70 focus-within:bg-[#faf6f0]/[0.075] focus-within:shadow-[0_0_0_3px_rgba(221,177,89,0.10)]">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#ddb159]/12 text-[13px] text-[#ddb159] transition group-focus-within:bg-[#ddb159] group-focus-within:text-[#072116]">
                ⌕
              </span>
              <input
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="Search ticker or company"
                className="h-full min-w-0 flex-1 bg-transparent text-[14px] font-semibold text-[#faf6f0] outline-none placeholder:text-[#faf6f0]/34"
              />
            </label>

            <label className="relative flex h-12 min-w-0 items-center rounded-2xl border border-[#faf6f0]/8 bg-[#faf6f0]/[0.055] px-3 transition focus-within:border-[#ddb159]/70 focus-within:bg-[#faf6f0]/[0.075] focus-within:shadow-[0_0_0_3px_rgba(221,177,89,0.10)]">
              <span className="pointer-events-none absolute left-4 top-1.5 text-[8px] font-black uppercase tracking-[0.14em] text-[#ddb159]/70">
                Sector
              </span>
              <select
                name="sector"
                defaultValue={sectorFilter}
                className="h-full w-full appearance-none bg-transparent pt-3 text-[13px] font-black text-[#faf6f0] outline-none"
              >
                <option value="all">All sectors</option>
                {sectors.map((sector) => (
                  <option key={sector} value={sector}>
                    {sector}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-4 text-[10px] text-[#ddb159]/70">▾</span>
            </label>

            <label className="relative flex h-12 min-w-0 items-center rounded-2xl border border-[#faf6f0]/8 bg-[#faf6f0]/[0.055] px-3 transition focus-within:border-[#ddb159]/70 focus-within:bg-[#faf6f0]/[0.075] focus-within:shadow-[0_0_0_3px_rgba(221,177,89,0.10)]">
              <span className="pointer-events-none absolute left-4 top-1.5 text-[8px] font-black uppercase tracking-[0.14em] text-[#ddb159]/70">
                24h move
              </span>
              <select
                name="move"
                defaultValue={moveFilter}
                className="h-full w-full appearance-none bg-transparent pt-3 text-[13px] font-black text-[#faf6f0] outline-none"
              >
                <option value="all">All moves</option>
                <option value="up">Moved up</option>
                <option value="down">Moved down</option>
                <option value="flat">No change</option>
                <option value="none">No 24h snapshot</option>
              </select>
              <span className="pointer-events-none absolute right-4 text-[10px] text-[#ddb159]/70">▾</span>
            </label>

            <div className="grid grid-cols-2 gap-2 md:col-span-2 lg:col-span-1 lg:flex">
              <button
                type="submit"
                className="h-12 rounded-2xl bg-[#ddb159] px-5 text-[13px] font-black text-[#072116] shadow-[0_10px_22px_rgba(221,177,89,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(221,177,89,0.30)] hover:brightness-105"
              >
                Apply
              </button>

              <Link
                href="/rankings"
                className="grid h-12 place-items-center rounded-2xl border border-[#faf6f0]/10 bg-[#faf6f0]/[0.035] px-5 text-[13px] font-black text-[#faf6f0]/70 transition hover:border-[#ddb159]/40 hover:bg-[#ddb159]/10 hover:text-[#ddb159]"
              >
                Reset
              </Link>
            </div>
          </form>
        </section>'''

    if old not in text:
        raise SystemExit("Could not find old rankings header/filter block")

    text = text.replace(old, new, 1)
    path.write_text(text)


def patch_dashboard_sp500_daily_change():
    path = Path("app/page.tsx")
    text = path.read_text()

    helper = '''
function getChartChangePct(
  data: Partial<Record<string, Array<{ close: number }>>>,
  range = "1D",
) {
  const points = data[range];
  if (!points || points.length < 2) return null;

  const first = points.find((p) => Number.isFinite(p.close) && p.close > 0)?.close;
  const last = [...points].reverse().find((p) => Number.isFinite(p.close) && p.close > 0)?.close;

  if (!first || !last || first <= 0) return null;

  return ((last - first) / first) * 100;
}
'''

    if "function getChartChangePct" not in text:
        text = text.replace("\nfunction moveClassName", helper + "\nfunction moveClassName", 1)

    if "const sp500DailyChangePct = getChartChangePct(sp500Data, \"1D\");" not in text:
        text = text.replace(
            "  const topGainers = movers.gainers.slice(0, 3);\n",
            "  const sp500DailyChangePct = getChartChangePct(sp500Data, \"1D\");\n  const topGainers = movers.gainers.slice(0, 3);\n",
            1,
        )

    old = '''                <p className="rounded-full border border-[#ddb159]/20 bg-[#072116]/50 px-2 py-1 text-[9px] font-black text-[#ddb159]">
                  1D
                </p>'''
    new = '''                <div className="flex flex-col items-end gap-1">
                  <p className="rounded-full border border-[#ddb159]/20 bg-[#072116]/50 px-2 py-1 text-[9px] font-black text-[#ddb159]">
                    1D
                  </p>
                  {sp500DailyChangePct != null && (
                    <p
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-black tabular-nums ${
                        sp500DailyChangePct >= 0
                          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                          : "border-red-400/30 bg-red-500/10 text-red-300"
                      }`}
                    >
                      {sp500DailyChangePct >= 0 ? "+" : ""}{sp500DailyChangePct.toFixed(2)}%
                    </p>
                  )}
                </div>'''

    if old in text:
        text = text.replace(old, new, 1)

    path.write_text(text)


def patch_saved_portfolio_logos():
    path = Path("components/SavedPortfolio.tsx")
    text = path.read_text()
    clean = '<p className="text-[13px] font-black tracking-[-0.01em]" style={{ color: "#072116" }}>{alert.title}</p>'
    text = text.replace('<div className="flex items-center gap-2"><StockLogo ticker={holding.ticker} company={holding.company} size={18} /><p className="text-[13px] font-black tracking-[-0.01em]" style={{ color: "#072116" }}>{alert.title}</p></div>', clean)
    path.write_text(text)


def patch_portfolio_alert_rank_wording():
    path = Path("lib/portfolio-alerts.ts")
    text = path.read_text()
    text = text.replace("if (p.scorePercentile < 25) {", "if (p.rankPercentile < 25) {")
    text = text.replace("title: `${p.ticker} has a poor AI signal — bottom ${p.scorePercentile}% of stocks`,", "title: `${p.ticker} has a poor AI signal — bottom ${Math.max(1, 100 - p.rankPercentile)}% of stocks`,")
    path.write_text(text)


patch_rankings_header_design()
patch_dashboard_sp500_daily_change()
patch_saved_portfolio_logos()
patch_portfolio_alert_rank_wording()
print("Patched rankings header design, S&P 500 daily move, alerts logos, and rank wording.")
