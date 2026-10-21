import { notFound } from "next/navigation";
import NativeAppReviewPreview from "@/dev/NativeAppReviewPreview";

export const metadata = {
  title: "StockGPT native app review",
  robots: { index: false, follow: false },
};

export default function NativeAppReviewPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <NativeAppReviewPreview />;
}
