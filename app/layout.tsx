import "./globals.css";

export const metadata = {
  title: "StockGPT",
  description: "AI-powered stock rankings, insights and market intelligence.",
  openGraph: {
    title: "StockGPT",
    description: "AI-powered stock rankings, insights and market intelligence.",
    url: "https://stockgpt.pro",
    siteName: "StockGPT",
    images: [{ url: "https://stockgpt.pro/og-image.png", width: 1200, height: 630, alt: "StockGPT" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "StockGPT",
    description: "AI-powered stock rankings, insights and market intelligence.",
    images: ["https://stockgpt.pro/og-image.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className="h-full antialiased"><body className="min-h-full flex flex-col">{children}</body></html>;
}
