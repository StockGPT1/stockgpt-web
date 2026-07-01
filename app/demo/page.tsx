import type { Metadata } from "next";
import { DemoTourShell } from "@/components/demo/DemoTourShell";

export const metadata: Metadata = {
  title: "60-Second StockGPT Product Tour",
  description:
    "Explore a read-only StockGPT demo with illustrative data across rankings, stock research, trade-plan analysis and Portfolio Drafts.",
  alternates: { canonical: "/demo" },
};

export default function DemoPage() {
  return <DemoTourShell />;
}
