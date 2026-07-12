import { SkeletonBlock } from "@/components/ModuleState";

export default function WorldNewsLoading() {
  return (
    <div className="grid gap-4 p-3 sm:p-5" aria-label="Loading market news">
      <SkeletonBlock className="h-48" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, index) => <SkeletonBlock key={index} className="h-10 w-24 shrink-0 rounded-full" />)}
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-3">
          <SkeletonBlock className="h-44" />
          {Array.from({ length: 3 }).map((_, index) => <SkeletonBlock key={index} className="h-32" />)}
        </div>
        <SkeletonBlock className="hidden h-80 lg:block" />
      </div>
    </div>
  );
}
