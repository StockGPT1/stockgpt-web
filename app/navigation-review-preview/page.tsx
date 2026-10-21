import { notFound } from "next/navigation";
import NavigationDesignPreview from "@/dev/NavigationDesignPreview";

export const metadata = {
  title: "StockGPT navigation preview",
  robots: { index: false, follow: false },
};

export default function NavigationReviewPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <NavigationDesignPreview />;
}
