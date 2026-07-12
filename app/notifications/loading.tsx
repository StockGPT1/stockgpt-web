import { SkeletonBlock } from "@/components/ModuleState";

export default function NotificationsLoading() {
  return (
    <div className="grid gap-4 p-3 sm:p-5" aria-label="Loading alerts">
      <SkeletonBlock className="h-32" />
      <div className="flex gap-2 overflow-hidden">{Array.from({ length: 6 }).map((_, index) => <SkeletonBlock key={index} className="h-10 w-24 shrink-0 rounded-full" />)}</div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]">
        <div className="grid gap-2.5">{Array.from({ length: 4 }).map((_, index) => <SkeletonBlock key={index} className="h-40" />)}</div>
        <SkeletonBlock className="hidden h-80 lg:block" />
      </div>
    </div>
  );
}
