import type { Metadata, Viewport } from "next";
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
import "./dark-cream-surfaces.css";

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
    shortcut: `/favicon.ico?v=${iconVersion}`,
    apple: `/apple-touch-icon.png?v=${iconVersion}`,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#072116",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <PortfolioHoldingClickPatch />
        <RankingsFinancialWhyPatch />
        <Analytics />
        <SpeedInsights />
        <Script id="affiliate-startupbase" strategy="afterInteractive">
          {`
            (function(w,d,s,o,f,js,fjs){
              w['StartupBaseAffiliateObject']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
              js=d.createElement(s),fjs=d.getElementsByTagName(s)[0];
              js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
            }(window,document,'script','startupbase','https://static.startupbase.io/affiliate/startupbase.js'));
            startupbase('init', 'stockgpt');
          `}
        </Script>
      </body>
    </html>
  );
}
