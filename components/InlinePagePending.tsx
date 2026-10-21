export function InlinePagePending() {
  return <div aria-busy="true" role="status" className="sg-inline-page-pending space-y-5 p-5">
    <span className="sr-only">Updating this page</span>
    <div className="h-5 w-36 rounded-full bg-white/5" />
    <div className="h-12 w-52 rounded-xl bg-white/5" />
    <div className="h-40 rounded-3xl bg-white/[0.025]" />
  </div>;
}
