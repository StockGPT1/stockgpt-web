import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Create Account | StockGPT",
  description:
    "Create a StockGPT account to access AI-powered stock rankings and market research tools.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
