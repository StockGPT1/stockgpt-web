import type { Metadata, Viewport } from "next";
import "./globals.css";

const iconVersion = "3";

export const metadata: Metadata = {
  metadataBase: new URL("https://stockgpt.pro"),
  title: "StockGPT",
  description:
    "AI-powered stock rankings, portfolio builder, and market alerts for new investors.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      {
        url: `/favicon.ico?v=${iconVersion}`,
        sizes: "any",
      },
      {
        url: `/logo.png?v=${iconVersion}`,
        type: "image/png",
      },
      {
        url: `/apple-touch-icon.png?v=${iconVersion}`,
        sizes: "180x180",
        type: "image/png",
      },
    ],
    shortcut: [
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
        url: `/logo.png?v=${iconVersion}`,
        width: 512,
        height: 512,
        alt: "StockGPT",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "StockGPT — AI Stock Rankings & Portfolio Builder",
    description:
      "AI-powered stock rankings, portfolio builder, and market alerts for new investors.",
    images: [`/logo.png?v=${iconVersion}`],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#072116",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const iconHref = `/logo.png?v=${iconVersion}`;
  const appleIconHref = `/apple-touch-icon.png?v=${iconVersion}`;
  const faviconHref = `/favicon.ico?v=${iconVersion}`;

  return (
    <html lang="en">
      <head>
        <link rel="icon" href={faviconHref} sizes="any" />
        <link rel="shortcut icon" href={faviconHref} />
        <link rel="icon" type="image/png" href={iconHref} />
        <link rel="apple-touch-icon" href={appleIconHref} />
        <link
          rel="apple-touch-icon-precomposed"
          href={`/apple-touch-icon-precomposed.png?v=${iconVersion}`}
        />
        <meta name="apple-mobile-web-app-title" content="StockGPT" />
        <meta name="application-name" content="StockGPT" />
        <meta name="theme-color" content="#072116" />
      </head>

      <body className="antialiased">{children}</body>
    </html>
  );
}
