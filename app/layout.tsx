import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";
import "./globals.css";
import "./mobile-overflow.css";
import "./visual-cleanup.css";
import "./dashboard-right-rail.css";
import "./portfolio-final-fixes.css";
import "./desktop-side-modals.css";
import "./ask-stockgpt-polish.css";
import "./ask-stockgpt-mobile-hardening.css";

const iconVersion = "30";

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
        url: `/og-image.png?v=${iconVersion}`,
        type: "image/png",
      },
      {
        url: `/favicon.ico?v=${iconVersion}`,
        sizes: "any",
      },
    ],
    shortcut: [
      {
        url: `/og-image.png?v=${iconVersion}`,
        type: "image/png",
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
    <html lang="en">
      <body>
        {children}
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
