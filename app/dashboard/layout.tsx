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
        main [class*="rounded-xl"][class*="bg-[#faf6f0]"],
        main [class*="rounded-2xl"][class*="bg-[#faf6f0]"] {
          position: relative;
        }

        main [class*="rounded-xl"][class*="bg-[#faf6f0]"]::after,
        main [class*="rounded-2xl"][class*="bg-[#faf6f0]"]::after {
          content: "";
          pointer-events: none;
          position: absolute;
          inset: 0;
          border-radius: inherit;
          border: 1px solid rgba(7, 33, 22, 0.16);
          box-shadow: inset 0 0 0 1px rgba(221, 177, 89, 0.10);
        }

        @media (min-width: 1024px) {
          a[href="/portfolio"][class*="hover:border"] > div:nth-last-child(2) {
            margin-bottom: 16px !important;
          }

          a[href="/portfolio"][class*="hover:border"] > div:last-child {
            z-index: 30;
            margin-top: 6px !important;
            transform: translateY(2px);
          }

          a[href="/portfolio"][class*="hover:border"] [class*="pointer-events-none"][class*="bottom-3"][class*="w-[10rem]"] {
            bottom: 2.25rem !important;
          }
        }
      `}</style>
    </>
  );
}
