export default function LegalTemplate({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        .legal-page {
          position: relative !important;
          isolation: isolate !important;
        }

        .legal-page > .pointer-events-none {
          z-index: 0 !important;
        }

        .legal-page > header,
        .legal-page > section,
        .legal-page > footer,
        .legal-page > div:not(.pointer-events-none) {
          position: relative !important;
          z-index: 20 !important;
          visibility: visible !important;
          opacity: 1 !important;
        }

        .legal-page > header {
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

          .legal-page,
          #legal-scroll-root {
            min-height: 100vh !important;
            min-height: 100svh !important;
            height: auto !important;
            overflow-x: hidden !important;
            overflow-y: visible !important;
            padding-right: 0 !important;
          }

          .legal-page > .pointer-events-none {
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
