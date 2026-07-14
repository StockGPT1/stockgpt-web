import type { Metadata } from "next";
import { getScrollLandingData } from "@/lib/scroll-landing-data";
import { ScrollLandingClient } from "./landing/ScrollLandingClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "StockGPT — AI Stock Rankings, Portfolio Builder & Monitoring",
  description:
    "Use AI stock rankings, portfolio generation, portfolio monitoring, alerts, market news and research tools to build a clearer investing workflow.",
};

export default async function LandingPage() {
  const { metrics, topRankings } = await getScrollLandingData();

  return <ScrollLandingClient metrics={metrics} topRankings={topRankings} />;
}
