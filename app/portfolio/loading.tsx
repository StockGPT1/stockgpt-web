import { SkeletonBlock } from "@/components/ModuleState";

export default function PortfolioLoading() {
  return (
    <main className="grid min-h-full gap-3 bg-[#072116] p-3 text-[#faf6f0]" aria-label="Loading portfolio">
      <SkeletonBlock className="h-72 sm:h-96" />
      <SkeletonBlock className="h-44" />
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="grid gap-2.5">{Array.from({ length: 5 }).map((_, index) => <SkeletonBlock key={index} className="h-24 sm:h-20" />)}</div>
        <div className="hidden content-start gap-3 xl:grid"><SkeletonBlock className="h-48" /><SkeletonBlock className="h-40" /></div>
      </div>
    </main>
  );
}
