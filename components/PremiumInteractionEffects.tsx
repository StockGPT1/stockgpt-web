"use client";

import { useEffect } from "react";

const INTERACTIVE_SELECTOR = [
  ".sg-app-shell a[href]",
  ".sg-app-shell button:not(:disabled)",
  ".sg-app-shell [role='button']",
].join(",");

const HIGHLIGHT_SELECTOR = [
  ".sg-app-shell article",
  ".sg-app-shell section > div",
  ".sg-app-shell [class*='rounded-2xl']",
  ".sg-app-shell [class*='rounded-3xl']",
].join(",");

function classText(element: HTMLElement) {
  return typeof element.className === "string" ? element.className : "";
}

function shouldSkipElement(element: HTMLElement) {
  const tagName = element.tagName.toLowerCase();
  const classes = classText(element);

  if (element.closest(".sg-no-premium")) return true;
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }

  if (classes.includes("absolute") || classes.includes("fixed")) {
    return true;
  }

  if (tagName === "svg") return true;

  return false;
}

function shouldSkipHighlight(element: HTMLElement) {
  const tagName = element.tagName.toLowerCase();
  const classes = classText(element);

  if (shouldSkipElement(element)) return true;
  if (element.classList.contains("sg-premium-hover")) return true;
  if (["a", "button", "input", "textarea", "select", "svg"].includes(tagName)) {
    return true;
  }

  const looksLikeCard =
    classes.includes("rounded") &&
    (classes.includes("bg-") ||
      classes.includes("border") ||
      classes.includes("shadow") ||
      classes.includes("backdrop"));

  return !looksLikeCard;
}

function setPointerVars(element: HTMLElement, event: MouseEvent) {
  const rect = element.getBoundingClientRect();

  if (rect.width === 0 || rect.height === 0) return;

  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;

  element.style.setProperty("--sg-mx", `${x}%`);
  element.style.setProperty("--sg-my", `${y}%`);
}

export function PremiumInteractionEffects() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".sg-app-shell");

    if (!root) {
      return undefined;
    }

    const appRoot: HTMLElement = root;
    const cleanupMap = new Map<HTMLElement, () => void>();

    function enhance(element: HTMLElement, className: string) {
      if (cleanupMap.has(element)) return;
      if (shouldSkipElement(element)) return;

      element.classList.add(className);

      const handleMove = (event: MouseEvent) => {
        setPointerVars(element, event);
      };

      element.addEventListener("mousemove", handleMove);

      cleanupMap.set(element, () => {
        element.removeEventListener("mousemove", handleMove);
        element.classList.remove(className);
      });
    }

    function scan() {
      appRoot
        .querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR)
        .forEach((node) => {
          if (!shouldSkipElement(node)) {
            enhance(node, "sg-premium-hover");
          }
        });

      appRoot
        .querySelectorAll<HTMLElement>(HIGHLIGHT_SELECTOR)
        .forEach((node) => {
          if (!shouldSkipHighlight(node)) {
            enhance(node, "sg-premium-hover");
          }
        });
    }

    scan();

    const observer = new MutationObserver(() => {
      scan();
    });

    observer.observe(appRoot, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      cleanupMap.forEach((cleanup) => cleanup());
      cleanupMap.clear();
    };
  }, []);

  return null;
}
