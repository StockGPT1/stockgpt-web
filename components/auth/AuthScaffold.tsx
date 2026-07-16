"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

const DEMO_ROWS = [
  { rank: "01", ticker: "DECK", score: "9,032", move: "+1.4%", up: true },
  { rank: "02", ticker: "ANET", score: "8,858", move: "+2.1%", up: true },
  { rank: "03", ticker: "ORLY", score: "8,610", move: "+0.6%", up: true },
  { rank: "04", ticker: "KLAC", score: "8,377", move: "-0.8%", up: false },
];

/**
 * Full-screen scaffold for the auth pages: a cinematic brand panel on
 * the left (compact strip on mobile) and a scrollable form column on
 * the right. The root owns its own h-dvh scroller because the global
 * stylesheet pins html/body with overflow:hidden — pages that rely on
 * document scrolling silently can't scroll at all on mobile.
 */
export function AuthScaffold({
  eyebrow,
  title,
  subtitle,
  footer,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="h-dvh overflow-y-auto overscroll-contain bg-[#020806] text-[#faf6f0] [-webkit-overflow-scrolling:touch]">
      <div className="min-h-full lg:grid lg:grid-cols-[1.05fr_1fr]">
        {/* brand panel — sticky full-height on desktop, slim strip on mobile */}
        <aside className="relative overflow-hidden border-b border-[#ddb159]/14 lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_30%_-10%,rgba(221,177,89,0.16),transparent_60%),radial-gradient(ellipse_50%_40%_at_80%_110%,rgba(16,185,129,0.10),transparent_65%),linear-gradient(160deg,#062017_0%,#04140d_45%,#020c08_100%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_65%_at_50%_45%,transparent_55%,rgba(0,0,0,0.5)_100%)]" />

          <div className="relative flex items-center justify-between px-5 py-4 lg:h-full lg:flex-col lg:items-start lg:justify-between lg:p-10">
            <Link
              href="/"
              aria-label="StockGPT home"
              className="relative block h-9 w-[132px] shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ddb159] lg:h-11 lg:w-[168px]"
            >
              <Image src="/logo.png" alt="StockGPT" fill priority className="object-contain object-left" sizes="168px" />
            </Link>

            <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#ddb159]/85 lg:hidden">
              {eyebrow}
            </p>

            {/* desktop-only hero copy + live-look demo card */}
            <div className="hidden min-w-0 lg:block">
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#ddb159]">
                {eyebrow}
              </p>
              <h2 className="mt-4 max-w-[26rem] text-[44px] font-black leading-[1.02] tracking-[-0.045em] text-white xl:text-[52px]">
                Every stock. Scored.{" "}
                <span className="bg-[linear-gradient(120deg,#f4d78a_10%,#ddb159_45%,#c08f2f_90%)] bg-clip-text text-transparent">
                  Ranked.
                </span>
              </h2>
              <p className="mt-4 max-w-[24rem] text-[13.5px] font-medium leading-relaxed text-white/55">
                500+ US stocks scored daily across quality, growth, value, momentum,
                risk and income — one workflow for rankings, portfolio and research.
              </p>

              <div className="mt-8 w-full max-w-[22rem] overflow-hidden rounded-2xl border border-white/10 bg-[#0a1811]/80 shadow-[0_30px_80px_rgba(0,0,0,0.5)] backdrop-blur">
                <div className="flex items-center justify-between border-b border-white/8 px-4 py-2.5">
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#f4f1e8]">
                    Top ranked
                  </span>
                  <span className="rounded-full bg-[#ddb159] px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.1em] text-[#071b11]">
                    Live
                  </span>
                </div>
                {DEMO_ROWS.map((row) => (
                  <div
                    key={row.ticker}
                    className="flex items-center gap-3 border-b border-white/[0.04] px-4 py-2 last:border-b-0"
                  >
                    <span className="w-5 text-[10px] font-black text-[#ddb159]/80">{row.rank}</span>
                    <span className="flex-1 text-[12px] font-black text-[#f4f1e8]">{row.ticker}</span>
                    <span className={`text-[10px] font-black ${row.up ? "text-emerald-300" : "text-red-300"}`}>
                      {row.move}
                    </span>
                    <span className="rounded-full bg-[#ddb159]/85 px-2 py-0.5 text-[10px] font-black tabular-nums text-[#071b11]">
                      {row.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <p className="hidden max-w-[24rem] text-[10px] font-semibold leading-5 text-white/32 lg:block">
              StockGPT is a research and ranking tool. Informational only — not
              financial advice. Investing involves risk.
            </p>
          </div>
        </aside>

        {/* form column */}
        <section className="relative flex min-h-full items-start justify-center px-5 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-8 sm:items-center sm:px-8 lg:py-12">
          <div className="w-full max-w-[430px]">
            <p className="hidden text-[10px] font-black uppercase tracking-[0.22em] text-[#ddb159] sm:block">
              {eyebrow}
            </p>
            <h1 className="mt-2 text-[32px] font-black leading-none tracking-[-0.045em] sm:text-[38px]">
              {title}
            </h1>
            <p className="mt-3 text-[13px] font-medium leading-relaxed text-white/55">
              {subtitle}
            </p>

            <div className="mt-7">{children}</div>

            {footer && <div className="mt-8">{footer}</div>}

            <p className="mt-8 text-center text-[10px] font-semibold leading-5 text-white/30 lg:hidden">
              Research and ranking tool. Informational only — not financial advice.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export const authInputClass =
  "block h-12 w-full min-w-0 rounded-xl border border-white/10 bg-[#071b11] px-4 text-[14px] font-semibold text-[#faf6f0] outline-none transition placeholder:text-white/28 focus:border-[#ddb159]/80 focus:ring-2 focus:ring-[#ddb159]/25";

export const authLabelClass =
  "mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]/85";

export const authPrimaryButtonClass =
  "h-12 w-full rounded-full border border-[#ddb159] bg-[linear-gradient(135deg,#f4d78a_0%,#ddb159_55%,#c99a3e_100%)] px-4 text-[13px] font-black uppercase tracking-[0.12em] text-[#071b11] shadow-[0_14px_40px_rgba(221,177,89,0.25)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55";

export const authGhostButtonClass =
  "h-11 rounded-full border border-white/14 bg-white/[0.03] px-4 text-[12px] font-black text-[#faf6f0] transition hover:border-[#ddb159]/55 hover:bg-[#ddb159]/8 disabled:opacity-55";

/* Inline text links (e.g. "Create an account", "Log in") — gold with a
   visible underline so the clickable part is unmistakable. The !
   modifiers are required: globals.css styles `a` outside any layer
   (color: inherit; text-decoration: none), and unlayered CSS beats
   Tailwind's layered utilities. */
export const authInlineLinkClass =
  "font-black !text-[#ddb159] !underline !decoration-[#ddb159]/55 !decoration-2 underline-offset-4 transition hover:!decoration-[#ddb159] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ddb159]";

export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1 text-[9.5px] font-black uppercase tracking-[0.18em] text-white/30">
      <span className="h-px min-w-0 flex-1 bg-white/10" />
      <span className="shrink-0">{label}</span>
      <span className="h-px min-w-0 flex-1 bg-white/10" />
    </div>
  );
}

export function AuthMessage({
  tone,
  children,
}: {
  tone: "info" | "success" | "error";
  children: ReactNode;
}) {
  const toneClass =
    tone === "error"
      ? "border-red-400/25 bg-red-500/10 text-red-200"
      : tone === "success"
        ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
        : "border-[#ddb159]/20 bg-[#ddb159]/10 text-[#f6e7bf]";
  return (
    <div className={`rounded-xl border p-3 text-[12px] font-bold leading-5 ${toneClass}`}>
      {children}
    </div>
  );
}
