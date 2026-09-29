"use client";

import { useEffect } from "react";
import { acquireBlockingOverlayScrollLock } from "@/lib/overlay-scroll-lock";

export function useBlockingOverlay(open: boolean) {
  useEffect(() => {
    if (!open) return;
    return acquireBlockingOverlayScrollLock(document);
  }, [open]);
}

