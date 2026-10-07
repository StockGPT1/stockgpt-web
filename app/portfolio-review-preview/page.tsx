import { notFound } from "next/navigation";
import PortfolioDesignPreview from "@/dev/PortfolioDesignPreview";
import "../portfolio/portfolio-mobile-alignment.css";

export const metadata = {
  title: "StockGPT portfolio design preview",
  robots: { index: false, follow: false },
};

export default function PortfolioReviewPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <PortfolioDesignPreview />;
}
