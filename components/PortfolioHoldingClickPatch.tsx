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
  const title = nameArea.querySelector("p:first-of-type")?.textContent;
  const subtitle = nameArea.querySelector("p:nth-of-type(2)")?.textContent;
  const subtitleTicker = subtitle?.split("·")[0];
  const originalTicker = nameArea.getAttribute("data-stockgpt-ticker");
  return cleanTicker(originalTicker || subtitleTicker || title);
}

function normaliseShares(value: string | null | undefined) {
  const clean = String(value ?? "").trim();
  if (!clean) return "";
  return clean.replace(/\s*sh$/i, " shares");
}

function patchHoldingTitles() {
  const nameAreas = document.querySelectorAll("div.group.relative.overflow-hidden div.relative.grid > div:first-child");

  nameAreas.forEach((nameArea) => {
    const title = nameArea.querySelector("p:first-of-type");
    const subtitle = nameArea.querySelector("p:nth-of-type(2)");
    const rowGrid = nameArea.parentElement;
    const sharesText = rowGrid?.querySelector("div:nth-child(2) p:nth-of-type(3)")?.textContent;

    if (!title || !subtitle || nameArea.getAttribute("data-stockgpt-title-patched") === "true") return;

    const ticker = cleanTicker(title.textContent);
    const company = subtitle.textContent?.trim() || ticker;
    const shares = normaliseShares(sharesText);

    nameArea.setAttribute("data-stockgpt-ticker", ticker);
    nameArea.setAttribute("data-stockgpt-title-patched", "true");
    title.textContent = company;
    subtitle.textContent = shares ? `${ticker} · ${shares}` : ticker;
  });
}

export function PortfolioHoldingClickPatch() {
  useEffect(() => {
    patchHoldingTitles();
    const observer = new MutationObserver(() => patchHoldingTitles());
    observer.observe(document.body, { childList: true, subtree: true });

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
    return () => {
      observer.disconnect();
      document.removeEventListener("click", onClick);
    };
  }, []);

  return null;
}
