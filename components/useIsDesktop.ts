"use client";

import { useEffect, useState } from "react";

/**
 * True at the lg breakpoint and up. Components that pair a MobileSheet
 * with a separate desktop overlay must mount only one of the two:
 * MobileSheet marks the rest of the page inert while open, which kills
 * every click on a desktop overlay that is merely display-hidden away.
 */
export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}
