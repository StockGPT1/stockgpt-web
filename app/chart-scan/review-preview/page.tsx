import { notFound } from "next/navigation";
import ScannerDesignPreview from "@/dev/ScannerDesignPreview";

export const metadata = { title: "StockGPT scanner preview", robots: { index: false, follow: false } };

export default function ScannerReviewPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ScannerDesignPreview />;
}
