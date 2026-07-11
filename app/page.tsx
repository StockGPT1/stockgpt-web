import type { Metadata } from "next";
import { getLandingData } from "@/lib/landing-data";
import { LandingClient } from "./landing/LandingClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "StockGPT — AI Stock Rankings, Portfolio Builder & Monitoring",
  description:
    "Use AI stock rankings, portfolio generation, portfolio monitoring, alerts, market news and research tools to build a clearer investing workflow.",
};

export default async function LandingPage() {
  const { tickerTape, metrics, topRankings } = await getLandingData();

  return (
    <LandingClient
      tickerTape={tickerTape}
      metrics={metrics}
      topRankings={topRankings}
    />
  );
}
