"use client";

import { useEffect } from "react";
import Link from "next/link";

/* Root error boundary — the "market turbulence" page. Client component
   by Next.js contract; keeps the delisted-404's visual language so
   failures still feel like part of the product. */

const TURBULENCE_PATH =
  "M0 110 C40 100 70 118 100 96 C130 74 160 112 190 88 " +
  "C220 64 250 118 280 84 C310 50 340 122 370 92 C400 62 430 108 460 86 L560 86";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[root-error-boundary]", error);
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center overflow-hidden bg-[radial-gradient(ellipse_60%_45%_at_50%_35%,rgba(221,177,89,0.10),transparent_65%),#020806] px-6">
      <style>{`
        .err-line {
          stroke-dasharray: 100;
          stroke-dashoffset: 100;
          animation: errDraw 1.8s cubic-bezier(0.45, 0.05, 0.4, 0.95) 0.3s forwards;
        }
        @keyframes errDraw { to { stroke-dashoffset: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .err-line { animation-duration: 0.01s; animation-delay: 0s; }
        }
      `}</style>

      <div className="flex w-full max-w-xl flex-col items-center text-center">
        <div className="relative w-full">
          <p
            aria-hidden="true"
            className="select-none text-center text-[110px] font-black leading-none tracking-[-0.06em] text-[#ddb159]/12 sm:text-[150px]"
          >
            OOPS
          </p>
          <svg
            aria-hidden="true"
            viewBox="0 0 560 200"
            className="absolute inset-0 m-auto h-full w-full overflow-visible"
            preserveAspectRatio="xMidYMid meet"
          >
            <path
              className="err-line"
              d={TURBULENCE_PATH}
              pathLength={100}
              fill="none"
              stroke="#ddb159"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="mt-1 text-[26px] font-black tracking-[-0.03em] text-[#faf6f0]">
          We hit some turbulence.
        </h1>
        <p className="mt-2 max-w-md text-[14px] font-medium leading-relaxed text-[#faf6f0]/55">
          Something went wrong rendering this page. Your data is fine — markets are
          volatile, and occasionally so are we. Try again, or head back to safety.
        </p>

        <div className="mt-8 flex items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="fx-sheen rounded-full border border-[#ddb159] bg-[linear-gradient(135deg,#f4d78a_0%,#ddb159_55%,#c99a3e_100%)] px-6 py-2.5 text-[13px] font-bold !text-[#072116] shadow-[0_14px_40px_rgba(221,177,89,0.25)] transition hover:brightness-105"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="rounded-full border border-[#ddb159]/40 px-6 py-2.5 text-[13px] font-bold !text-[#ddb159] no-underline transition hover:border-[#ddb159] hover:bg-[#ddb159]/10"
          >
            Back to dashboard
          </Link>
        </div>

        {error.digest && (
          <p className="mt-6 text-[10px] font-semibold text-[#faf6f0]/30">
            Error reference: <span className="font-black">{error.digest}</span>
          </p>
        )}
      </div>
    </main>
  );
}
