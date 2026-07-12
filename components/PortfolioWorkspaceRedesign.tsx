"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

type Cleanup = () => void;

function text(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function findByText<T extends HTMLElement>(
  root: ParentNode,
  selector: string,
  matcher: (value: string) => boolean,
) {
  return Array.from(root.querySelectorAll<T>(selector)).find((node) =>
    matcher(text(node.textContent).toLowerCase()),
  );
}

function closestPanel(node: HTMLElement | null | undefined) {
  return node?.closest<HTMLElement>("section, [role='region'], div.grid") ?? null;
}

function parseNumber(value: string) {
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function buildMetric(label: string, value: string, detail: string) {
  const item = document.createElement("div");
  item.className = "sg-portfolio-change-item";
  item.innerHTML = `<span>${label}</span><strong>${value}</strong><small>${detail}</small>`;
  return item;
}

function findHoldingRows(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>("div, article, li")).filter((node) => {
    const copy = text(node.textContent).toLowerCase();
    if (!copy.includes("of total portfolio")) return false;
    if (!copy.includes("ai #") && !copy.includes("price unavailable")) return false;
    return !Array.from(node.children).some((child) =>
      text(child.textContent).toLowerCase().includes("of total portfolio") &&
      text(child.textContent).toLowerCase().includes("ai #"),
    );
  });
}

function buildExposureMap(root: HTMLElement, rows: HTMLElement[]) {
  if (root.querySelector("[data-sg-exposure-map]")) return;
  const points = rows
    .map((row) => {
      const copy = text(row.textContent);
      const allocationMatch = copy.match(/([0-9]+(?:\.[0-9]+)?)%\s+of total portfolio/i);
      const aiMatch = copy.match(/AI\s*#?\d*\s*[·•]\s*([0-9,]+)/i);
      const tickerMatch = copy.match(/\b([A-Z]{1,6}(?:\.[A-Z])?)\s*[·•]/);
      const allocation = allocationMatch ? Number(allocationMatch[1]) : null;
      const score = aiMatch ? Number(aiMatch[1].replace(/,/g, "")) : null;
      const ticker = tickerMatch?.[1] ?? text(row.querySelector("h2,h3,strong")?.textContent).slice(0, 6);
      if (!ticker || allocation == null || score == null) return null;
      return { row, ticker, allocation, score };
    })
    .filter((point): point is NonNullable<typeof point> => Boolean(point));

  if (points.length < 2) return;

  const section = document.createElement("section");
  section.dataset.sgExposureMap = "true";
  section.className = "sg-portfolio-exposure-map";
  section.innerHTML = `
    <header>
      <div><span>Portfolio construction</span><h2>Conviction × exposure</h2></div>
      <p>Large positions sit further right. Stronger AI conviction sits higher.</p>
    </header>
    <div class="sg-exposure-canvas" role="img" aria-label="Portfolio holdings plotted by allocation and AI conviction">
      <span class="sg-axis sg-axis-y">Higher conviction</span>
      <span class="sg-axis sg-axis-x">Larger allocation →</span>
      <div class="sg-quadrant sg-quadrant-a">Underweight ideas</div>
      <div class="sg-quadrant sg-quadrant-b">Core conviction</div>
      <div class="sg-quadrant sg-quadrant-c">Watch closely</div>
      <div class="sg-quadrant sg-quadrant-d">Concentration risk</div>
    </div>`;

  const canvas = section.querySelector<HTMLElement>(".sg-exposure-canvas");
  if (!canvas) return;
  const allocations = points.map((point) => point.allocation);
  const scores = points.map((point) => point.score);
  const maxAllocation = Math.max(...allocations, 1);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores, minScore + 1);

  points.forEach((point, index) => {
    const bubble = document.createElement("button");
    bubble.type = "button";
    bubble.className = "sg-exposure-bubble";
    bubble.textContent = point.ticker;
    const x = 10 + (point.allocation / maxAllocation) * 78;
    const y = 84 - ((point.score - minScore) / (maxScore - minScore)) * 68;
    const size = Math.max(46, Math.min(74, 44 + point.allocation * 1.2));
    bubble.style.left = `${x}%`;
    bubble.style.top = `${y}%`;
    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    bubble.style.zIndex = String(10 + index);
    bubble.setAttribute(
      "aria-label",
      `${point.ticker}, ${point.allocation.toFixed(1)} percent allocation, AI score ${Math.round(point.score)}`,
    );
    bubble.addEventListener("click", () => {
      point.row.scrollIntoView({ behavior: "smooth", block: "center" });
      point.row.animate(
        [
          { backgroundColor: "rgba(221,177,89,0.16)" },
          { backgroundColor: "rgba(221,177,89,0.03)" },
        ],
        { duration: 900, easing: "ease-out" },
      );
    });
    canvas.appendChild(bubble);
  });

  const opportunities = root.querySelector<HTMLElement>("[data-sg-portfolio-opportunities]");
  const pulse = root.querySelector<HTMLElement>("[data-sg-portfolio-pulse]");
  (opportunities ?? pulse)?.insertAdjacentElement("afterend", section);
}

function applyPortfolioWorkspace(): Cleanup {
  const main = document.querySelector<HTMLElement>("main");
  const root = main?.querySelector<HTMLElement>("#portfolio-check > div");
  if (!main || !root) return () => {};

  main.dataset.portfolioWorkspace = "true";
  root.dataset.portfolioWorkspaceRoot = "true";

  const stage = root.querySelector<HTMLElement>(".portfolio-chart-hero");
  if (stage) stage.dataset.sgPortfolioStage = "true";

  const navs = Array.from(root.querySelectorAll<HTMLElement>(".portfolio-section-nav"));
  navs.forEach((nav) => {
    nav.dataset.sgPortfolioTabs = "true";
    const buttons = Array.from(nav.querySelectorAll<HTMLButtonElement>("button"));
    buttons.forEach((button) => {
      const label = text(button.textContent).toLowerCase();
      if (label === "add" || label === "manage") button.dataset.sgUtilityTab = "true";
      else button.dataset.sgPrimaryTab = "true";
    });
  });

  const visibleNav = navs.find((nav) => getComputedStyle(nav).display !== "none") ?? navs[0];
  const allButtons = Array.from(root.querySelectorAll<HTMLButtonElement>(".portfolio-section-nav button"));
  const addButton = allButtons.find((button) => text(button.textContent).toLowerCase() === "add");
  const manageButton = allButtons.find((button) => text(button.textContent).toLowerCase() === "manage");

  if (visibleNav && !root.querySelector("[data-sg-portfolio-actions]")) {
    const actions = document.createElement("div");
    actions.dataset.sgPortfolioActions = "true";
    actions.className = "sg-portfolio-actions";
    actions.innerHTML = `
      <button type="button" data-action="add" aria-label="Add to portfolio"><span aria-hidden="true">+</span><b>Add</b></button>
      <button type="button" data-action="manage" aria-label="Manage portfolio"><span aria-hidden="true">•••</span><b>Manage</b></button>`;
    actions.querySelector<HTMLButtonElement>("[data-action='add']")?.addEventListener("click", () => addButton?.click());
    actions.querySelector<HTMLButtonElement>("[data-action='manage']")?.addEventListener("click", () => manageButton?.click());
    visibleNav.insertAdjacentElement("afterend", actions);
  }

  const pulseLabel = findByText<HTMLElement>(root, "p", (copy) => copy === "stockgpt view");
  const pulse = closestPanel(pulseLabel);
  if (pulse) pulse.dataset.sgPortfolioPulse = "true";

  const opportunitiesLabel = findByText<HTMLElement>(root, "h2,h3,p", (copy) =>
    copy.includes("portfolio-fit") || copy.includes("opportunities for your portfolio"),
  );
  const opportunities = closestPanel(opportunitiesLabel);
  if (opportunities) opportunities.dataset.sgPortfolioOpportunities = "true";

  const healthLabel = findByText<HTMLElement>(root, "p,h2,h3", (copy) => copy === "health drivers");
  const health = closestPanel(healthLabel);
  if (health) health.dataset.sgPortfolioDiagnostics = "true";

  const holdingsLabels = Array.from(root.querySelectorAll<HTMLElement>("p,h2,h3")).filter((node) => {
    const copy = text(node.textContent).toLowerCase();
    return copy === "top holdings" || copy === "holdings";
  });
  holdingsLabels.forEach((label) => {
    const panel = closestPanel(label);
    if (panel) panel.dataset.sgHoldingsLedger = "true";
  });

  const activityRows = Array.from(root.querySelectorAll<HTMLElement>("div"));
  activityRows.forEach((row) => {
    const copy = text(row.textContent).toLowerCase();
    if (["cash deposit", "cash withdrawal", "bought", "sold", "import", "logged holding"].some((item) => copy.startsWith(item))) {
      row.dataset.sgActivityEvent = "true";
    }
  });

  if (stage && !root.querySelector("[data-sg-since-visit]")) {
    const value = text(stage.querySelector("h1")?.textContent) || "—";
    const returnLine = text(Array.from(stage.querySelectorAll("p")).find((node) => text(node.textContent).includes("total return"))?.textContent) || "No confirmed change";
    const alerts = health ? text(Array.from(health.querySelectorAll("p")).find((node) => /alerts/i.test(text(node.textContent)))?.parentElement?.textContent) : "";
    const largest = health ? text(Array.from(health.querySelectorAll("p")).find((node) => /largest/i.test(text(node.textContent)))?.parentElement?.textContent) : "";
    const strip = document.createElement("section");
    strip.dataset.sgSinceVisit = "true";
    strip.className = "sg-portfolio-since";
    strip.innerHTML = `<header><span>Portfolio briefing</span><h2>At a glance</h2></header><div class="sg-portfolio-change-strip"></div>`;
    const track = strip.querySelector<HTMLElement>(".sg-portfolio-change-strip");
    track?.append(
      buildMetric("Current value", value, "Latest confirmed valuation"),
      buildMetric("Total return", returnLine.replace(/total return/i, "").trim(), "Contribution-adjusted"),
      buildMetric("Reviews", parseNumber(alerts ?? "")?.toString() ?? "—", "Items needing attention"),
      buildMetric("Largest position", largest.match(/[0-9]+(?:\.[0-9]+)?%/)?.[0] ?? "—", "Current concentration"),
    );
    visibleNav?.insertAdjacentElement("afterend", strip);
  }

  const holdingRows = findHoldingRows(root);
  holdingRows.forEach((row) => (row.dataset.sgHoldingRow = "true"));
  buildExposureMap(root, holdingRows);

  const topBar = root.firstElementChild;
  if (topBar instanceof HTMLElement && !topBar.classList.contains("portfolio-chart-hero")) {
    topBar.dataset.sgPortfolioTopbar = "true";
  }

  return () => {};
}

export function PortfolioWorkspaceRedesign() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.startsWith("/portfolio")) return;

    let cleanup: Cleanup = () => {};
    let frame = 0;
    let timer = 0;
    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        cleanup();
        cleanup = applyPortfolioWorkspace();
      });
    };

    run();
    timer = window.setTimeout(run, 250);
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.addedNodes.length || mutation.removedNodes.length)) run();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      cleanup();
    };
  }, [pathname]);

  return null;
}
