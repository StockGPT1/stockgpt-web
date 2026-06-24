export default function AffiliateTemplate({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        .affiliate-page {
          position: relative !important;
          isolation: isolate !important;
        }

        .affiliate-page > .pointer-events-none {
          z-index: 0 !important;
        }

        .affiliate-page > header,
        .affiliate-page > section,
        .affiliate-page > footer,
        .affiliate-page > div:not(.pointer-events-none) {
          position: relative !important;
          z-index: 20 !important;
          visibility: visible !important;
          opacity: 1 !important;
        }

        .affiliate-page > header {
          z-index: 40 !important;
        }
      `}</style>
      {children}
    </>
  );
}
