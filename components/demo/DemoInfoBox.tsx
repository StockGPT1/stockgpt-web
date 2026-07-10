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
  placement = "floating",
}: {
  step: DemoStep;
  stepIndex: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  onMinimise: () => void;
  placement?: "floating" | "rail";
}) {
  const isLast = stepIndex === totalSteps - 1;
  const isRail = placement === "rail";

  return (
    <aside
      className={[
        "demo-tour-box pointer-events-auto grid overflow-y-auto overscroll-contain rounded-[22px] border border-[#ddb159]/42 bg-[#04180f]/[0.98] text-[#faf6f0] shadow-[0_24px_80px_rgba(0,0,0,0.58)] backdrop-blur-xl",
        isRail
          ? "max-h-[calc(100dvh-40px)] p-3"
          : "fixed inset-x-2 bottom-[calc(70px+env(safe-area-inset-bottom))] z-50 max-h-[calc(100dvh-88px-env(safe-area-inset-bottom))] p-2.5 sm:inset-x-4 sm:p-3 xl:hidden",
      ].join(" ")}
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

      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[#ddb159] transition-[width] duration-300"
          style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
        />
      </div>

      <h2 className="mt-2 text-[18px] font-black leading-tight tracking-[-0.04em] sm:text-[20px]">
        {step.title}
      </h2>

      <ul className="mt-1.5 grid gap-1">
        {step.bullets.map((bullet) => (
          <li
            key={bullet}
            className="flex gap-2 text-[10.5px] font-semibold leading-4 text-white/66 sm:text-[11px]"
          >
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#ddb159]" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

      {isLast ? (
        <div className="mt-2 grid gap-1.5">
          <TrackedLink
            href="/signup?coupon=50PORTFOLIO2026&source=demo"
            eventName="demo_cta_clicked"
            eventProperties={{ destination: "signup", source: "demo" }}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#ddb159] px-4 text-center text-[11px] font-black leading-4 text-[#072116] transition hover:brightness-105"
          >
            Create account and build your first Portfolio Draft
          </TrackedLink>
          <TrackedLink
            href="/signup?coupon=50PORTFOLIO2026&source=demo_stock_check"
            eventName="demo_cta_clicked"
            eventProperties={{
              destination: "signup",
              source: "demo_stock_check",
            }}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#ddb159]/35 px-4 text-center text-[10.5px] font-black text-[#ddb159] transition hover:bg-[#ddb159]/10"
          >
            Start with a StockGPT Check
          </TrackedLink>
        </div>
      ) : (
        <div
          className={[
            "mt-2 grid gap-1.5",
            stepIndex > 0
              ? "grid-cols-[72px_minmax(0,1fr)_minmax(0,1.2fr)]"
              : "grid-cols-2",
          ].join(" ")}
        >
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={onBack}
              className="min-h-11 rounded-full border border-white/12 px-2 text-[10px] font-black text-white/62 transition hover:border-[#ddb159]/35 hover:text-[#ddb159]"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={onMinimise}
            className="min-h-11 rounded-full border border-[#ddb159]/35 px-2 text-[10.5px] font-black text-[#ddb159] transition hover:bg-[#ddb159]/10 focus:outline-none focus:ring-2 focus:ring-[#ddb159]"
          >
            View page
          </button>
          <button
            type="button"
            onClick={onNext}
            className="min-h-11 rounded-full bg-[#ddb159] px-2 text-[10px] font-black leading-3.5 text-[#072116] transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#04180f]"
          >
            {step.nextLabel}
          </button>
        </div>
      )}

      {isLast && stepIndex > 0 && (
        <button
          type="button"
          onClick={onBack}
          className="mt-1.5 min-h-11 w-full rounded-full border border-white/12 px-4 text-[10.5px] font-black text-white/62 transition hover:border-[#ddb159]/35 hover:text-[#ddb159] focus:outline-none focus:ring-2 focus:ring-[#ddb159]"
        >
          Back
        </button>
      )}
    </aside>
  );
}
