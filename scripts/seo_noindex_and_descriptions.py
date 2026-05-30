from pathlib import Path

files = {
    "app/dashboard/layout.tsx": ("Dashboard | StockGPT", "Private StockGPT subscriber dashboard.", True),
    "app/rankings/layout.tsx": ("AI Stock Rankings | StockGPT", "Private StockGPT AI stock rankings page.", True),
    "app/portfolio/layout.tsx": ("Portfolio Tracker | StockGPT", "Private StockGPT portfolio tracker and alerts page.", True),
    "app/watchlist/layout.tsx": ("Watchlist | StockGPT", "Private StockGPT watchlist monitoring page.", True),
    "app/notifications/layout.tsx": ("Alerts | StockGPT", "Private StockGPT portfolio and ranking alerts page.", True),
    "app/world-news/layout.tsx": ("World News | StockGPT", "Private StockGPT world news and market intelligence page.", True),
    "app/settings/layout.tsx": ("Account Settings | StockGPT", "Private StockGPT account settings page.", True),
    "app/login/layout.tsx": ("Log In | StockGPT", "Log in securely to your StockGPT account.", True),
    "app/signup/layout.tsx": ("Create Account | StockGPT", "Create a StockGPT account.", True),
    "app/forgot-password/layout.tsx": ("Reset Password | StockGPT", "Reset your StockGPT password.", True),
    "app/update-password/layout.tsx": ("Update Password | StockGPT", "Update your StockGPT password.", True),
}

for file_name, (title, description, noindex) in files.items():
    path = Path(file_name)
    path.parent.mkdir(parents=True, exist_ok=True)
    robots = "  robots: { index: false, follow: false },\n" if noindex else ""
    path.write_text(f'''import type {{ Metadata }} from "next";
import type {{ ReactNode }} from "react";

export const metadata: Metadata = {{
  title: "{title}",
  description: "{description}",
{robots}}};

export default function Layout({{ children }}: {{ children: ReactNode }}) {{
  return children;
}}
''')

# Public sitemap only, to avoid crawling duplicate private shells.
Path("app/sitemap.ts").write_text('''import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    { url: "https://stockgpt.pro/", lastModified, changeFrequency: "weekly", priority: 1 },
    { url: "https://stockgpt.pro/about", lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: "https://stockgpt.pro/pricing", lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: "https://stockgpt.pro/affiliate", lastModified, changeFrequency: "monthly", priority: 0.5 },
    { url: "https://stockgpt.pro/legal", lastModified, changeFrequency: "yearly", priority: 0.3 },
  ];
}
''')

Path("public/robots.txt").write_text('''User-agent: *
Allow: /

Disallow: /account
Disallow: /account/
Disallow: /api/
Disallow: /auth/
Disallow: /dashboard
Disallow: /dashboard/
Disallow: /login
Disallow: /signup
Disallow: /forgot-password
Disallow: /update-password
Disallow: /notifications
Disallow: /notifications/
Disallow: /portfolio
Disallow: /portfolio/
Disallow: /rankings
Disallow: /rankings/
Disallow: /settings
Disallow: /settings/
Disallow: /watchlist
Disallow: /watchlist/
Disallow: /world-news
Disallow: /world-news/

Sitemap: https://stockgpt.pro/sitemap.xml
''')

print("Added noindex metadata to private pages and public-only sitemap.")
