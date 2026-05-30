import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Update Password | StockGPT",
  description:
    "Choose a new password for your StockGPT account.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
