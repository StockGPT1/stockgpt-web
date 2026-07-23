"use client";
import { RouteErrorState } from "@/components/RouteErrorState";
export default function StockError({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <RouteErrorState title="Stock research could not load" description="Price, chart, and model data are not being presented as current. Retry the research page." reset={reset} />; }
