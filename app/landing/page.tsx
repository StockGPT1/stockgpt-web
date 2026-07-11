import type { Metadata } from "next";
import { getLandingData } from "@/lib/landing-data";
import { LandingClient } from "./LandingClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "StockGPT — Stock Rankings, Portfolio Context & Market Research",
  description:
    "Try StockGPT free. Rank US stocks, understand portfolio exposure, track market news and start your research with structure instead of noise.",
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
