"use client";

import { track } from "@vercel/analytics";

type EventProperties = Record<string, string | number | boolean | null>;

export function trackClientEvent(name: string, properties?: EventProperties) {
  if (typeof window === "undefined") return;

  try {
    track(name, properties);
  } catch {
    // Analytics must never interrupt a conversion or product workflow.
  }
}
