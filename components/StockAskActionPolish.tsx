"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

function normaliseText(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function contextualLabel(link: HTMLAnchorElement, ticker: string) {
  const base = `Ask StockGPT about ${ticker}`;
  const href = link.getAttribute("href") ?? "";
  const locked = link.dataset.locked === "true";

  if (!locked) return base;
  if (href.startsWith("/subscription")) return `Unlock ${base}`;
  return `Sign in to ${base}`;
}

function prepareAskLink(
  link: HTMLAnchorElement,
  ticker: string,
  placement: "mobile" | "desktop",
) {
  const label = contextualLabel(link, ticker);
  const text = link.querySelector<HTMLElement>("span");

  if (text && normaliseText(text.textContent) !== label) text.textContent = label;
  link.setAttribute("aria-label", label);
  link.dataset.sgStockAsk = placement;
}

function findStockActionsSection(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>("section")).find((section) => {
    const copy = normaliseText(section.textContent).toLowerCase();
    return copy.includes("compare stock") && copy.includes("view peers");
  }) ?? null;
}

function findAskLink(root: ParentNode, ticker: string) {
  const tickerLower = ticker.toLowerCase();
  return (
    Array.from(root.querySelectorAll<HTMLAnchorElement>("a")).find((link) => {
      const copy = normaliseText(link.textContent).toLowerCase();
      return copy.includes("ask") && copy.includes(tickerLower);
    }) ?? null
  );
}

export function StockAskActionPolish() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.startsWith("/stock/")) return;

    const ticker = decodeURIComponent(pathname.split("/")[2] ?? "")
      .trim()
      .toUpperCase();
    if (!ticker) return;

    let frame = 0;
    let retryTimer = 0;

    const apply = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const main = document.querySelector<HTMLElement>("main");
        const root = main?.querySelector<HTMLElement>(":scope > div.grid");
        if (!main || !root) return;

        const secondaryActions = findStockActionsSection(root);
        const mobileAsk = secondaryActions
          ? findAskLink(secondaryActions, ticker)
          : null;

        const chartLabel = Array.from(root.querySelectorAll<HTMLElement>("p")).find(
          (node) => normaliseText(node.textContent).toLowerCase() === "price chart",
        );
        const chartSection = chartLabel?.closest<HTMLElement>("section") ?? null;

        if (mobileAsk && chartSection) {
          prepareAskLink(mobileAsk, ticker, "mobile");

          let mobileWrapper = root.querySelector<HTMLElement>(
            ":scope > [data-sg-stock-ask-mobile-wrapper]",
          );
          if (!mobileWrapper) {
            mobileWrapper = document.createElement("div");
            mobileWrapper.dataset.sgStockAskMobileWrapper = "true";
          }

          const originalCell = mobileAsk.parentElement;
          if (!mobileWrapper.contains(mobileAsk)) mobileWrapper.appendChild(mobileAsk);
          if (chartSection.nextElementSibling !== mobileWrapper) {
            chartSection.insertAdjacentElement("afterend", mobileWrapper);
          }

          if (
            originalCell &&
            originalCell !== secondaryActions &&
            originalCell !== mobileWrapper &&
            originalCell.children.length === 0
          ) {
            originalCell.remove();
          }

          secondaryActions.dataset.sgStockSecondaryActions = "true";
        }

        const appHeader = document.querySelector<HTMLElement>(".sg-app-header");
        const desktopAsk = appHeader ? findAskLink(appHeader, ticker) : null;
        const hero = Array.from(root.children).find((child) => {
          if (!(child instanceof HTMLElement) || child.tagName !== "SECTION") return false;
          return normaliseText(child.querySelector("h1")?.textContent) === ticker;
        }) as HTMLElement | undefined;
        const watchlistButton = hero
          ? Array.from(hero.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
              normaliseText(button.textContent).toLowerCase().includes("watchlist"),
            )
          : null;
        const heroActions = watchlistButton?.parentElement ?? null;

        if (desktopAsk && heroActions) {
          prepareAskLink(desktopAsk, ticker, "desktop");
          if (!heroActions.contains(desktopAsk)) heroActions.appendChild(desktopAsk);
          heroActions.dataset.sgStockHeroActions = "true";
        }
      });
    };

    apply();
    retryTimer = window.setTimeout(apply, 180);

    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.addedNodes.length || mutation.removedNodes.length)) {
        apply();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.clearTimeout(retryTimer);
    };
  }, [pathname]);

  return null;
}
