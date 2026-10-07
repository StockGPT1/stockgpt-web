"use client";

import { useEffect } from "react";
import { observeInitialAppLoad } from "@/lib/app-launch-state";

export function AppLaunchLifecycle() {
  useEffect(() => observeInitialAppLoad(document), []);
  return null;
}
