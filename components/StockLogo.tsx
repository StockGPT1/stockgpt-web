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
    .replace(".", "-");
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

export function StockLogo({
  ticker,
  company,
  size = 24,
  className = "",
}: StockLogoProps) {
  const [failed, setFailed] = useState(false);
  const symbol = cleanTicker(ticker);
  const fallback = initialsFrom(ticker, company);

  if (!symbol || failed) {
    return (
      <span
        className={[
          "inline-flex shrink-0 items-center justify-center rounded-full border border-[#ddb159]/35 bg-[#072116] text-[9px] font-black text-[#ddb159]",
          className,
        ].join(" ")}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        {fallback}
      </span>
    );
  }

  return (
    <span
      className={[
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#072116]/10 bg-white",
        className,
      ].join(" ")}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Image
        src={`https://financialmodelingprep.com/image-stock/${symbol}.png`}
        alt=""
        width={size}
        height={size}
        className="h-full w-full object-contain p-[2px]"
        onError={() => setFailed(true)}
        unoptimized
      />
    </span>
  );
}
