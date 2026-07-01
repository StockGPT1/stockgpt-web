"use client";

import { TrackedLink } from "@/components/analytics/TrackedLink";
import type { DemoStep } from "@/lib/demo/demoSteps";

export function DemoInfoBox({
  step,
  stepIndex,
  totalSteps,
  onBack,
  onNext,
  onMinimise,
}: {
  step: DemoStep;
  stepIndex: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  onMinimise: () => void;
}) {
  const isLast = stepIndex === totalSteps - 1;

  return (
    <aside
      className="demo-tour-box pointer-events-auto fixed inset-x-2 bottom-[calc(70px+env(safe-area-inset-bottom))] z-50 max-h-[42dvh] overflow-y-auto rounded-[24px] border border-[#ddb159]/42 bg-[#04180f]/[0.98] p-3 text-[#faf6f0] shadow-[0_24px_80px_rgba(0,0,0,0.58)] backdrop-blur-xl sm:inset-x-4 sm:p-4 lg:inset-x-auto lg:bottom-5 lg:right-5 lg:max-h-[44dvh] lg:w-[360px]"
      aria-live="polite"
      aria-label={`Demo step ${stepIndex + 1} of ${totalSteps}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
          Guided tour · {stepIndex + 1}/{totalSteps}
        </p>
        <span className="rounded-full border border-[#ddb159]/25 bg-[#ddb159]/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#ddb159]">
          Demo data
        </span>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10 sm:mt-3">
        <div
          className="h-full rounded-full bg-[#ddb159] transition-[width] duration-300"
          style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
        />
      </div>

      <h2 className="mt-3 text-[20px] font-black leading-tight tracking-[-0.04em] sm:mt-4 sm:text-2xl">
        {step.title}
      </h2>

      <ul className="mt-2 grid gap-1 sm:mt-3 sm:gap-2">
        {step.bullets.map((bullet) => (
          <li key={bullet} className="flex gap-2 text-[11px] font-semibold leading-4 text-white/66 sm:text-[13px] sm:leading-5">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#ddb159]" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

      {isLast ? (
        <div className="mt-3 grid gap-2 sm:mt-4">
          <TrackedLink
            href="/signup?coupon=50PORTFOLIO2026&source=demo"
            eventName="demo_cta_clicked"
            eventProperties={{ destination: "signup", source: "demo" }}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#ddb159] px-4 text-center text-[12px] font-black leading-4 text-[#072116] transition hover:brightness-105"
          >
            Create account and build your first Portfolio Draft
          </TrackedLink>
          <TrackedLink
            href="/signup?coupon=50PORTFOLIO2026&source=demo_stock_check"
            eventName="demo_cta_clicked"
            eventProperties={{ destination: "signup", source: "demo_stock_check" }}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#ddb159]/35 px-4 text-center text-[11px] font-black text-[#ddb159] transition hover:bg-[#ddb159]/10"
          >
            Start with a StockGPT Check
          </TrackedLink>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4">
          <button
            type="button"
            onClick={onMinimise}
            className="min-h-12 rounded-full border border-[#ddb159]/35 px-3 text-[11px] font-black text-[#ddb159] transition hover:bg-[#ddb159]/10 focus:outline-none focus:ring-2 focus:ring-[#ddb159]"
          >
            View page
          </button>
          <button
            type="button"
            onClick={onNext}
            className="min-h-12 rounded-full bg-[#ddb159] px-3 text-[11px] font-black leading-4 text-[#072116] transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#04180f]"
          >
            {step.nextLabel}
          </button>
        </div>
      )}

      {stepIndex > 0 && (
        <button
          type="button"
          onClick={onBack}
          className="mt-2 min-h-10 w-full rounded-full border border-white/12 px-4 text-[11px] font-black text-white/62 transition hover:border-[#ddb159]/35 hover:text-[#ddb159] focus:outline-none focus:ring-2 focus:ring-[#ddb159]"
        >
          Back
        </button>
      )}
    </aside>
  );
}
