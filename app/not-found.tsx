import Link from "next/link";

/* Static route: everything here animates via CSS/SMIL only, so the page
   needs no hydration (static HTML can't carry the per-request CSP nonce
   that inline scripts would need). */

const CRASH_PATH =
  "M0 150 C40 140 70 146 100 132 C130 118 160 126 190 108 " +
  "C220 90 250 98 280 76 C300 62 316 56 330 58 " +
  "C342 60 346 148 354 178 C358 190 364 196 374 196 L560 196";

export default function NotFound() {
  return (
    <main className="grid h-dvh place-items-center overflow-hidden bg-[radial-gradient(ellipse_60%_45%_at_50%_35%,rgba(221,177,89,0.10),transparent_65%),#020806] px-6">
      <style>{`
        .nf-line {
          stroke-dasharray: 100;
          stroke-dashoffset: 100;
          animation: nf-draw 2.1s cubic-bezier(0.45, 0.05, 0.4, 0.95) 0.35s forwards;
        }
        @keyframes nf-draw { to { stroke-dashoffset: 0; } }
        .nf-chip {
          opacity: 0;
          animation: nf-pop 0.45s cubic-bezier(0.2, 1.4, 0.4, 1) 1.75s forwards;
        }
        @keyframes nf-pop {
          from { opacity: 0; transform: translateY(8px) scale(0.9); }
          to { opacity: 1; transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .nf-line { animation-duration: 0.01s; animation-delay: 0s; }
          .nf-chip { animation-duration: 0.01s; animation-delay: 0s; }
        }
      `}</style>

      <div className="flex w-full max-w-xl flex-col items-center text-center">
        {/* ghost numerals with the crashing ticker drawn through them */}
        <div className="fx-rise relative w-full" style={{ ["--fx-delay" as string]: "0s" }}>
          <p
            aria-hidden="true"
            className="select-none text-center text-[150px] font-black leading-none tracking-[-0.06em] text-[#ddb159]/12 sm:text-[210px]"
          >
            404
          </p>

          <svg
            aria-hidden="true"
            viewBox="0 0 560 220"
            className="absolute inset-0 m-auto h-full w-full overflow-visible"
            preserveAspectRatio="xMidYMid meet"
          >
            <path
              className="nf-line"
              d={CRASH_PATH}
              pathLength={100}
              fill="none"
              stroke="#f87171"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* tick that rides the line into the crash, then holds */}
            <circle r="4.5" fill="#f4d78a">
              <animateMotion
                dur="2.1s"
                begin="0.35s"
                fill="freeze"
                path={CRASH_PATH}
                calcMode="linear"
              />
            </circle>
          </svg>

          <span className="nf-chip absolute right-0 top-2 inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-[11px] font-black text-red-300 sm:right-6">
            <span className="fx-live-dot" />
            PAGE · Delisted · -100.00%
          </span>
        </div>

        <h1
          className="fx-rise mt-1 text-[28px] font-black tracking-[-0.03em] text-[#faf6f0]"
          style={{ ["--fx-delay" as string]: "0.12s" }}
        >
          This page got delisted.
        </h1>
        <p
          className="fx-rise mt-2 max-w-md text-[14.5px] font-medium leading-relaxed text-[#faf6f0]/55"
          style={{ ["--fx-delay" as string]: "0.2s" }}
        >
          The page you&apos;re after doesn&apos;t exist, or the ticker isn&apos;t in our
          database. The other 500+ stocks are still trading — head back and
          pick a winner.
        </p>

        <div
          className="fx-rise mt-8 flex items-center gap-3"
          style={{ ["--fx-delay" as string]: "0.28s" }}
        >
          <Link
            href="/"
            className="fx-sheen rounded-full border border-[#ddb159] bg-[linear-gradient(135deg,#f4d78a_0%,#ddb159_55%,#c99a3e_100%)] px-5 py-2.5 text-[13px] font-bold !text-[#072116] shadow-[0_14px_40px_rgba(221,177,89,0.25)] transition hover:brightness-105"
          >
            Back to safety
          </Link>
          <Link
            href="/rankings"
            className="fx-sheen rounded-full border border-[#ddb159]/40 px-5 py-2.5 text-[13px] font-bold !text-[#ddb159] transition hover:border-[#ddb159] hover:bg-[#ddb159]/10"
          >
            View rankings
          </Link>
        </div>
      </div>
    </main>
  );
}
