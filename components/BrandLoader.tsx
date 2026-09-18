/* eslint-disable @next/next/no-img-element */

/**
 * Branded full-screen loader used by every loading.tsx: the StockGPT
 * mark breathing inside a spinning gold arc, over a market sparkline
 * that draws itself on loop with a "live tick" riding the line.
 *
 * Server-safe: pure CSS animations via an inline <style> tag (the CSP
 * allows inline styles, only scripts are nonce-gated). Class names are
 * prefixed bl- to stay clear of the global stylesheet.
 */

const SPARK_PATH =
  "M2 34 C14 30 20 33 30 26 C42 18 50 24 62 19 C74 14 82 20 94 12 C106 5 116 9 126 6 C136 3 148 7 158 4";

export function BrandLoader({ label }: { label: string }) {
  return (
    <div className="bl-wrap" role="status" aria-label={label}>
      <style>{`
        .bl-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 22px;
          animation: bl-in 0.5s ease both;
        }
        .bl-stage { position: relative; width: 124px; height: 124px; }
        .bl-stage > * { position: absolute; inset: 0; margin: auto; }
        .bl-ring-outer { animation: bl-spin 9s linear infinite reverse; opacity: 0.5; }
        .bl-ring-arc { animation: bl-spin 1.1s cubic-bezier(0.55, 0.15, 0.45, 0.85) infinite; }
        .bl-mark {
          width: 54px;
          height: 54px;
          border-radius: 14px;
          box-shadow: 0 6px 30px rgba(221, 177, 89, 0.35);
          animation: bl-breathe 2.2s ease-in-out infinite;
        }
        .bl-spark { overflow: visible; }
        .bl-spark-line {
          stroke-dasharray: 100;
          animation: bl-draw 2.6s cubic-bezier(0.5, 0.05, 0.4, 0.95) infinite;
        }
        .bl-label {
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: rgba(221, 177, 89, 0.85);
        }
        .bl-label i {
          font-style: normal;
          animation: bl-blink 1.4s steps(1) infinite;
        }
        .bl-label i + i { animation-delay: 0.25s; }
        .bl-label i + i + i { animation-delay: 0.5s; }
        @keyframes bl-in { from { opacity: 0; transform: scale(0.96); } }
        @keyframes bl-spin { to { transform: rotate(360deg); } }
        @keyframes bl-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.07); }
        }
        @keyframes bl-draw {
          0% { stroke-dashoffset: 100; opacity: 1; }
          72% { stroke-dashoffset: 0; opacity: 1; }
          88% { opacity: 0; }
          100% { stroke-dashoffset: 0; opacity: 0; }
        }
        @keyframes bl-blink {
          0%, 40% { opacity: 0.2; }
          50%, 100% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .bl-wrap, .bl-wrap * { animation-duration: 0.01s !important; animation-iteration-count: 1 !important; }
        }
      `}</style>

      <div className="bl-stage">
        <svg className="bl-ring-outer" width="124" height="124" viewBox="0 0 124 124" aria-hidden="true">
          <circle
            cx="62"
            cy="62"
            r="58"
            fill="none"
            stroke="rgba(221,177,89,0.35)"
            strokeWidth="1.5"
            strokeDasharray="2 9"
            strokeLinecap="round"
          />
        </svg>
        <svg className="bl-ring-arc" width="124" height="124" viewBox="0 0 124 124" aria-hidden="true">
          <circle
            cx="62"
            cy="62"
            r="48"
            fill="none"
            stroke="url(#bl-gold)"
            strokeWidth="3"
            strokeDasharray="86 216"
            strokeLinecap="round"
          />
          <defs>
            <linearGradient id="bl-gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f4d78a" />
              <stop offset="100%" stopColor="#c08f2f" />
            </linearGradient>
          </defs>
        </svg>
        {/* plain img: next/image adds nothing for a 54px local icon */}
        <img className="bl-mark" src="/icon.png" alt="" width={54} height={54} />
      </div>

      <svg className="bl-spark" width="160" height="38" viewBox="0 0 160 38" aria-hidden="true">
        <path
          className="bl-spark-line"
          d={SPARK_PATH}
          pathLength={100}
          fill="none"
          stroke="#34d399"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* live tick riding the line, timed to the draw loop via SMIL
            (CSS offset-path on SVG children is unreliable in Safari) */}
        <circle r="3.5" fill="#f4d78a">
          <animateMotion
            dur="2.6s"
            repeatCount="indefinite"
            path={SPARK_PATH}
            calcMode="linear"
            keyPoints="0;1;1"
            keyTimes="0;0.72;1"
          />
          <animate
            attributeName="opacity"
            values="1;1;0;0"
            keyTimes="0;0.72;0.88;1"
            dur="2.6s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>

      <p className="bl-label">
        {label}
        <i>.</i>
        <i>.</i>
        <i>.</i>
      </p>
    </div>
  );
}

/** Full-viewport shell shared by the loading.tsx files. */
export function BrandLoaderPage({
  label,
  background = "#072116",
}: {
  label: string;
  background?: string;
}) {
  return (
    <main
      aria-busy="true"
      className="grid h-dvh place-items-center"
      style={{
        background: `radial-gradient(ellipse 60% 45% at 50% 38%, rgba(221,177,89,0.09), transparent 65%), ${background}`,
      }}
    >
      <BrandLoader label={label} />
    </main>
  );
}


/**
 * Minimal boot loader for the first app screen. The StockGPT mark completes
 * one flip per second and lands with a small spring/compression bounce.
 * Route-to-route loaders continue using BrandLoaderPage above.
 */
export function StartupLogoLoaderPage() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading StockGPT"
      className="grid h-dvh place-items-center overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse 54% 38% at 50% 44%, rgba(221,177,89,0.08), transparent 68%), #072116",
      }}
    >
      <style>{`
        .sg-boot-stage {
          position: relative;
          display: grid;
          width: 112px;
          height: 132px;
          place-items: center;
          perspective: 700px;
        }

        .sg-boot-logo {
          width: 72px;
          height: 72px;
          border-radius: 18px;
          transform-origin: 50% 100%;
          backface-visibility: visible;
          will-change: transform;
          animation: sg-boot-flip 1s linear infinite;
          filter: drop-shadow(0 14px 26px rgba(0,0,0,0.22));
        }

        .sg-boot-shadow {
          position: absolute;
          left: 50%;
          bottom: 8px;
          width: 50px;
          height: 9px;
          border-radius: 999px;
          background: rgba(0,0,0,0.28);
          filter: blur(5px);
          transform: translateX(-50%);
          animation: sg-boot-shadow 1s linear infinite;
        }

        @keyframes sg-boot-flip {
          0% {
            transform: translateY(0) rotateY(0deg) scaleX(1) scaleY(1);
          }
          12% {
            transform: translateY(-8px) rotateY(38deg) scaleX(1.01) scaleY(1.01);
          }
          46% {
            transform: translateY(-30px) rotateY(176deg) scaleX(1.015) scaleY(1.015);
          }
          78% {
            transform: translateY(-8px) rotateY(324deg) scaleX(1) scaleY(1);
          }
          86% {
            transform: translateY(2px) rotateY(360deg) scaleX(1.09) scaleY(0.91);
          }
          91% {
            transform: translateY(-6px) rotateY(360deg) scaleX(0.97) scaleY(1.04);
          }
          96% {
            transform: translateY(1px) rotateY(360deg) scaleX(1.035) scaleY(0.97);
          }
          100% {
            transform: translateY(0) rotateY(360deg) scaleX(1) scaleY(1);
          }
        }

        @keyframes sg-boot-shadow {
          0%, 100% {
            opacity: 0.5;
            transform: translateX(-50%) scaleX(1);
          }
          46% {
            opacity: 0.16;
            transform: translateX(-50%) scaleX(0.54);
          }
          86% {
            opacity: 0.64;
            transform: translateX(-50%) scaleX(1.14);
          }
          91% {
            opacity: 0.4;
            transform: translateX(-50%) scaleX(0.88);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .sg-boot-logo,
          .sg-boot-shadow {
            animation: none !important;
          }
        }
      `}</style>

      <div className="sg-boot-stage">
        <img
          className="sg-boot-logo"
          src="/icon.png"
          alt=""
          width={72}
          height={72}
        />
        <span className="sg-boot-shadow" aria-hidden="true" />
      </div>
    </main>
  );
}
