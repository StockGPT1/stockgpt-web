import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

export function RankingsLock({
  isLocked,
  children,
  className = "",
}: {
  isLocked: boolean;
  children: ReactNode;
  className?: string;
}) {
  const isMobileRankingsSurface = className.includes("lg:hidden");
  const mobileSurfaceStyle: CSSProperties | undefined = isMobileRankingsSurface
    ? {
        backgroundColor: "transparent",
        borderRadius: "1rem",
        overflow: "hidden",
        isolation: "isolate",
      }
    : undefined;

  if (!isLocked) {
    return (
      <div className={className} style={mobileSurfaceStyle}>
        {children}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={mobileSurfaceStyle}>
      <div className="pointer-events-none h-full min-h-0 overflow-hidden select-none blur-[4px] opacity-50">
        {children}
      </div>

      <div
        className={[
          "absolute inset-0 z-20 flex items-center justify-center px-4 backdrop-blur-[1px]",
          isMobileRankingsSurface
            ? "rounded-2xl bg-[#072116]/32"
            : "bg-[#faf6f0]/18",
        ].join(" ")}
      >
        <div className="max-w-[320px] rounded-2xl border border-[#ddb159]/40 bg-[#072116]/92 px-5 py-4 text-center text-[#faf6f0] shadow-[0_18px_46px_rgba(0,0,0,0.38)]">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
            Core Rankings
          </p>

          <h3 className="mt-1.5 text-[18px] font-black leading-tight tracking-[-0.03em]">
            Unlock the full ranking table
          </h3>

          <p className="mt-2 text-[11px] font-medium leading-relaxed text-[#faf6f0]/62">
            Full AI rankings, scores, prices and stock analysis are available to
            Core members.
          </p>

          <Link
            href="/pricing?feature=rankings"
            className="mt-4 inline-flex rounded-full bg-[#ddb159] px-4 py-2 text-[11px] font-black text-[#072116] transition hover:brightness-105"
          >
            View upgrade options →
          </Link>
        </div>
      </div>
    </div>
  );
}
