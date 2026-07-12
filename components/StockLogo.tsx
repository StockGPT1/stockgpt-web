"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";

type StockLogoProps = {
  ticker?: string | null;
  company?: string | null;
  size?: number;
  className?: string;
};

const WIDE_OR_WORDMARK_LOGOS = new Set([
  "BRK-B",
  "GOOG",
  "GOOGL",
  "INCY",
  "LLY",
  "MS",
  "MU",
  "SNDK",
  "TPR",
  "VZ",
  "WDC",
]);

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
  if (size >= 48) return 11;
  if (size >= 42) return 10;
  if (size >= 30) return 8.5;
  return 7;
}

function imagePadding(size: number, symbol: string) {
  const ratio = WIDE_OR_WORDMARK_LOGOS.has(symbol) ? 0.19 : 0.14;
  return Math.max(2, Math.round(size * ratio));
}

function shellStyle(size: number): CSSProperties {
  return {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    maxWidth: size,
    maxHeight: size,
    borderRadius: "50%",
    overflow: "hidden",
    clipPath: "circle(50% at 50% 50%)",
    WebkitClipPath: "circle(50% at 50% 50%)",
    WebkitMaskImage:
      "radial-gradient(circle at center, #000 99.25%, transparent 100%)",
    contain: "paint",
    isolation: "isolate",
  };
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
          "inline-flex shrink-0 items-center justify-center border border-[#ddb159]/35 bg-[#072116] font-black text-[#ddb159] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
          className,
        ].join(" ")}
        style={{
          ...shellStyle(size),
          fontSize: fallbackTextSize(size),
        }}
        aria-hidden="true"
      >
        {fallback}
      </span>
    );
  }

  const padding = imagePadding(size, symbol);

  return (
    <span
      className={[
        "relative inline-flex shrink-0 items-center justify-center border border-[#ddb159]/20 bg-[#efe9dc] shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_1px_2px_rgba(2,12,8,0.18)]",
        className,
      ].join(" ")}
      style={shellStyle(size)}
      aria-hidden="true"
      data-stock-logo={symbol}
    >
      <span className="absolute inset-px overflow-hidden rounded-full bg-[#efe9dc]">
        <span
          className="absolute inset-0 grid place-items-center rounded-full bg-[#072116] font-black text-[#ddb159]"
          style={{ fontSize: fallbackTextSize(size) }}
        >
          {fallback}
        </span>
        <Image
          key={symbol}
          src={`https://financialmodelingprep.com/image-stock/${symbol}.png`}
          alt=""
          fill
          sizes={`${size}px`}
          className="relative z-10 object-contain"
          style={{
            padding,
            backgroundColor: "#efe9dc",
            mixBlendMode: "multiply",
          }}
          onError={() => setFailedSymbol(symbol)}
          unoptimized
        />
      </span>
    </span>
  );
}
