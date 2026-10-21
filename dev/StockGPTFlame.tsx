"use client";

import { useId } from "react";
import styles from "./StockGPTFlame.module.css";

/** Original textured StockGPT logo; the tile is excluded when rendered. */
export function StockGPTFlame({ className = "" }: { className?: string }) {
  const id = `stockgpt-flame-${useId().replace(/:/g, "")}`;
  return (
    <svg className={`${styles.flame} ${className}`} viewBox="150 45 220 440" aria-hidden="true">
      <defs><filter id={id} colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  4 -3 0 0 0" /></filter></defs>
      <image href="/icon.png" width="512" height="512" filter={`url(#${id})`} />
    </svg>
  );
}
