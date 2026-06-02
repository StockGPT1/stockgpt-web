import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import "./globals.css";

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
        sizes: "180x180",
        type: "image/png",
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
  maximumScale: 1,
  themeColor: "#072116",
};

const themeInitialiser = `
(function () {
  try {
    var mode = localStorage.getItem("stockgpt:theme-mode") || "dark";
    if (mode === "light") {
      document.documentElement.classList.add("sg-light-mode");
      document.documentElement.dataset.sgTheme = "light";
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", "#fbfaf6");
    } else {
      document.documentElement.classList.remove("sg-light-mode");
      document.documentElement.dataset.sgTheme = "dark";
    }
  } catch (e) {
    document.documentElement.dataset.sgTheme = "dark";
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitialiser }} />

        <link
          rel="icon"
          type="image/png"
          href={`/og-image.png?v=${iconVersion}`}
        />

        <link
          rel="shortcut icon"
          type="image/png"
          href={`/og-image.png?v=${iconVersion}`}
        />

        <link rel="icon" href={`/favicon.ico?v=${iconVersion}`} sizes="any" />

        <link
          rel="apple-touch-icon"
          href={`/apple-touch-icon.png?v=${iconVersion}`}
          sizes="180x180"
        />

        <link
          rel="apple-touch-icon-precomposed"
          href={`/apple-touch-icon-precomposed.png?v=${iconVersion}`}
          sizes="180x180"
        />

        <meta name="apple-mobile-web-app-title" content="StockGPT" />
        <meta name="application-name" content="StockGPT" />
        <meta name="theme-color" content="#072116" />
      </head>

      <body className="antialiased">
        {children}

        <Analytics />

        <Script
          src="https://asset.endorsely.com/endorsely.js"
          data-endorsely="a00749c7-8bdd-47f8-a6de-1f57fb7702f5"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
