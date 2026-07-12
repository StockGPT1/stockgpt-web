import { SkeletonBlock } from "@/components/ModuleState";

export default function DashboardLoading() {
  return (
    <main className="grid min-h-full gap-3 bg-[#072116] p-3 text-[#faf6f0] lg:grid-cols-[minmax(0,1fr)_340px]" aria-label="Loading dashboard">
      <div className="grid content-start gap-3">
        <SkeletonBlock className="h-20" />
        <SkeletonBlock className="h-64" />
        <div className="grid gap-3 sm:grid-cols-2"><SkeletonBlock className="h-36" /><SkeletonBlock className="h-36" /></div>
        <SkeletonBlock className="h-40" />
        <SkeletonBlock className="h-72" />
      </div>
      <aside className="hidden content-start gap-3 lg:grid"><SkeletonBlock className="h-64" /><SkeletonBlock className="h-72" /><SkeletonBlock className="h-32" /></aside>
    </main>
  );
}
