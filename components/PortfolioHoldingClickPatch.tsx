"use client";

import { useEffect } from "react";

function cleanTicker(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, "");
}

function findHoldingNameArea(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  return target.closest("div.group.relative.overflow-hidden div.relative.grid > div:first-child");
}

function findTicker(nameArea: Element) {
  const tickerText = nameArea.querySelector("p")?.textContent;
  return cleanTicker(tickerText);
}

export function PortfolioHoldingClickPatch() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("button, a, input, select, textarea")) return;

      const nameArea = findHoldingNameArea(target);
      if (!nameArea) return;

      const row = nameArea.closest("div.group.relative.overflow-hidden");
      if (!row) return;

      const ticker = findTicker(nameArea);
      if (!ticker) return;

      window.location.assign(`/stock/${ticker}`);
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
