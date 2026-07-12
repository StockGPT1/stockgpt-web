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

const circularMaskStyle = {
  borderRadius: "9999px",
  clipPath: "circle(50% at 50% 50%)",
  WebkitClipPath: "circle(50% at 50% 50%)",
  overflow: "hidden",
} as const;

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
          "inline-flex shrink-0 items-center justify-center border border-[#ddb159]/35 bg-[#072116] font-black text-[#ddb159] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
          className,
        ].join(" ")}
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          fontSize: fallbackTextSize(size),
          ...circularMaskStyle,
        }}
        aria-hidden="true"
      >
        {fallback}
      </span>
    );
  }

  return (
    <span
      className={[
        "relative inline-flex shrink-0 items-center justify-center border border-[#072116]/12 bg-[#f7f2e8] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.72)]",
        className,
      ].join(" ")}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        ...circularMaskStyle,
      }}
      aria-hidden="true"
    >
      <span
        className="absolute inset-0 grid place-items-center bg-[#072116] font-black text-[#ddb159]"
        style={{
          fontSize: fallbackTextSize(size),
          ...circularMaskStyle,
        }}
      >
        {fallback}
      </span>

      <Image
        src={`https://financialmodelingprep.com/image-stock/${symbol}.png`}
        alt=""
        width={size}
        height={size}
        className="relative z-10 block h-full w-full object-contain drop-shadow-[0_1px_1px_rgba(7,33,22,0.18)]"
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#f7f2e8",
          ...circularMaskStyle,
        }}
        onError={() => setFailedSymbol(symbol)}
        unoptimized
      />
    </span>
  );
}
