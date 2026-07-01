import type { SVGProps } from "react";

export type StockIconName =
  | "account"
  | "alerts"
  | "ask"
  | "check"
  | "chevron-down"
  | "clock"
  | "close"
  | "collapse"
  | "dashboard"
  | "expand"
  | "news"
  | "portfolio"
  | "rankings"
  | "search"
  | "settings"
  | "total"
  | "trend-up"
  | "watchlist";

export function StockIcon({
  name,
  className = "size-5",
  ...props
}: { name: StockIconName } & Omit<SVGProps<SVGSVGElement>, "name">) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
    focusable: false,
    ...props,
  };

  if (name === "dashboard") {
    return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>;
  }
  if (name === "rankings") {
    return <svg {...common}><path d="M5 20V11h4v9M10 20V5h4v15M15 20v-7h4v7M3 20h18" /></svg>;
  }
  if (name === "portfolio") {
    return <svg {...common}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></svg>;
  }
  if (name === "watchlist") {
    return <svg {...common}><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" /></svg>;
  }
  if (name === "alerts") {
    return <svg {...common}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4" /></svg>;
  }
  if (name === "news") {
    return <svg {...common}><path d="M5 4h14a2 2 0 0 1 2 2v13H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" /><path d="M7 8h5v4H7zM15 8h3M15 12h3M7 16h11" /></svg>;
  }
  if (name === "settings") {
    return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></svg>;
  }
  if (name === "ask") {
    return <svg {...common}><path d="M12 3c.5 4.5 2.5 6.5 7 7-4.5.5-6.5 2.5-7 7-.5-4.5-2.5-6.5-7-7 4.5-.5 6.5-2.5 7-7Z" /><path d="M19 16c.2 1.8 1 2.6 2.8 2.8-1.8.2-2.6 1-2.8 2.8-.2-1.8-1-2.6-2.8-2.8 1.8-.2 2.6-1 2.8-2.8Z" /></svg>;
  }
  if (name === "account") {
    return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
  }
  if (name === "trend-up") {
    return <svg {...common}><path d="m4 16 5-5 4 4 7-8M15 7h5v5" /></svg>;
  }
  if (name === "total") {
    return <svg {...common}><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="4" cy="6" r=".8" fill="currentColor" stroke="none" /><circle cx="4" cy="12" r=".8" fill="currentColor" stroke="none" /><circle cx="4" cy="18" r=".8" fill="currentColor" stroke="none" /></svg>;
  }
  if (name === "clock") {
    return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  }
  if (name === "search") {
    return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
  }
  if (name === "check") {
    return <svg {...common}><path d="m5 12 4 4L19 6" /></svg>;
  }
  if (name === "close") {
    return <svg {...common}><path d="M18 6 6 18M6 6l12 12" /></svg>;
  }
  if (name === "collapse") {
    return <svg {...common}><path d="M5 12h14" /></svg>;
  }
  if (name === "expand") {
    return <svg {...common}><path d="M5 12h14M12 5v14" /></svg>;
  }

  return <svg {...common}><path d="m7 10 5 5 5-5" /></svg>;
}
