"use client";

import Image from "next/image";
import { useState } from "react";

type StockLogoProps = {
  ticker?: string | null;
  company?: string | null;
  size?: number;
  className?: string;
};

function cleanTicker(ticker?: string | null) {
  return (ticker ?? "")
    .trim()
    .toUpperCase()
    .replaceAll(".", "-");
}

function initialsFrom(ticker?: string | null, company?: string | null) {
  const t = cleanTicker(ticker);
  if (t) return t.slice(0, 4);

  return (company ?? "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

function fallbackTextSize(size: number) {
  if (size >= 42) return 10;
  if (size >= 30) return 8.5;
  return 7;
}

export function StockLogo({
  ticker,
  company,
  size = 24,
  className = "",
}: StockLogoProps) {
  const [failedSymbol, setFailedSymbol] = useState<string | null>(null);
  const symbol = cleanTicker(ticker);
  const fallback = initialsFrom(ticker, company);
  const failed = failedSymbol === symbol;

  if (!symbol || failed) {
    return (
      <span
        className={[
          "inline-flex shrink-0 items-center justify-center rounded-full border border-[#ddb159]/35 bg-[#072116] font-black text-[#ddb159] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
          className,
        ].join(" ")}
        style={{ width: size, height: size, fontSize: fallbackTextSize(size) }}
        aria-hidden="true"
      >
        {fallback}
      </span>
    );
  }

  return (
    <span
      className={[
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#072116]/12 bg-[#f7f2e8] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.72)]",
        className,
      ].join(" ")}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span
        className="absolute inset-0 grid place-items-center rounded-full bg-[#072116] font-black text-[#ddb159]"
        style={{ fontSize: fallbackTextSize(size) }}
      >
        {fallback}
      </span>
      <Image
        src={`https://financialmodelingprep.com/image-stock/${symbol}.png`}
        alt=""
        width={size}
        height={size}
        className="relative z-10 h-full w-full bg-[#f7f2e8] object-contain p-[12%] drop-shadow-[0_1px_1px_rgba(7,33,22,0.28)]"
        onError={() => setFailedSymbol(symbol)}
        unoptimized
      />
    </span>
  );
}
