export const metadata = {
  title: "AquaSlog",
  description: "Freshwater aquarium log",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500&family=VT323&display=swap"
          rel="stylesheet"
        />
        <style>{`
          :root {
            --color-bg: #fff;
            --color-surface: #fafafa;
            --color-surface-raised: #f8fafc;
            --color-border: #e2e8f0;
            --color-border-subtle: #f1f5f9;
            --color-border-faint: #e5e7eb;
            --color-text-primary: #0f172a;
            --color-text-secondary: #334155;
            --color-text-body: #475569;
            --color-text-muted: #64748b;
            --color-text-subtle: #94a3b8;
            --color-text-faint: #cbd5e1;
            --color-btn-dark-bg: #1a1a1a;
            --color-btn-dark-text: #fff;
            --color-input-bg: #fafafa;
            --color-input-text: #1e293b;
            --color-accent: #0891b2;
            --color-error-text: #dc2626;
            --color-error-bg: #fef2f2;
            --color-error-border: #fecaca;
            --color-success-text: #059669;
            --color-success-bg: #f0fdf4;
            --color-success-border: #86efac;
            --color-warning-text: #d97706;
            --color-warning-bg: #fff7ed;
            --color-warning-border: #fed7aa;
            --color-info-text: #0369a1;
            --color-info-bg: #f0f9ff;
            --color-info-border: #bae6fd;
            --color-param-bg: #f0f9ff;
            --color-param-border: #bae6fd;
            --color-param-text: #0c4a6e;
            --color-medical-bg: #fff5f5;
            --color-medical-icon-bg: #fecaca;
            --color-medical-text: #7f1d1d;
            --color-tag-public-bg: #f0fdf4;
            --color-tag-public-text: #15803d;
            --color-tag-public-border: #bbf7d0;
            --color-tag-private-bg: #f8fafc;
            --color-tag-private-text: #94a3b8;
            --color-tag-private-border: #e2e8f0;
            --color-filter-active-bg: #0f172a;
            --color-filter-active-text: #fff;
            --color-filter-active-border: #0f172a;
            --color-nav-bg: #fff;
            --color-nav-border: #f1f5f9;
            --color-danger-border: #fee2e2;
            --color-danger-btn-text: #dc2626;
            --color-danger-btn-border: #fecaca;
            --color-lived-bg: #e5e7eb;
            --color-lived-text: #1f2937;
          }

          @media (prefers-color-scheme: dark) {
            :root:not([data-theme="light"]) {
              --color-bg: #0f172a;
              --color-surface: #1e293b;
              --color-surface-raised: #263248;
              --color-border: #334155;
              --color-border-subtle: #1e293b;
              --color-border-faint: #2d3f55;
              --color-text-primary: #f1f5f9;
              --color-text-secondary: #cbd5e1;
              --color-text-body: #94a3b8;
              --color-text-muted: #64748b;
              --color-text-subtle: #475569;
              --color-text-faint: #334155;
              --color-btn-dark-bg: #f1f5f9;
              --color-btn-dark-text: #0f172a;
              --color-input-bg: #1e293b;
              --color-input-text: #e2e8f0;
              --color-error-text: #f87171;
              --color-error-bg: #2d1a1a;
              --color-error-border: #7f1d1d;
              --color-success-text: #34d399;
              --color-success-bg: #0d2b1f;
              --color-success-border: #166534;
              --color-warning-text: #fbbf24;
              --color-warning-bg: #2d1f0d;
              --color-warning-border: #92400e;
              --color-info-text: #38bdf8;
              --color-info-bg: #082032;
              --color-info-border: #0c4a6e;
              --color-param-bg: #082032;
              --color-param-border: #0c4a6e;
              --color-param-text: #7dd3fc;
              --color-medical-bg: #1f0d0d;
              --color-medical-icon-bg: #7f1d1d;
              --color-medical-text: #fca5a5;
              --color-tag-public-bg: #0d2b1f;
              --color-tag-public-text: #34d399;
              --color-tag-public-border: #166534;
              --color-tag-private-bg: #1e293b;
              --color-tag-private-text: #475569;
              --color-tag-private-border: #334155;
              --color-filter-active-bg: #e2e8f0;
              --color-filter-active-text: #0f172a;
              --color-filter-active-border: #e2e8f0;
              --color-nav-bg: #0f172a;
              --color-nav-border: #1e293b;
              --color-danger-border: #450a0a;
              --color-danger-btn-text: #f87171;
              --color-danger-btn-border: #7f1d1d;
              --color-lived-bg: #374151;
              --color-lived-text: #d1d5db;
            }
          }

          [data-theme="dark"] {
            --color-bg: #0f172a;
            --color-surface: #1e293b;
            --color-surface-raised: #263248;
            --color-border: #334155;
            --color-border-subtle: #1e293b;
            --color-border-faint: #2d3f55;
            --color-text-primary: #f1f5f9;
            --color-text-secondary: #cbd5e1;
            --color-text-body: #94a3b8;
            --color-text-muted: #64748b;
            --color-text-subtle: #475569;
            --color-text-faint: #334155;
            --color-btn-dark-bg: #f1f5f9;
            --color-btn-dark-text: #0f172a;
            --color-input-bg: #1e293b;
            --color-input-text: #e2e8f0;
            --color-error-text: #f87171;
            --color-error-bg: #2d1a1a;
            --color-error-border: #7f1d1d;
            --color-success-text: #34d399;
            --color-success-bg: #0d2b1f;
            --color-success-border: #166534;
            --color-warning-text: #fbbf24;
            --color-warning-bg: #2d1f0d;
            --color-warning-border: #92400e;
            --color-info-text: #38bdf8;
            --color-info-bg: #082032;
            --color-info-border: #0c4a6e;
            --color-param-bg: #082032;
            --color-param-border: #0c4a6e;
            --color-param-text: #7dd3fc;
            --color-medical-bg: #1f0d0d;
            --color-medical-icon-bg: #7f1d1d;
            --color-medical-text: #fca5a5;
            --color-tag-public-bg: #0d2b1f;
            --color-tag-public-text: #34d399;
            --color-tag-public-border: #166534;
            --color-tag-private-bg: #1e293b;
            --color-tag-private-text: #475569;
            --color-tag-private-border: #334155;
            --color-filter-active-bg: #e2e8f0;
            --color-filter-active-text: #0f172a;
            --color-filter-active-border: #e2e8f0;
            --color-nav-bg: #0f172a;
            --color-nav-border: #1e293b;
            --color-danger-border: #450a0a;
            --color-danger-btn-text: #f87171;
            --color-danger-btn-border: #7f1d1d;
            --color-lived-bg: #374151;
            --color-lived-text: #d1d5db;
          }

          [data-theme="light"] {
            --color-bg: #fff;
            --color-surface: #fafafa;
            --color-surface-raised: #f8fafc;
            --color-border: #e2e8f0;
            --color-border-subtle: #f1f5f9;
            --color-border-faint: #e5e7eb;
            --color-text-primary: #0f172a;
            --color-text-secondary: #334155;
            --color-text-body: #475569;
            --color-text-muted: #64748b;
            --color-text-subtle: #94a3b8;
            --color-text-faint: #cbd5e1;
            --color-btn-dark-bg: #1a1a1a;
            --color-btn-dark-text: #fff;
            --color-input-bg: #fafafa;
            --color-input-text: #1e293b;
            --color-error-text: #dc2626;
            --color-error-bg: #fef2f2;
            --color-error-border: #fecaca;
            --color-success-text: #059669;
            --color-success-bg: #f0fdf4;
            --color-success-border: #86efac;
            --color-warning-text: #d97706;
            --color-warning-bg: #fff7ed;
            --color-warning-border: #fed7aa;
            --color-info-text: #0369a1;
            --color-info-bg: #f0f9ff;
            --color-info-border: #bae6fd;
            --color-param-bg: #f0f9ff;
            --color-param-border: #bae6fd;
            --color-param-text: #0c4a6e;
            --color-medical-bg: #fff5f5;
            --color-medical-icon-bg: #fecaca;
            --color-medical-text: #7f1d1d;
            --color-tag-public-bg: #f0fdf4;
            --color-tag-public-text: #15803d;
            --color-tag-public-border: #bbf7d0;
            --color-tag-private-bg: #f8fafc;
            --color-tag-private-text: #94a3b8;
            --color-tag-private-border: #e2e8f0;
            --color-filter-active-bg: #0f172a;
            --color-filter-active-text: #fff;
            --color-filter-active-border: #0f172a;
            --color-nav-bg: #fff;
            --color-nav-border: #f1f5f9;
            --color-danger-border: #fee2e2;
            --color-danger-btn-text: #dc2626;
            --color-danger-btn-border: #fecaca;
            --color-lived-bg: #e5e7eb;
            --color-lived-text: #1f2937;
          }

          * { box-sizing: border-box; }
          body { margin: 0; padding: 0; background: var(--color-bg); }
          button { transition: opacity 0.15s; }
          button:hover { opacity: 0.75; }
          button:disabled { cursor: default; }
          input:focus, select:focus, textarea:focus {
            border-color: var(--color-accent) !important;
            background: var(--color-input-bg) !important;
            color: var(--color-input-text) !important;
            outline: none;
          }
        `}</style>
      </head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('aquaslog-theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();` }} />
        {children}
        <footer style={{
          borderTop: "1px solid var(--color-border-subtle)",
          padding: "20px 24px",
          textAlign: "center",
          fontSize: "11px",
          color: "var(--color-text-faint)",
          fontFamily: "'DM Sans', sans-serif",
          background: "var(--color-bg)",
        }}>
          © 2026 AquaSlog ·{" "}
          <a href="/privacy" style={{ color: "var(--color-text-faint)", textDecoration: "none" }}>Privacy Policy</a>
          {" · "}
          <a href="/terms" style={{ color: "var(--color-text-faint)", textDecoration: "none" }}>Terms of Use</a>
        </footer>
      </body>
    </html>
  );
}
