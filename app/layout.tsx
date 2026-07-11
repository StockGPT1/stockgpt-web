import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";
import { PortfolioHoldingClickPatch } from "@/components/PortfolioHoldingClickPatch";
import { RankingsFinancialWhyPatch } from "@/components/RankingsFinancialWhyPatch";
import "./globals.css";
import "./mobile-overflow.css";
import "./visual-cleanup.css";
import "./dashboard-right-rail.css";
import "./portfolio-final-fixes.css";
import "./portfolio-mobile-reference.css";
import "./landing-mobile-fixes.css";
import "./desktop-side-modals.css";
import "./ask-stockgpt-polish.css";
import "./ask-stockgpt-mobile-hardening.css";
import "./stock-action-buttons.css";
import "./mobile-sheets.css";
import "./top-movers-drawer.css";

// The design system references Inter and IBM Plex Mono throughout, but the
// fonts were never loaded, so every visitor got Arial/system fallbacks.
// next/font self-hosts them (no external requests at runtime, CSP-safe) and
// exposes CSS variables consumed in globals.css and the landing styles.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-plex-mono",
});

const iconVersion = "31";

export const metadata: Metadata = {
  metadataBase: new URL("https://stockgpt.pro"),
  title: {
    default: "StockGPT — AI Stock Rankings & Portfolio Builder",
    template: "%s | StockGPT",
  },
  description:
    "AI-powered stock rankings, portfolio builder, and market alerts for new investors.",
  manifest: `/site.webmanifest?v=${iconVersion}`,
  icons: {
    icon: [
      {
        url: `/icon.png?v=${iconVersion}`,
        type: "image/png",
      },
      {
        url: `/favicon.ico?v=${iconVersion}`,
        sizes: "any",
      },
    ],
    shortcut: [
      {
        url: `/icon.png?v=${iconVersion}`,
      },
      {
        url: `/favicon.ico?v=${iconVersion}`,
      },
    ],
    apple: [
      {
        url: `/apple-touch-icon.png?v=${iconVersion}`,
        sizes: "180x180",
        type: "image/png",
      },
      {
        url: `/apple-touch-icon-precomposed.png?v=${iconVersion}`,
      },
      {
        url: `/og-image.png?v=${iconVersion}`,
        type: "image/png",
      },
    ],
  },
  openGraph: {
    title: "StockGPT — AI Stock Rankings & Portfolio Builder",
    description:
      "AI-powered stock rankings, portfolio builder, and market alerts for new investors.",
    url: "https://stockgpt.pro",
    siteName: "StockGPT",
    images: [
      {
        url: `/og-image.png?v=${iconVersion}`,
        width: 1200,
        height: 630,
        alt: "StockGPT",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "StockGPT — AI Stock Rankings & Portfolio Builder",
    description:
      "AI-powered stock rankings, portfolio builder, and market alerts for new investors.",
    images: [`/og-image.png?v=${iconVersion}`],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#072116",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${plexMono.variable}`}>
      <body>
        {children}
        <PortfolioHoldingClickPatch />
        <RankingsFinancialWhyPatch />
        <Analytics />
        <SpeedInsights />
        <Script id="stockgpt-structured-data" type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "StockGPT",
            applicationCategory: "FinanceApplication",
            operatingSystem: "Web",
            offers: {
              "@type": "Offer",
              price: "18.99",
              priceCurrency: "GBP",
            },
          })}
        </Script>
      </body>
    </html>
  );
}
