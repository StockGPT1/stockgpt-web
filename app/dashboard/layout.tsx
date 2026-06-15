import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Dashboard | StockGPT",
  description: "Private StockGPT subscriber dashboard.",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <style>{`
        @media (min-width: 1024px) {
          a[href="/portfolio"][class*="hover:border"] > div:last-child {
            margin-top: 3px !important;
          }
        }
      `}</style>
    </>
  );
}
