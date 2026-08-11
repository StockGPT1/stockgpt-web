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

        @media (max-width: 767px) {
          html,
          body {
            height: auto !important;
            min-height: 100% !important;
            overflow-x: hidden !important;
            overflow-y: auto !important;
          }

          .affiliate-page,
          #affiliate-scroll-root {
            min-height: 100vh !important;
            min-height: 100svh !important;
            height: auto !important;
            overflow-x: hidden !important;
            overflow-y: visible !important;
            padding-right: 0 !important;
          }

          .affiliate-page > .pointer-events-none {
            position: absolute !important;
            inset: 0 !important;
            height: 100% !important;
            min-height: 100% !important;
            z-index: 0 !important;
          }
        }
      `}</style>
      {children}
    </>
  );
}
