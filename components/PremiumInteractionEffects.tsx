"use client";

import { useEffect } from "react";

const INTERACTIVE_SELECTOR = [
  ".sg-app-shell a[href]",
  ".sg-app-shell button:not(:disabled)",
  ".sg-app-shell [role='button']",
].join(",");

const CARD_SELECTOR = [
  ".sg-app-shell article",
  ".sg-app-shell section > div",
  ".sg-app-shell [class*='rounded-2xl']",
  ".sg-app-shell [class*='rounded-3xl']",
].join(",");

function classText(element: HTMLElement) {
  return typeof element.className === "string" ? element.className : "";
}

function shouldSkipInteractive(element: HTMLElement) {
  const tagName = element.tagName.toLowerCase();
  const classes = classText(element);

  if (element.closest(".sg-no-premium")) return true;
  if (element.closest("input, textarea, select")) return true;
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }

  if (classes.includes("absolute") || classes.includes("fixed")) {
    return true;
  }

  if (tagName === "a" && element.querySelector("img")) {
    return true;
  }

  return false;
}

function shouldSkipCard(element: HTMLElement) {
  const tagName = element.tagName.toLowerCase();
  const classes = classText(element);

  if (element.closest(".sg-no-premium")) return true;
  if (element.classList.contains("sg-premium-interactive")) return true;
  if (["a", "button", "input", "textarea", "select", "svg"].includes(tagName)) {
    return true;
  }

  if (classes.includes("absolute") || classes.includes("fixed")) {
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

  const tiltX = ((event.clientY - rect.top) / rect.height - 0.5) * -4;
  const tiltY = ((event.clientX - rect.left) / rect.width - 0.5) * 4;

  element.style.setProperty("--sg-tilt-x", `${tiltX}deg`);
  element.style.setProperty("--sg-tilt-y", `${tiltY}deg`);
}

function resetPointerVars(element: HTMLElement) {
  element.style.setProperty("--sg-tilt-x", "0deg");
  element.style.setProperty("--sg-tilt-y", "0deg");
}

export function PremiumInteractionEffects() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".sg-app-shell");

    if (!root) {
      return undefined;
    }

    const appRoot: HTMLElement = root;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const cleanupMap = new Map<HTMLElement, () => void>();

    function enhanceInteractive(element: HTMLElement) {
      if (cleanupMap.has(element)) return;
      if (shouldSkipInteractive(element)) return;

      element.classList.add("sg-premium-interactive");

      if (reduceMotion) {
        cleanupMap.set(element, () => {
          element.classList.remove("sg-premium-interactive");
        });
        return;
      }

      const handleMove = (event: MouseEvent) => {
        setPointerVars(element, event);
      };

      const handleLeave = () => {
        resetPointerVars(element);
      };

      element.addEventListener("mousemove", handleMove);
      element.addEventListener("mouseleave", handleLeave);

      cleanupMap.set(element, () => {
        element.removeEventListener("mousemove", handleMove);
        element.removeEventListener("mouseleave", handleLeave);
        element.classList.remove("sg-premium-interactive");
      });
    }

    function enhanceCard(element: HTMLElement) {
      if (cleanupMap.has(element)) return;
      if (shouldSkipCard(element)) return;

      element.classList.add("sg-premium-card");

      if (reduceMotion) {
        cleanupMap.set(element, () => {
          element.classList.remove("sg-premium-card");
        });
        return;
      }

      const handleMove = (event: MouseEvent) => {
        setPointerVars(element, event);
      };

      const handleLeave = () => {
        resetPointerVars(element);
      };

      element.addEventListener("mousemove", handleMove);
      element.addEventListener("mouseleave", handleLeave);

      cleanupMap.set(element, () => {
        element.removeEventListener("mousemove", handleMove);
        element.removeEventListener("mouseleave", handleLeave);
        element.classList.remove("sg-premium-card");
      });
    }

    function scan() {
      appRoot
        .querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR)
        .forEach((node) => {
          enhanceInteractive(node);
        });

      appRoot.querySelectorAll<HTMLElement>(CARD_SELECTOR).forEach((node) => {
        enhanceCard(node);
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
