import { SkeletonBlock } from "@/components/ModuleState";

export default function StockLoading() {
  return (
    <main className="grid min-h-full content-start gap-3 bg-[#072116] p-3 text-[#faf6f0]" aria-label="Loading stock research">
      <SkeletonBlock className="h-36" />
      <SkeletonBlock className="h-64 sm:h-80" />
      <SkeletonBlock className="h-44" />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]"><SkeletonBlock className="h-80" /><SkeletonBlock className="hidden h-80 lg:block" /></div>
    </main>
  );
}
