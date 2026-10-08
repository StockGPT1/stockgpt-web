import { notFound, redirect } from "next/navigation";

export const metadata = { title: "StockGPT design preview", robots: { index: false, follow: false } };

export default function ScannerReviewPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  redirect("/chart-scan/review-preview");
}
