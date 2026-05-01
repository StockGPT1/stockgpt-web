import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "StockGPT",
  description: "AI-powered stock rankings, insights and market intelligence.",

  openGraph: {
    title: "StockGPT",
    description: "AI-powered stock rankings, insights and market intelligence.",
    url: "https://stockgpt.pro",
    siteName: "StockGPT",
    images: [
      {
        url: "https://stockgpt.pro/og-image.png",
        width: 1200,
        height: 630,
        alt: "StockGPT",
      },
    ],
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "StockGPT",
    description: "AI-powered stock rankings, insights and market intelligence.",
    images: ["https://stockgpt.pro/og-image.png"],
  },
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
