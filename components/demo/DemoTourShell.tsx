"use client";

import { useEffect, useRef, useState } from "react";
import { demoSteps } from "@/lib/demo/demoSteps";
import { trackClientEvent } from "@/lib/analytics/client-events";
import { DemoAppShell } from "./DemoAppShell";
import { DemoDashboardView } from "./DemoDashboardView";
import { DemoInfoBox } from "./DemoInfoBox";
import { DemoPortfolioBuildView } from "./DemoPortfolioBuildView";
import { DemoPortfolioManageView } from "./DemoPortfolioManageView";
import { DemoRankingsView } from "./DemoRankingsView";
import { DemoStockView, type DemoStockSectionRefs } from "./DemoStockView";

export function DemoTourShell() {
  const [currentStep, setCurrentStep] = useState(0);
  const [guideOpen, setGuideOpen] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const previousViewRef = useRef(demoSteps[0].view);
  const stockOverviewRef = useRef<HTMLElement>(null);
  const stockNewsRef = useRef<HTMLElement>(null);
  const stockTradePlanRef = useRef<HTMLElement>(null);
  const stockNumbersRef = useRef<HTMLElement>(null);
  const step = demoSteps[currentStep];

  const stockSectionRefs: DemoStockSectionRefs = {
    "stock-overview": stockOverviewRef,
    "stock-news": stockNewsRef,
    "stock-trade-plan": stockTradePlanRef,
    "stock-numbers": stockNumbersRef,
  };

  useEffect(() => {
    trackClientEvent("demo_started");
  }, []);

  useEffect(() => {
    trackClientEvent("demo_step_viewed", {
      step: currentStep + 1,
      title: step.title,
      view: step.view,
    });

    if (currentStep === demoSteps.length - 1) {
      trackClientEvent("demo_completed");
    }

    const container = contentRef.current;
    if (!container) return;

    if (previousViewRef.current !== step.view) {
      container.scrollTo({ top: 0, behavior: "smooth" });
    } else if (step.view === "stock" && step.scrollTarget) {
      const target =
        step.scrollTarget === "stock-overview"
          ? stockOverviewRef.current
          : step.scrollTarget === "stock-news"
            ? stockNewsRef.current
            : step.scrollTarget === "stock-trade-plan"
              ? stockTradePlanRef.current
              : stockNumbersRef.current;
      if (target) {
        const containerRect = container.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        container.scrollTo({
          top: container.scrollTop + targetRect.top - containerRect.top - 12,
          behavior: "smooth",
        });
      }
    }

    previousViewRef.current = step.view;
  }, [currentStep, step.scrollTarget, step.title, step.view]);

  let view = <DemoDashboardView />;
  if (step.view === "rankings") view = <DemoRankingsView />;
  if (step.view === "stock")
    view = <DemoStockView sectionRefs={stockSectionRefs} />;
  if (step.view === "portfolio-build") view = <DemoPortfolioBuildView />;
  if (step.view === "portfolio-manage") view = <DemoPortfolioManageView />;

  return (
    <main
      className={[
        "relative h-[100dvh] overflow-hidden bg-[#072116]",
        guideOpen ? "xl:grid xl:grid-cols-[minmax(0,1fr)_372px]" : "",
      ].join(" ")}
    >
      <DemoAppShell
        view={step.view}
        contentRef={contentRef}
        guideOpen={guideOpen}
      >
        {view}
      </DemoAppShell>
      {guideOpen ? (
        <>
          <DemoInfoBox
            step={step}
            stepIndex={currentStep}
            totalSteps={demoSteps.length}
            onBack={() => setCurrentStep((value) => Math.max(0, value - 1))}
            onNext={() =>
              setCurrentStep((value) =>
                Math.min(demoSteps.length - 1, value + 1),
              )
            }
            onMinimise={() => setGuideOpen(false)}
          />
          <div className="hidden min-h-0 border-l border-[#ddb159]/18 bg-[#04180f] p-5 xl:block">
            <DemoInfoBox
              step={step}
              stepIndex={currentStep}
              totalSteps={demoSteps.length}
              onBack={() => setCurrentStep((value) => Math.max(0, value - 1))}
              onNext={() =>
                setCurrentStep((value) =>
                  Math.min(demoSteps.length - 1, value + 1),
                )
              }
              onMinimise={() => setGuideOpen(false)}
              placement="rail"
            />
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setGuideOpen(true)}
          className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-3 z-50 min-h-11 rounded-full border border-[#ddb159]/45 bg-[#04180f] px-4 text-[11px] font-black text-[#ddb159] shadow-[0_14px_34px_rgba(0,0,0,0.38)] transition hover:bg-[#0b2b1d] focus:outline-none focus:ring-2 focus:ring-[#ddb159] lg:bottom-5 lg:right-5"
          aria-label={`Open guided tour, step ${currentStep + 1} of ${demoSteps.length}`}
        >
          Tour {currentStep + 1}/{demoSteps.length} · Open guide
        </button>
      )}
    </main>
  );
}
