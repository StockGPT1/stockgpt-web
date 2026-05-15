"use client";

import { useEffect } from "react";

const CLICKABLE_SELECTOR = [
  ".sg-app-shell a[href]",
  ".sg-app-shell button:not(:disabled)",
  ".sg-app-shell [role='button']",
].join(",");

function classText(element: HTMLElement) {
  return typeof element.className === "string" ? element.className : "";
}

function shouldSkipClickable(element: HTMLElement) {
  const tagName = element.tagName.toLowerCase();
  const classes = classText(element);

  if (element.closest(".sg-no-premium")) return true;

  if (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    tagName === "svg"
  ) {
    return true;
  }

  if (classes.includes("absolute") || classes.includes("fixed")) {
    return true;
  }

  return false;
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

    function enhance(element: HTMLElement) {
      if (cleanupMap.has(element)) return;
      if (shouldSkipClickable(element)) return;

      element.classList.add("sg-premium-hover");

      const handleMove = (event: MouseEvent) => {
        setPointerVars(element, event);
      };

      element.addEventListener("mousemove", handleMove);

      cleanupMap.set(element, () => {
        element.removeEventListener("mousemove", handleMove);
        element.classList.remove("sg-premium-hover");
      });
    }

    function scan() {
      appRoot
        .querySelectorAll<HTMLElement>(CLICKABLE_SELECTOR)
        .forEach((node) => {
          enhance(node);
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
