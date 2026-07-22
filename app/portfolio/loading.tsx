import { BrandLoader } from "@/components/BrandLoader";

/* Keeps the portfolio-workspace invariants (aria labelling + safe-area
   bottom padding for the mobile action bar) around the shared loader. */
export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading portfolio"
      className="grid h-dvh place-items-center pb-[calc(120px+env(safe-area-inset-bottom))]"
      style={{
        background:
          "radial-gradient(ellipse 60% 45% at 50% 38%, rgba(221,177,89,0.09), transparent 65%), #072116",
      }}
    >
      <BrandLoader label="Weighing your holdings" />
    </main>
  );
}
