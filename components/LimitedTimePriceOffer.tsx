"use client";

import { useEffect } from "react";
import { offerSeatsLeft } from "@/lib/limited-offer";

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

    const seatsLeft = offerSeatsLeft();
    parent.dataset.limitedOfferPrice = "true";
    parent.setAttribute(
      "aria-label",
      `Offer for the next 500 members: ${OFFER_PRICE} per month, normally ${ORIGINAL_PRICE}. ${seatsLeft} spots left.`,
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
    badge.textContent = `Next 500 members — ${seatsLeft} left`;
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
      "Founding rate for the next 500 members. Full Core access, cancel anytime.",
    ],
    ["Best value — 2 months free", "Annual plan"],
    [
      "Annual access with the same Core features, priced as 2 months free versus monthly.",
      "Annual access remains at the existing annual price. The £4.99 offer applies to monthly billing.",
    ],
    [
      "Best value — 2 months free versus paying monthly.",
      "Annual access remains at the existing annual price. The £4.99 offer applies to monthly billing.",
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
