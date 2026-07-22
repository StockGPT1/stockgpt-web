import type { Metadata } from "next";

/* Route segment config must live in a SERVER file — exporting it from
   the "use client" page is silently ignored, which left this route
   statically prerendered. Static HTML can never carry the per-request
   CSP nonce, so the streamed page body and hydration scripts were
   blocked in production and the page stuck on its loading skeleton. */
export const dynamic = "force-dynamic";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Update Password | StockGPT",
  description: "Update your StockGPT password.",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
