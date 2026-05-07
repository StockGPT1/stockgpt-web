from pathlib import Path


def patch_dashboard_copy_only():
    path = Path("app/page.tsx")
    text = path.read_text()

    # Keep the requested text removal, but remove the AI motion/polish classes from the previous patch.
    text = text.replace(
        '''                    {rankingsLocked
                      ? "Subscribe to unlock full AI rankings"
                      : "Click any row for full AI analysis"}''',
        '''                    {rankingsLocked
                      ? "Subscribe to unlock full AI rankings"
                      : "Live model output · ranked by StockGPT AI"}''',
    )

    text = text.replace("ai-premium-card ", "")
    text = text.replace("ai-button ", "")
    text = text.replace("ai-float ", "")
    text = text.replace(" hover:shadow-[0_24px_58px_rgba(0,0,0,0.28)]", "")
    text = text.replace(" hover:shadow-[inset_3px_0_0_#ddb159,0_8px_22px_rgba(7,33,22,0.08)]", " hover:shadow-[inset_3px_0_0_#ddb159]")

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


patch_dashboard_copy_only()
patch_saved_portfolio_duplicate_logo()
patch_portfolio_alert_rank_wording()
print("Reverted dashboard AI polish while keeping requested copy/alert fixes.")
