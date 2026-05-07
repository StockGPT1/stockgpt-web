from pathlib import Path


def patch_dashboard_ai_polish():
    path = Path("app/page.tsx")
    text = path.read_text()

    # Remove the dashboard helper line the user disliked.
    text = text.replace(
        '''                    {rankingsLocked
                      ? "Subscribe to unlock full AI rankings"
                      : "Click any row for full AI analysis"}''',
        '''                    {rankingsLocked
                      ? "Subscribe to unlock full AI rankings"
                      : "Live model output · ranked by StockGPT AI"}''',
    )

    # Premium motion/AI polish using utilities from globals.css.
    text = text.replace(
        'className="overflow-hidden rounded-2xl bg-[#faf6f0] text-[#072116] shadow-[0_18px_42px_rgba(0,0,0,0.22)] ring-1 ring-white/20 lg:min-h-0"',
        'className="ai-premium-card overflow-hidden rounded-2xl bg-[#faf6f0] text-[#072116] shadow-[0_18px_42px_rgba(0,0,0,0.22)] ring-1 ring-white/20 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_58px_rgba(0,0,0,0.28)] lg:min-h-0"',
    )

    text = text.replace(
        'className="mt-1 shrink-0 rounded-full px-4 py-2 text-[10px] font-black shadow-[0_6px_16px_rgba(221,177,89,0.26)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(221,177,89,0.34)] hover:brightness-105"',
        'className="ai-button mt-1 shrink-0 rounded-full px-4 py-2 text-[10px] font-black shadow-[0_6px_16px_rgba(221,177,89,0.26)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(221,177,89,0.34)] hover:brightness-105"',
    )

    text = text.replace(
        'className="overflow-hidden rounded-2xl border border-[#ddb159]/20 bg-[#faf6f0]/[0.035] p-3 shadow-[0_12px_30px_rgba(0,0,0,0.16)] backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-[#ddb159]/45 hover:bg-[#faf6f0]/[0.05] lg:min-h-0"',
        'className="ai-premium-card overflow-hidden rounded-2xl border border-[#ddb159]/20 bg-[#faf6f0]/[0.035] p-3 shadow-[0_12px_30px_rgba(0,0,0,0.16)] backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-[#ddb159]/45 hover:bg-[#faf6f0]/[0.05] lg:min-h-0"',
    )

    text = text.replace(
        'className="overflow-hidden rounded-2xl bg-[#faf6f0] p-3 text-[#072116] shadow-[0_10px_26px_rgba(0,0,0,0.2)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(0,0,0,0.24)] lg:flex lg:min-h-0 lg:flex-col"',
        'className="ai-premium-card overflow-hidden rounded-2xl bg-[#faf6f0] p-3 text-[#072116] shadow-[0_10px_26px_rgba(0,0,0,0.2)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(0,0,0,0.24)] lg:flex lg:min-h-0 lg:flex-col"',
    )

    text = text.replace(
        'className="group relative flex min-h-[88px] items-center gap-3 overflow-hidden rounded-2xl border border-[#ddb159]/30 bg-[linear-gradient(135deg,#0d3420,#082519_58%,#061f15)] px-3 py-2.5 shadow-[0_14px_34px_rgba(0,0,0,0.22)] transition duration-300 hover:-translate-y-0.5 hover:border-[#ddb159] hover:shadow-[0_18px_44px_rgba(0,0,0,0.28)] lg:h-full lg:min-h-0"',
        'className="ai-premium-card group relative flex min-h-[88px] items-center gap-3 overflow-hidden rounded-2xl border border-[#ddb159]/30 bg-[linear-gradient(135deg,#0d3420,#082519_58%,#061f15)] px-3 py-2.5 shadow-[0_14px_34px_rgba(0,0,0,0.22)] transition duration-300 hover:-translate-y-0.5 hover:border-[#ddb159] hover:shadow-[0_18px_44px_rgba(0,0,0,0.28)] lg:h-full lg:min-h-0"',
    )

    text = text.replace(
        'className="relative flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#ddb159]/30 bg-[#072116]/80 text-[18px] text-[#ddb159] transition duration-300 group-hover:scale-105"',
        'className="ai-float relative flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#ddb159]/30 bg-[#072116]/80 text-[18px] text-[#ddb159] transition duration-300 group-hover:scale-105"',
    )

    # Upgrade dashboard rows a little without changing layout.
    text = text.replace(
        'hover:bg-[#ddb159]/12 hover:shadow-[inset_3px_0_0_#ddb159]',
        'hover:bg-[#ddb159]/12 hover:shadow-[inset_3px_0_0_#ddb159,0_8px_22px_rgba(7,33,22,0.08)]',
    )

    path.write_text(text)


def patch_saved_portfolio_duplicate_logo():
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


patch_dashboard_ai_polish()
patch_saved_portfolio_duplicate_logo()
patch_portfolio_alert_rank_wording()
print("Applied focused dashboard AI polish and portfolio alert fixes.")
