import type { Metadata } from "next";
import { WelcomeCarousel } from "./WelcomeCarousel";

export const metadata: Metadata = {
  title: "Welcome to StockGPT",
  description: "Explore StockGPT on iPhone.",
  robots: { index: false, follow: false },
};

export default function WelcomePage() {
  return <WelcomeCarousel />;
}
