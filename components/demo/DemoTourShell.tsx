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
  if (step.view === "stock") view = <DemoStockView sectionRefs={stockSectionRefs} />;
  if (step.view === "portfolio-build") view = <DemoPortfolioBuildView />;
  if (step.view === "portfolio-manage") view = <DemoPortfolioManageView />;

  return (
    <main className="relative h-[100dvh] overflow-hidden bg-[#072116]">
      <DemoAppShell view={step.view} contentRef={contentRef}>
        {view}
      </DemoAppShell>
      <DemoInfoBox
        step={step}
        stepIndex={currentStep}
        totalSteps={demoSteps.length}
        onBack={() => setCurrentStep((value) => Math.max(0, value - 1))}
        onNext={() => setCurrentStep((value) => Math.min(demoSteps.length - 1, value + 1))}
      />
    </main>
  );
}
