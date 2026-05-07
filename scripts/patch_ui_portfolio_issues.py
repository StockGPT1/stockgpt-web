from pathlib import Path
import re


def patch_dashboard_copy_only():
    path = Path("app/page.tsx")
    text = path.read_text()

    # Remove the dashboard helper line entirely if it still exists.
    text = text.replace(
        '''                  <p
                    className="mt-1 truncate text-[11px] font-medium"
                    style={{ color: "rgba(7,33,22,0.52)" }}
                  >
                    {rankingsLocked
                      ? "Subscribe to unlock full AI rankings"
                      : "Live model output · ranked by StockGPT AI"}
                  </p>''',
        "",
    )
    text = text.replace(
        '''                  <p
                    className="mt-1 truncate text-[11px] font-medium"
                    style={{ color: "rgba(7,33,22,0.52)" }}
                  >
                    {rankingsLocked
                      ? "Subscribe to unlock full AI rankings"
                      : "Click any row for full AI analysis"}
                  </p>''',
        "",
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


def patch_price_and_date_alerts():
    path = Path("lib/portfolio-alerts.ts")
    text = path.read_text()

    helper = r'''
function extractTriggerPrice(condition: string) {
  const match = condition.match(/\$([0-9]+(?:\.[0-9]+)?)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function buildTriggerHitAlerts(
  ticker: string,
  currentPrice: number,
  triggers: HoldingTrigger[],
): HoldingAlert[] {
  const alerts: HoldingAlert[] = [];
  const money = (value: number) => `$${value.toFixed(2)}`;

  const stop = triggers.find((trigger) =>
    trigger.type === "stop_sell" || trigger.type === "trailing_stop",
  );
  const stopPrice = stop ? extractTriggerPrice(stop.condition) : null;

  if (stop && stopPrice && currentPrice <= stopPrice) {
    alerts.push({
      type: "price_stop",
      severity: "critical",
      title: `${ticker} has hit its stop-loss / invalidation level`,
      message: `Current price ${money(currentPrice)} is at or below the plan level of ${money(stopPrice)}.`,
      recommendation: stop.action,
    });
  }

  const target = triggers.find((trigger) => trigger.type === "take_profit");
  const targetPrice = target ? extractTriggerPrice(target.condition) : null;

  if (target && targetPrice && currentPrice >= targetPrice) {
    alerts.push({
      type: "price_target",
      severity: "success",
      title: `${ticker} has reached its take-profit zone`,
      message: `Current price ${money(currentPrice)} is at or above the plan target of ${money(targetPrice)}.`,
      recommendation: target.action,
    });
  }

  return alerts;
}
'''

    if "function buildTriggerHitAlerts" not in text:
        marker = "\n// ✦ Much smarter"
        if marker not in text:
            marker = "\nexport async function enrichHoldings"
        if marker not in text:
            raise SystemExit("Could not find helper insertion point for trigger hit alerts")
        text = text.replace(marker, helper + marker, 1)

    old_review = '''  if (p.daysSinceReview >= 90) {
    alerts.push({
      type: "review_due", severity: "info",
      title: `${p.ticker} hasn't been reviewed in ${p.daysSinceReview} days`,
      message: "Quarterly review is best practice.",
      recommendation: `Open the stock page, check AI score, news, and trade plan, then mark as reviewed.`,
    });
  }
'''
    new_review = '''  if (p.daysSinceReview >= 90) {
    alerts.push({
      type: "review_due", severity: "info",
      title: `${p.ticker} review is overdue — ${p.daysSinceReview} days since last review`,
      message: "Quarterly review is best practice.",
      recommendation: `Open the stock page, check AI score, news, and trade plan, then mark as reviewed.`,
    });
  } else if (p.daysSinceReview >= 76) {
    alerts.push({
      type: "review_due", severity: "info",
      title: `${p.ticker} review is due soon`,
      message: `Next quarterly review is due in ${90 - p.daysSinceReview} days.`,
      recommendation: `Check the stock page, AI rank, recent news, and trade plan before the review date.`,
    });
  }
'''
    text = text.replace(old_review, new_review)

    if "buildTriggerHitAlerts(ticker, currentPrice, triggers)" not in text:
        # Handles the current enrichHoldings implementation where triggers are built after base alerts.
        pattern = r"(\n\s*const triggers = await buildDynamicTriggers\(\{[\s\S]*?\n\s*\}\);\n)"
        replacement = r"\1\n    alerts.push(...buildTriggerHitAlerts(ticker, currentPrice, triggers));\n"
        text, count = re.subn(pattern, replacement, text, count=1)
        if count != 1:
            raise SystemExit("Could not insert trigger-hit alerts after buildDynamicTriggers call")

    if "type: \"price_stop\"" not in text or "type: \"price_target\"" not in text:
        raise SystemExit("Price stop/target alert helpers were not added")

    path.write_text(text)


patch_dashboard_copy_only()
patch_saved_portfolio_duplicate_logo()
patch_portfolio_alert_rank_wording()
patch_price_and_date_alerts()
print("Applied portfolio review-date, stop-loss, and take-profit hit alerts.")
