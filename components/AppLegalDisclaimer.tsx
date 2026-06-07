"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppLegalDisclaimer() {
  const pathname = usePathname();

  if (pathname === "/dashboard") return null;

  return (
    <div className="mt-3 rounded-2xl border border-[#ddb159]/14 bg-[#04180f]/72 px-4 py-3 text-[10px] font-medium leading-5 text-[#faf6f0]/36 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
      © {new Date().getFullYear()} StockGPT LLC. StockGPT is an AI-powered
      research and ranking tool. Rankings, scores and AI outputs are
      informational only. You are responsible for your own decisions. {" "}
      <Link href="/legal#disclaimer" className="font-bold text-[#ddb159] hover:underline">
        Read disclaimer
      </Link>
      .
    </div>
  );
}
