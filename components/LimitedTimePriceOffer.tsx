"use client";

import { useEffect } from "react";

const ORIGINAL_PRICE = "£18.99";
const OFFER_PRICE = "£4.99";

function replacePriceText(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const matches: Text[] = [];

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.nodeValue?.trim() === ORIGINAL_PRICE) matches.push(node);
  }

  for (const node of matches) {
    const parent = node.parentElement;
    if (
      !parent ||
      parent.dataset.limitedOfferPrice === "true" ||
      parent.closest('[data-limited-offer-price="true"]')
    ) {
      continue;
    }

    parent.dataset.limitedOfferPrice = "true";
    parent.setAttribute(
      "aria-label",
      `Limited-time exclusive offer: ${OFFER_PRICE} per month, normally ${ORIGINAL_PRICE}`,
    );
    parent.textContent = "";

    const original = document.createElement("span");
    original.className = "sg-limited-offer-original";
    original.textContent = ORIGINAL_PRICE;
    original.setAttribute("aria-hidden", "true");

    const current = document.createElement("span");
    current.className = "sg-limited-offer-current";
    current.textContent = OFFER_PRICE;
    current.setAttribute("aria-hidden", "true");

    parent.append(original, current);

    const badge = document.createElement("span");
    badge.className = "sg-limited-offer-badge";
    badge.textContent = "Limited-time exclusive offer";
    badge.setAttribute("aria-hidden", "true");
    parent.insertAdjacentElement("afterend", badge);
  }
}

function replaceOfferCopy(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const replacements = new Map([
    [
      "50% off your first month will be applied automatically in Stripe Checkout.",
      "Your £4.99 limited-time monthly price will be applied automatically in Stripe Checkout.",
    ],
    [
      "Flexible monthly access to the current Core platform.",
      "Limited-time monthly access to the current Core platform. Cancel anytime.",
    ],
  ]);

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const value = node.nodeValue?.trim();
    if (value && replacements.has(value)) {
      node.nodeValue = replacements.get(value) ?? node.nodeValue;
    }
  }
}

function applyOffer(root: ParentNode) {
  replacePriceText(root);
  replaceOfferCopy(root);
}

export function LimitedTimePriceOffer() {
  useEffect(() => {
    applyOffer(document.body);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) applyOffer(node);
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
