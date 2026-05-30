from pathlib import Path

PUBLIC_METADATA = {
    "app/about/page.tsx": (
        "About StockGPT | AI Stock Ranking Methodology",
        "See how StockGPT, LLC combines technical, fundamental, momentum, risk and market intelligence indicators into a structured AI stock ranking platform.",
        "https://stockgpt.pro/about",
    ),
    "app/pricing/page.tsx": (
        "Pricing | StockGPT AI Market Research Plans",
        "Compare StockGPT plans for AI-powered stock rankings, portfolio alerts, market research tools and investor intelligence features.",
        "https://stockgpt.pro/pricing",
    ),
    "app/legal/page.tsx": (
        "Legal Documents | StockGPT, LLC Terms and Policies",
        "Read StockGPT, LLC terms of service, subscription terms, privacy policy, cookie policy, disclaimer and affiliate programme terms.",
        "https://stockgpt.pro/legal",
    ),
    "app/affiliate/page.tsx": (
        "Affiliate Program | Partner With StockGPT",
        "Apply to partner with StockGPT and promote an AI-powered market research platform built for modern investors.",
        "https://stockgpt.pro/affiliate",
    ),
}

PRIVATE_ROUTES = {
    "app/dashboard/page.tsx": (
        "Dashboard | StockGPT Portfolio Intelligence",
        "Private StockGPT dashboard for subscribers, including market overview, AI rankings, watchlist context and portfolio research tools.",
    ),
    "app/rankings/page.tsx": (
        "AI Stock Rankings | StockGPT S&P 500 Leaderboard",
        "Private StockGPT rankings page showing AI-ranked S&P 500 stocks, score changes, sector data and market research context.",
    ),
    "app/portfolio/page.tsx": (
        "Portfolio Tracker | StockGPT AI Alerts",
        "Private StockGPT portfolio tracker with holding alerts, score moves, risk notes and AI-assisted market research context.",
    ),
    "app/watchlist/page.tsx": (
        "Watchlist | StockGPT Stock Monitoring",
        "Private StockGPT watchlist page for monitoring selected stocks, AI scores, ranking changes and research signals.",
    ),
    "app/notifications/page.tsx": (
        "Alerts | StockGPT Portfolio Notifications",
        "Private StockGPT alerts page covering portfolio changes, score movements, ranking updates and market research notifications.",
    ),
    "app/world-news/page.tsx": (
        "World News | StockGPT Market Intelligence",
        "Private StockGPT world news page with market headlines, sentiment context and AI-assisted research summaries.",
    ),
    "app/settings/page.tsx": (
        "Account Settings | StockGPT",
        "Private StockGPT account settings page for managing subscription, profile and platform preferences.",
    ),
}

AUTH_ROUTES = {
    "app/login/page.tsx": ("Log In | StockGPT", "Log in securely to StockGPT to access AI stock rankings and portfolio research tools."),
    "app/signup/page.tsx": ("Create Account | StockGPT", "Create a StockGPT account to access AI-powered stock rankings and market research features."),
    "app/forgot-password/page.tsx": ("Reset Password | StockGPT", "Request a secure password reset link for your StockGPT account."),
    "app/update-password/page.tsx": ("Update Password | StockGPT", "Set a new secure password for your StockGPT account."),
}


def is_client_component(text: str) -> bool:
    stripped = text.lstrip()
    return stripped.startswith('"use client"') or stripped.startswith("'use client'")


def metadata_block(title: str, description: str, canonical: str | None = None, noindex: bool = False) -> str:
    robots = "  robots: { index: false, follow: false },\n" if noindex else ""
    alternates = f'''  alternates: {{
    canonical: "{canonical}",
  }},
''' if canonical else ""
    return f'''export const metadata: Metadata = {{
  title: "{title}",
  description:
    "{description}",
{robots}{alternates}}};

'''


def strip_existing_metadata(text: str) -> str:
    marker = "export const metadata: Metadata = {"
    start = text.find(marker)
    if start == -1:
        return text
    depth = 0
    i = text.find("{", start)
    if i == -1:
        return text
    while i < len(text):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                end = text.find(";", i)
                if end == -1:
                    end = i
                return text[:start] + text[end + 1:].lstrip("\n")
        i += 1
    return text


def ensure_import(text: str) -> str:
    if 'import type { Metadata } from "next";' in text:
        return text
    return 'import type { Metadata } from "next";\n' + text


def insert_metadata(text: str, block: str) -> str:
    text = strip_existing_metadata(text)
    text = ensure_import(text)
    lines = text.splitlines(True)
    insert_at = 0
    for i, line in enumerate(lines):
        if line.startswith("import ") or line.strip() == "":
            insert_at = i + 1
            continue
        break
    lines.insert(insert_at, "\n" + block)
    return "".join(lines)


def write_page_metadata(path: Path, title: str, description: str, canonical: str | None = None, noindex: bool = False):
    if not path.exists():
        print(f"Skipping missing {path}")
        return
    text = path.read_text()
    block = metadata_block(title, description, canonical, noindex)
    if is_client_component(text):
        layout_path = path.parent / "layout.tsx"
        layout_path.write_text(
            f'''import type {{ Metadata }} from "next";
import type {{ ReactNode }} from "react";

{block}export default function Layout({{ children }}: {{ children: ReactNode }}) {{
  return children;
}}
'''
        )
        print(f"Wrote metadata layout {layout_path}")
        return
    path.write_text(insert_metadata(text, block))
    print(f"Wrote metadata for {path}")


for file_path, (title, description, canonical) in PUBLIC_METADATA.items():
    write_page_metadata(Path(file_path), title, description, canonical, noindex=False)

for file_path, (title, description) in PRIVATE_ROUTES.items():
    write_page_metadata(Path(file_path), title, description, canonical=None, noindex=True)

for file_path, (title, description) in AUTH_ROUTES.items():
    write_page_metadata(Path(file_path), title, description, canonical=None, noindex=True)

# Root page should be the main canonical SEO page.
write_page_metadata(
    Path("app/page.tsx"),
    "StockGPT — AI Stock Rankings & Portfolio Intelligence",
    "StockGPT is an AI-powered market research platform for ranking S&P 500 stocks, tracking portfolio changes and turning market data into clearer investor insight.",
    "https://stockgpt.pro/",
    noindex=False,
)

# Keep robots aligned with noindex strategy.
robots = Path("public/robots.txt")
robots.write_text("""User-agent: *
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
""")

# Create an explicit sitemap containing only public indexable pages.
sitemap = Path("app/sitemap.ts")
sitemap.write_text('''import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: "https://stockgpt.pro/",
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: "https://stockgpt.pro/about",
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: "https://stockgpt.pro/pricing",
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: "https://stockgpt.pro/affiliate",
      lastModified,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: "https://stockgpt.pro/legal",
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
''')

print("Duplicate meta descriptions and duplicate-content SEO controls applied.")
