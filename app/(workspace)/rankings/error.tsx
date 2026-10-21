"use client";
import { RouteErrorState } from "@/components/RouteErrorState";
export default function RankingsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <RouteErrorState title="Rankings could not load" description="The latest model table is unavailable. Retry instead of treating a missing table as current rankings." reset={reset} />; }
