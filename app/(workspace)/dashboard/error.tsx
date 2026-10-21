"use client";
import { RouteErrorState } from "@/components/RouteErrorState";
export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <RouteErrorState title="The dashboard could not load" description="One or more dashboard modules failed. Retry without treating missing modules as current data." reset={reset} />; }
