import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Log In | StockGPT",
  description:
    "Log in to StockGPT to access AI stock rankings, portfolio tools and market intelligence.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
