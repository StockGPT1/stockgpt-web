export default function AffiliateRouteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function () {
              function unlockPublicPage() {
                document.documentElement.style.height = 'auto';
                document.documentElement.style.minHeight = '100%';
                document.documentElement.style.overflowX = 'hidden';
                document.documentElement.style.overflowY = 'auto';

                if (document.body) {
                  document.body.style.height = 'auto';
                  document.body.style.minHeight = '100%';
                  document.body.style.overflowX = 'hidden';
                  document.body.style.overflowY = 'auto';
                }

                var page = document.getElementById('affiliate-scroll-root');
                if (page) {
                  page.style.height = 'auto';
                  page.style.minHeight = '100vh';
                  page.style.overflowX = 'hidden';
                  page.style.overflowY = 'visible';
                }
              }

              unlockPublicPage();
              if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', unlockPublicPage);
              } else {
                unlockPublicPage();
              }
            })();
          `,
        }}
      />
      <style>{`
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
          min-height: 100dvh !important;
          height: auto !important;
          overflow-x: hidden !important;
          overflow-y: visible !important;
          -webkit-overflow-scrolling: touch !important;
        }

        .affiliate-page > header,
        .affiliate-page > section,
        .affiliate-page > footer {
          position: relative !important;
          z-index: 20 !important;
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
      `}</style>
      {children}
    </>
  );
}
