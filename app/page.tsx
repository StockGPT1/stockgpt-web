import type { Metadata } from "next";
import { getScrollLandingData } from "@/lib/scroll-landing-data";
import { getTickerTape, type TickerTapeItem } from "@/lib/yahoo";
import { ScrollLandingClient } from "./landing/ScrollLandingClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "StockGPT — AI Stock Rankings, Portfolio Builder & Monitoring",
  description:
    "Use AI stock rankings, portfolio generation, portfolio monitoring, alerts, market news and research tools to build a clearer investing workflow.",
};

/* Live index/mega-cap tape for the hero marquee. Never allowed to slow
   the landing down: hard 2.5s budget, and an empty tape just makes the
   marquee fall back to brand copy. */
async function getLandingTape(): Promise<TickerTapeItem[]> {
  try {
    return await Promise.race([
      getTickerTape(),
      new Promise<TickerTapeItem[]>((resolve) => setTimeout(() => resolve([]), 2_500)),
    ]);
  } catch {
    return [];
  }
}

export default async function LandingPage() {
  const [{ metrics }, tape] = await Promise.all([getScrollLandingData(), getLandingTape()]);

  return <ScrollLandingClient metrics={metrics} tape={tape} />;
}
