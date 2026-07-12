"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const ALLOCATION_STATUSES = new Set([
  "Above target",
  "Below target",
  "In range",
  "Target unavailable",
  "Price unavailable",
]);

function parseDisplayedNumber(value: string | null | undefined) {
  if (!value) return null;
  const negative = /\(.*\)/.test(value) || value.trim().startsWith("-");
  const cleaned = value.replace(/[^0-9.,]/g, "").replace(/,/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

function setText(node: Element | null | undefined, text: string) {
  if (node && node.textContent !== text) node.textContent = text;
}

function findMetricValue(root: Element, label: string) {
  const labels = Array.from(root.querySelectorAll("p"));
  const labelNode = labels.find((node) => node.textContent?.trim() === label);
  if (!labelNode?.parentElement) return null;
  const values = Array.from(labelNode.parentElement.querySelectorAll(":scope > p"));
  return values.find((node) => node !== labelNode) ?? null;
}

function findMobileAllocationParts(row: HTMLElement) {
  const button = row.querySelector(":scope > button");
  if (!button) return null;

  const marker = Array.from(button.querySelectorAll<HTMLElement>("span[style]"))
    .find((node) => Boolean(node.style.left));
  const existingTrack = button.querySelector<HTMLElement>("[data-sg-allocation-track]");
  const track = existingTrack ?? marker?.parentElement ?? null;
  if (!track) return null;

  track.dataset.sgAllocationTrack = "true";
  const fill = track.querySelector<HTMLElement>("[data-sg-allocation-fill]") ??
    Array.from(track.children).find(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && child !== marker && Boolean(child.style.width),
    ) ??
    null;
  if (fill) fill.dataset.sgAllocationFill = "true";
  if (marker) marker.dataset.sgAllocationMarker = "true";

  const caption = Array.from(button.querySelectorAll<HTMLElement>("span"))
    .find((node) => {
      const directChildren = Array.from(node.children);
      return (
        directChildren.length === 2 &&
        directChildren.some((child) => child.textContent?.trim().toLowerCase().startsWith("target"))
      );
    }) ??
    button.querySelector<HTMLElement>("[data-sg-allocation-caption]");

  if (caption) caption.dataset.sgAllocationCaption = "true";

  const status = Array.from(button.querySelectorAll<HTMLElement>("span"))
    .find((node) => ALLOCATION_STATUSES.has(node.textContent?.trim() ?? "")) ?? null;

  return { track, fill, marker: marker ?? null, caption, status };
}

function targetFromCaption(caption: HTMLElement | null) {
  if (!caption) return null;
  const stored = Number(caption.dataset.sgTargetAllocation);
  if (Number.isFinite(stored)) return stored;

  const match = caption.textContent?.match(/target\s+([0-9]+(?:\.[0-9]+)?)/i);
  const parsed = match ? Number(match[1]) : null;
  if (parsed != null && Number.isFinite(parsed)) {
    caption.dataset.sgTargetAllocation = String(parsed);
    return parsed;
  }
  return null;
}

function holdingShares(row: HTMLElement) {
  const match = row.textContent?.match(/([0-9][0-9,.]*)\s+shares/i);
  if (!match) return null;
  const parsed = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function allocationStatus(allocation: number | null, target: number | null) {
  if (allocation == null) return "Price unavailable";
  if (target == null) return "Target unavailable";
  if (allocation > target + 1) return "Above target";
  if (allocation < target - 1) return "Below target";
  return "In range";
}

export function PortfolioAllocationBarPolish() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.startsWith("/portfolio")) return;

    let frame = 0;
    let retryTimer = 0;

    const apply = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const hero = document.querySelector<HTMLElement>(".portfolio-chart-hero");
        const rows = Array.from(
          document.querySelectorAll<HTMLElement>("[data-stockgpt-holding-row]"),
        );
        if (!hero || rows.length === 0) return;

        const totalValue = parseDisplayedNumber(hero.querySelector("h1")?.textContent);
        const heroCopy = hero.textContent?.toLowerCase() ?? "";
        const portfolioHasMissingPrices =
          heroCopy.includes("missing latest prices") ||
          heroCopy.includes("showing last-known value") ||
          heroCopy.includes("value unavailable");

        rows.forEach((row) => {
          const valueNode = findMetricValue(row, "Value");
          const holdingValue = parseDisplayedNumber(valueNode?.textContent);
          const shares = holdingShares(row);
          const missingPrice =
            (shares != null && shares > 0 && (holdingValue == null || holdingValue <= 0)) ||
            totalValue == null ||
            totalValue <= 0;
          const allocation = missingPrice
            ? null
            : Math.max(0, Math.min(100, ((holdingValue ?? 0) / totalValue) * 100));
          const displayWidth =
            allocation != null && allocation > 0 ? Math.max(1.5, allocation) : 0;
          const parts = findMobileAllocationParts(row);
          if (!parts) return;

          const target = targetFromCaption(parts.caption);
          const status = allocationStatus(allocation, target);

          parts.track.setAttribute(
            "aria-label",
            allocation == null
              ? "Portfolio allocation unavailable because the latest price is missing"
              : `${allocation.toFixed(1)}% of total portfolio value`,
          );
          parts.track.dataset.sgAllocationState = allocation == null ? "unavailable" : "ready";

          if (parts.fill) {
            parts.fill.style.width = `${displayWidth}%`;
            parts.fill.style.background =
              "linear-gradient(90deg, #9b7228 0%, #d6ae4d 48%, #f3d98b 100%)";
            parts.fill.style.boxShadow = "none";
          }
          if (parts.marker) parts.marker.style.display = "none";

          if (parts.caption) {
            const labels = Array.from(parts.caption.children);
            setText(labels[0], allocation == null ? "—" : `${allocation.toFixed(1)}%`);
            setText(
              labels[1],
              allocation == null
                ? "price unavailable"
                : portfolioHasMissingPrices
                  ? "estimated · total portfolio"
                  : "of total portfolio",
            );
          }

          setText(parts.status, status);

          const desktopAllocationValue = findMetricValue(row, "Allocation");
          if (desktopAllocationValue) {
            setText(
              desktopAllocationValue,
              allocation == null ? "—" : `${allocation.toFixed(1)}%`,
            );
            const desktopAllocationSub = desktopAllocationValue.nextElementSibling;
            setText(
              desktopAllocationSub,
              allocation == null
                ? "Price unavailable"
                : `${status} · ${portfolioHasMissingPrices ? "estimated total" : "total portfolio"}`,
            );
          }

          row.dataset.sgAllocationReady = "true";
        });
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
