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

function formatMoney(value: unknown, currency = "USD") {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: n >= 1000 ? 0 : 2,
  }).format(n);
}

function distanceText(currentPrice: number | null, level: number | null) {
  if (!currentPrice || !level || currentPrice <= 0 || level <= 0) return "";
  const pct = ((level - currentPrice) / currentPrice) * 100;
  const direction = pct >= 0 ? "above" : "below";
  return `${Math.abs(pct).toFixed(1)}% ${direction} current price`;
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

function patchAskStockGPTCloseButton() {
  const closeButton = document.querySelector<HTMLButtonElement>(".sg-ask-workspace > header button:last-child");
  if (!closeButton || closeButton.getAttribute("data-stockgpt-close-patched") === "true") return;

  closeButton.setAttribute("data-stockgpt-close-patched", "true");
  closeButton.setAttribute("aria-label", "Close Ask StockGPT");
  closeButton.title = "Close Ask StockGPT";
  closeButton.textContent = "×";
  closeButton.classList.add("stockgpt-ask-close-button");
}

function removeBrokenMarkdownTables() {
  const bubbles = document.querySelectorAll(".sg-ask-workspace div.min-w-0 p");
  bubbles.forEach((paragraph) => {
    const text = paragraph.textContent?.trim() ?? "";
    if (!text.startsWith("|") || !text.endsWith("|")) return;
    paragraph.remove();
  });
}

function insertTradeLevelCard(dialog: Element, levels: any) {
  if (dialog.querySelector("[data-stockgpt-trade-level-card]")) return;
  const metricGrid = dialog.querySelector("div.grid.grid-cols-2.gap-2");
  if (!metricGrid) return;

  const currency = String(levels?.currency ?? "USD");
  const risk = Number.isFinite(Number(levels?.risk_level_at_entry)) ? Number(levels.risk_level_at_entry) : null;
  const target = Number.isFinite(Number(levels?.target_level_at_entry)) ? Number(levels.target_level_at_entry) : null;
  const current = Number.isFinite(Number(levels?.current_price)) ? Number(levels.current_price) : null;
  if (risk === null && target === null) return;

  const card = document.createElement("div");
  card.setAttribute("data-stockgpt-trade-level-card", "true");
  card.className = "rounded-2xl border border-[#ddb159]/16 bg-[#faf6f0]/[0.045] p-3";
  card.innerHTML = `
    <p class="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">Buy-time trade levels</p>
    <p class="mt-1 text-[12px] font-semibold leading-5 text-[#faf6f0]/58">These are the saved stop-loss and take-profit levels from when this holding was added. Manual holdings without saved levels show nothing here and do not create SL/TP alerts.</p>
    <div class="mt-3 grid gap-2 sm:grid-cols-2">
      ${risk === null ? "" : `<div class="rounded-2xl border border-red-300/18 bg-red-300/8 px-3 py-2"><p class="text-[9px] font-black uppercase tracking-[0.12em] text-red-200/80">Stop loss</p><p class="mt-1 text-[18px] font-black text-red-100">${formatMoney(risk, currency)}</p><p class="mt-1 text-[10px] font-bold text-[#faf6f0]/46">${distanceText(current, risk)}</p></div>`}
      ${target === null ? "" : `<div class="rounded-2xl border border-emerald-300/18 bg-emerald-300/8 px-3 py-2"><p class="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-200/80">Take profit</p><p class="mt-1 text-[18px] font-black text-emerald-100">${formatMoney(target, currency)}</p><p class="mt-1 text-[10px] font-bold text-[#faf6f0]/46">${distanceText(current, target)}</p></div>`}
    </div>
  `;

  metricGrid.insertAdjacentElement("afterend", card);
}

function patchManageTradeLevels() {
  const dialogs = document.querySelectorAll(".stockgpt-manage-holding-dialog");
  dialogs.forEach((dialog) => {
    if (dialog.getAttribute("data-stockgpt-levels-loading") === "true") return;
    if (dialog.querySelector("[data-stockgpt-trade-level-card]")) return;

    const ticker = cleanTicker(dialog.querySelector("h3")?.textContent);
    if (!ticker) return;

    dialog.setAttribute("data-stockgpt-levels-loading", "true");
    fetch(`/api/portfolio/holding-trade-levels?ticker=${encodeURIComponent(ticker)}`, { headers: { Accept: "application/json" } })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data?.levels) insertTradeLevelCard(dialog, data.levels);
      })
      .catch(() => null)
      .finally(() => dialog.removeAttribute("data-stockgpt-levels-loading"));
  });
}

export function PortfolioHoldingClickPatch() {
  useEffect(() => {
    function runPatches() {
      patchHoldingTitles();
      patchAskStockGPTCloseButton();
      removeBrokenMarkdownTables();
      patchManageTradeLevels();
    }

    runPatches();
    const observer = new MutationObserver(runPatches);
    observer.observe(document.body, { childList: true, subtree: true });

    function onClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const askClose = target.closest(".stockgpt-ask-close-button");
      if (askClose) {
        event.preventDefault();
        event.stopPropagation();
        window.location.assign("/portfolio");
        return;
      }

      if (target.closest("button, a, input, select, textarea")) return;

      const nameArea = findHoldingNameArea(target);
      if (!nameArea) return;

      const row = nameArea.closest("div.group.relative.overflow-hidden");
      if (!row) return;

      const ticker = findTicker(nameArea);
      if (!ticker) return;

      window.location.assign(`/stock/${ticker}`);
    }

    document.addEventListener("click", onClick, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return null;
}
