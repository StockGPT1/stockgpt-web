"use client";

import { useEffect } from "react";

export function PortfolioChartValueLock() {
  useEffect(() => {
    let headline = "";
    let returnText = "";

    function readCurrent() {
      const hero = document.querySelector<HTMLElement>(".portfolio-chart-hero");
      const title = hero?.querySelector<HTMLElement>("h1");
      const sub = hero?.querySelector<HTMLElement>("h1 + p");
      headline = title?.textContent ?? headline;
      returnText = sub?.textContent ?? returnText;
    }

    function restoreCurrent() {
      const hero = document.querySelector<HTMLElement>(".portfolio-chart-hero");
      const title = hero?.querySelector<HTMLElement>("h1");
      const sub = hero?.querySelector<HTMLElement>("h1 + p");
      if (title && headline && title.textContent !== headline) title.textContent = headline;
      if (sub && returnText && sub.textContent !== returnText) sub.textContent = returnText;
    }

    readCurrent();

    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(() => {
        const hero = document.querySelector<HTMLElement>(".portfolio-chart-hero");
        const title = hero?.querySelector<HTMLElement>("h1");
        if (!title) return;
        if (!headline) readCurrent();
        restoreCurrent();
      });
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener("stockgpt:portfolio-chart-scrub", restoreCurrent as EventListener, true);

    return () => {
      observer.disconnect();
      window.removeEventListener("stockgpt:portfolio-chart-scrub", restoreCurrent as EventListener, true);
    };
  }, []);

  return null;
}
