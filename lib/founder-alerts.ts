import type { DataFreshnessSummary, FreshnessRecord } from "@/lib/data-freshness";
import { formatFreshnessAge, formatFreshnessDate } from "@/lib/data-freshness";
import { sendTransactionalEmail } from "@/lib/transactional-email";

const alertEmail = process.env.FOUNDER_ALERT_EMAIL ?? "sales@stockgpt.pro";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://stockgpt.pro";

function describeFreshnessItem(item: FreshnessRecord) {
  return `${item.label}: ${formatFreshnessDate(item.latestAt)} (${formatFreshnessAge(
    item,
  )})`;
}

export async function sendDataFreshnessAlertEmail({
  freshness,
  staleItems,
}: {
  freshness: DataFreshnessSummary;
  staleItems: FreshnessRecord[];
}) {
  if (staleItems.length === 0) return { skipped: true };

  return sendTransactionalEmail({
    to: alertEmail,
    subject: "StockGPT data refresh check",
    preview: "One or more StockGPT data sources is stale or still refreshing.",
    eyebrow: "Data Refresh",
    heading: "StockGPT data refresh check.",
    body: [
      `StockGPT found ${staleItems.length} data source${
        staleItems.length === 1 ? "" : "s"
      } outside the ${freshness.staleAfterHours}-hour freshness window.`,
      staleItems.map(describeFreshnessItem).join(" | "),
      "The logged-in app will show a subtle data still refreshing message until the data refreshes.",
    ],
    ctaLabel: "Open dashboard",
    ctaUrl: `${siteUrl}/dashboard`,
    secondaryNote:
      "Check the ranking refresh, price refresh and news refresh jobs if this was unexpected.",
  });
}