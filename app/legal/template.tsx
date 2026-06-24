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
      `}</style>
      {children}
    </>
  );
}
