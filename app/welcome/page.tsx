import type { Metadata } from "next";
import { WelcomeCarousel } from "./WelcomeCarousel";

// Production uses a per-request CSP nonce. This route must render dynamically
// so Next.js hydration scripts receive that nonce; otherwise WKWebView shows
// the static carousel HTML/CSS but React never hydrates, leaving the page dots
// and other client interactions stuck.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Welcome to StockGPT",
  description: "Explore StockGPT on iPhone.",
  robots: { index: false, follow: false },
};

export default function WelcomePage() {
  return <WelcomeCarousel />;
}
