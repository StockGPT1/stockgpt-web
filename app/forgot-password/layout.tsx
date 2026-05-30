import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Reset Password | StockGPT",
  description:
    "Request a secure password reset link for your StockGPT account.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
