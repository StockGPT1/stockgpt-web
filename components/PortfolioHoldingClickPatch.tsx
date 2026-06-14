"use client";

import { useEffect } from "react";

function cleanTicker(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, "");
}

function activePortfolioIdFromUrl() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("portfolio")?.trim() ?? "";
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

function detectCurrency(text: string | null | undefined) {
  if (String(text ?? "").includes("£")) return "GBP";
  if (String(text ?? "").includes("€")) return "EUR";
  return "USD";
}

function parseMoneyText(text: string | null | undefined) {
  const cleaned = String(text ?? "").replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value: unknown, currency = "USD") {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2,
  }).format(n);
}

function savedLevel(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function savedScore(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function formatScore(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
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

function patchMobileNewPortfolioButton() {
  if (typeof window === "undefined" || !window.location.pathname.startsWith("/portfolio")) return;
  if (document.querySelector("[data-stockgpt-mobile-new-portfolio]")) return;

  const holdingsButton = document.querySelector<HTMLButtonElement>('button[aria-label="Holdings"]');
  const nav = holdingsButton?.parentElement;
  if (!nav) return;

  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-stockgpt-mobile-new-portfolio", "true");
  wrapper.className = "sm:hidden px-1";
  wrapper.innerHTML = `<a href="/portfolio?builder=1" class="mt-2 inline-flex h-10 w-full items-center justify-center rounded-full bg-[#ddb159] px-4 text-[11px] font-black uppercase tracking-[0.14em] text-[#072116] no-underline shadow-[0_10px_24px_rgba(0,0,0,0.16)]">+ New portfolio</a>`;
  nav.insertAdjacentElement("afterend", wrapper);
}

function insertOriginalScore(dialog: Element, originalScore: unknown) {
  const score = savedScore(originalScore);
  if (score === null) return;

  const metricGrid = dialog.querySelector("div.grid.grid-cols-2.gap-2");
  if (!metricGrid) return;

  const scoreCard = Array.from(metricGrid.children).find((card) => {
    const label = card.querySelector("p:first-child")?.textContent?.trim().toUpperCase();
    return label === "SCORE";
  });

  if (!scoreCard || scoreCard.querySelector("[data-stockgpt-original-score]")) return;

  const original = document.createElement("p");
  original.setAttribute("data-stockgpt-original-score", "true");
  original.className = "mt-1 text-[10px] font-bold text-[#faf6f0]/46";
  original.textContent = `original score - ${formatScore(score)}`;
  scoreCard.appendChild(original);
}

function insertTradeLevelCard(dialog: Element, levels: any) {
  if (dialog.querySelector("[data-stockgpt-trade-level-card]")) return;
  const metricGrid = dialog.querySelector("div.grid.grid-cols-2.gap-2");
  if (!metricGrid) return;

  const currency = String(levels?.currency ?? "USD");
  const risk = savedLevel(levels?.risk_level_at_entry);
  const target = savedLevel(levels?.target_level_at_entry);
  const current = savedLevel(levels?.current_price);
  if (risk === null && target === null) return;

  const card = document.createElement("div");
  card.setAttribute("data-stockgpt-trade-level-card", "true");
  card.className = "rounded-2xl border border-[#ddb159]/16 bg-[#faf6f0]/[0.045] p-3";
  card.innerHTML = `
    <p class="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">Buy-time trade levels</p>
    <p class="mt-1 text-[12px] font-semibold leading-5 text-[#faf6f0]/58">These are the saved stop-loss and take-profit levels for this holding in this specific portfolio. Manual holdings without saved levels show nothing here and do not create SL/TP alerts.</p>
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

    const ticker = cleanTicker(dialog.querySelector("h3")?.textContent);
    if (!ticker) return;

    const params = new URLSearchParams({ ticker });
    const portfolioId = activePortfolioIdFromUrl();
    if (portfolioId) params.set("portfolioId", portfolioId);

    dialog.setAttribute("data-stockgpt-levels-loading", "true");
    fetch(`/api/portfolio/holding-trade-levels?${params.toString()}`, { headers: { Accept: "application/json" } })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        insertOriginalScore(dialog, data?.original_score_at_entry);
        if (data?.levels) insertTradeLevelCard(dialog, data.levels);
      })
      .catch(() => null)
      .finally(() => dialog.removeAttribute("data-stockgpt-levels-loading"));
  });
}

function getPortfolioHeroNodes() {
  const hero = document.querySelector<HTMLElement>(".portfolio-chart-hero");
  if (!hero) return null;
  const valueNode = hero.querySelector<HTMLElement>("h1");
  const returnNode = valueNode?.nextElementSibling instanceof HTMLElement ? valueNode.nextElementSibling : null;
  if (!valueNode || !returnNode) return null;
  return { hero, valueNode, returnNode };
}

function resetPortfolioHeroDefaults(hero: HTMLElement) {
  delete hero.dataset.stockgptDefaultValue;
  delete hero.dataset.stockgptDefaultReturn;
  delete hero.dataset.stockgptDefaultReturnClass;
  delete hero.dataset.stockgptCostBasis;
  delete hero.dataset.stockgptCurrency;
}

function rememberPortfolioHeroDefaults() {
  const nodes = getPortfolioHeroNodes();
  if (!nodes) return;
  const { hero, valueNode, returnNode } = nodes;
  const valueText = valueNode.textContent ?? "";
  const returnText = returnNode.textContent ?? "";
  const isScrubbing = hero.dataset.stockgptScrubbing === "true";

  if (!isScrubbing && hero.dataset.stockgptDefaultValue && hero.dataset.stockgptDefaultValue !== valueText) {
    resetPortfolioHeroDefaults(hero);
  }
  if (!isScrubbing && hero.dataset.stockgptDefaultReturn && hero.dataset.stockgptDefaultReturn !== returnText) {
    resetPortfolioHeroDefaults(hero);
  }

  if (!hero.dataset.stockgptDefaultValue) hero.dataset.stockgptDefaultValue = valueText;
  if (!hero.dataset.stockgptDefaultReturn) hero.dataset.stockgptDefaultReturn = returnText;
  if (!hero.dataset.stockgptDefaultReturnClass) hero.dataset.stockgptDefaultReturnClass = returnNode.className;
  if (!hero.dataset.stockgptCostBasis) {
    const totalValue = parseMoneyText(hero.dataset.stockgptDefaultValue);
    const totalReturn = parseMoneyText((hero.dataset.stockgptDefaultReturn ?? "").split(" total return")[0]);
    hero.dataset.stockgptCostBasis = String(totalValue - totalReturn);
    hero.dataset.stockgptCurrency = detectCurrency(hero.dataset.stockgptDefaultValue);
  }
}

function setPortfolioHeroFromPoint(close: number | null) {
  const nodes = getPortfolioHeroNodes();
  if (!nodes) return;
  const { hero, valueNode, returnNode } = nodes;
  rememberPortfolioHeroDefaults();

  if (close == null || !Number.isFinite(close)) {
    valueNode.textContent = hero.dataset.stockgptDefaultValue ?? valueNode.textContent;
    returnNode.textContent = hero.dataset.stockgptDefaultReturn ?? returnNode.textContent;
    returnNode.className = hero.dataset.stockgptDefaultReturnClass ?? returnNode.className;
    delete hero.dataset.stockgptScrubbing;
    return;
  }

  hero.dataset.stockgptScrubbing = "true";
  const currency = hero.dataset.stockgptCurrency ?? "USD";
  const costBasis = Number(hero.dataset.stockgptCostBasis ?? "0");
  const pnl = close - costBasis;
  const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

  valueNode.textContent = formatMoney(close, currency);
  returnNode.textContent = `${formatMoney(pnl, currency)} total return · ${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(1)}%`;
  returnNode.classList.remove("text-emerald-300", "text-red-200");
  returnNode.classList.add(pnl >= 0 ? "text-emerald-300" : "text-red-200");
}

function recommendedTrimPercent(dialog: Element) {
  const text = dialog.textContent ?? "";
  const match = text.match(/Trim and reinvest:\s*([0-9]+(?:\.[0-9]+)?)%/i);
  const value = Number(match?.[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function recommendedReinvestmentTicker(dialog: Element) {
  const paragraphs = Array.from(dialog.querySelectorAll("p"));
  const header = paragraphs.find((paragraph) =>
    (paragraph.textContent ?? "").trim().toLowerCase().startsWith("reinvestment candidate"),
  );
  const block = header?.parentElement;
  const tickerLine = block
    ? Array.from(block.querySelectorAll("p")).find((paragraph) => {
        if (paragraph === header) return false;
        const firstWord = paragraph.textContent?.trim().split(/\s+/)[0] ?? "";
        const ticker = cleanTicker(firstWord);
        return ticker.length > 0 && ticker.length <= 8;
      })
    : null;
  return cleanTicker(tickerLine?.textContent?.trim().split(/\s+/)[0]);
}

async function trimAndReinvestFromButton(button: HTMLButtonElement) {
  const dialog = button.closest(".stockgpt-manage-holding-dialog");
  if (!dialog) return false;

  const ticker = cleanTicker(dialog.querySelector("h3")?.textContent);
  const reinvestTicker = recommendedReinvestmentTicker(dialog);
  const percentage = recommendedTrimPercent(dialog);
  if (!ticker || !reinvestTicker || !percentage) return false;

  const portfolioId = activePortfolioIdFromUrl();

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "Reinvesting…";
  try {
    const response = await fetch("/api/portfolio/trim-and-reinvest", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ ticker, percentage, reinvestTicker, portfolioId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.success === false) {
      window.alert(data?.error ?? "Could not trim and reinvest.");
      return true;
    }
    window.location.reload();
    return true;
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

export function PortfolioHoldingClickPatch() {
  useEffect(() => {
    function runPatches() {
      patchHoldingTitles();
      patchAskStockGPTCloseButton();
      removeBrokenMarkdownTables();
      patchMobileNewPortfolioButton();
      patchManageTradeLevels();
      rememberPortfolioHeroDefaults();
    }

    runPatches();
    const observer = new MutationObserver(runPatches);
    observer.observe(document.body, { childList: true, subtree: true });

    function onChartScrub(event: Event) {
      const detail = (event as CustomEvent).detail ?? {};
      if (detail?.ticker !== "Portfolio") return;
      if (!detail?.active) {
        setPortfolioHeroFromPoint(null);
        return;
      }
      const close = Number(detail?.point?.close);
      setPortfolioHeroFromPoint(Number.isFinite(close) ? close : null);
    }

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

      const trimButton = target.closest("button");
      const dialog = trimButton?.closest(".stockgpt-manage-holding-dialog") ?? null;
      if (
        trimButton instanceof HTMLButtonElement &&
        dialog &&
        trimButton.textContent?.trim() === "Trim and reinvest" &&
        recommendedTrimPercent(dialog) &&
        recommendedReinvestmentTicker(dialog)
      ) {
        event.preventDefault();
        event.stopPropagation();
        void trimAndReinvestFromButton(trimButton);
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

    window.addEventListener("stockgpt:portfolio-chart-scrub", onChartScrub);
    document.addEventListener("click", onClick, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("stockgpt:portfolio-chart-scrub", onChartScrub);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return null;
}
