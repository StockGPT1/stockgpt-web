import { notFound } from "next/navigation";
import ScannerDesignPreview from "@/dev/ScannerDesignPreview";

export const metadata = { title: "StockGPT scanner preview", robots: { index: false, follow: false } };

export default async function ScannerReviewPreviewPage({ searchParams }: { searchParams: Promise<{ screen?: string | string[] }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { screen } = await searchParams;
  const initialScreen = typeof screen === "string" && ["bullish", "bearish", "mixed"].includes(screen) ? screen : "landing";
  return <ScannerDesignPreview initialScreen={initialScreen} />;
}
