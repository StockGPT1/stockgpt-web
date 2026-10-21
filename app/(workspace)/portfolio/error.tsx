"use client";
import { RouteErrorState } from "@/components/RouteErrorState";
export default function PortfolioError({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <RouteErrorState title="The portfolio could not load" description="StockGPT has not substituted zeroes for unavailable prices or history. Retry the portfolio refresh." reset={reset} />; }
