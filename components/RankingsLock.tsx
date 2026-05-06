import Link from "next/link";
import type { ReactNode } from "react";

export function RankingsLock({
  isLocked,
  children,
  className = "",
}: {
  isLocked: boolean;
  children: ReactNode;
  className?: string;
}) {
  if (!isLocked) {
    return <>{children}</>;
  }

  return (
    <div className={`relative ${className}`}>
      <div className="pointer-events-none select-none blur-[5px] opacity-45">
        {children}
      </div>

      <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#072116]/10 px-4 backdrop-blur-[1px]">
        <div className="max-w-[320px] rounded-2xl border border-[#ddb159]/40 bg-[#072116]/92 px-5 py-4 text-center text-[#faf6f0] shadow-[0_18px_46px_rgba(0,0,0,0.38)]">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
            ✦ Premium Rankings
          </p>

          <h3 className="mt-1.5 text-[18px] font-black leading-tight tracking-[-0.03em]">
            Subscribe to unlock the rankings
          </h3>

          <p className="mt-2 text-[11px] font-medium leading-relaxed text-[#faf6f0]/62">
            Full AI rankings, scores, prices and stock analysis are available to
            subscribed members.
          </p>

          <Link
            href="/pricing"
            className="mt-4 inline-flex rounded-full bg-[#ddb159] px-4 py-2 text-[11px] font-black text-[#072116] transition hover:brightness-105"
          >
            Unlock access →
          </Link>
        </div>
      </div>
    </div>
  );
}
