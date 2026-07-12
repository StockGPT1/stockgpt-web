import { SkeletonBlock } from "@/components/ModuleState";

export default function RankingsLoading() {
  return (
    <main className="grid min-h-full content-start gap-3 bg-[#072116] p-3 text-[#faf6f0]" aria-label="Loading rankings">
      <SkeletonBlock className="h-28" />
      <div className="flex gap-2 overflow-hidden"><SkeletonBlock className="h-11 flex-1" /><SkeletonBlock className="h-11 w-28 shrink-0" /></div>
      <div className="grid gap-2">{Array.from({ length: 10 }).map((_, index) => <SkeletonBlock key={index} className="h-20" />)}</div>
    </main>
  );
}
