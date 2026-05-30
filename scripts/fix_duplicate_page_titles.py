from pathlib import Path

PAGES = {
    "app/about/page.tsx": (
        "About StockGPT | AI Stock Ranking Methodology",
        "Learn how StockGPT, LLC ranks stocks using technical, fundamental, risk and market intelligence indicators."
    ),
    "app/pricing/page.tsx": (
        "Pricing | StockGPT AI Market Research Plans",
        "Choose a StockGPT plan for AI-powered stock rankings, portfolio insights and market research tools."
    ),
    "app/dashboard/page.tsx": (
        "Dashboard | StockGPT Portfolio Intelligence",
        "View your StockGPT dashboard with AI stock rankings, market movers, portfolio alerts and S&P 500 insights."
    ),
    "app/rankings/page.tsx": (
        "AI Stock Rankings | StockGPT S&P 500 Leaderboard",
        "Explore StockGPT AI rankings for S&P 500 stocks using technical, fundamental and market data."
    ),
    "app/portfolio/page.tsx": (
        "Portfolio Tracker | StockGPT AI Alerts",
        "Track your portfolio with StockGPT AI alerts, ranking changes, risk levels and market research insights."
    ),
    "app/watchlist/page.tsx": (
        "Watchlist | StockGPT Stock Monitoring",
        "Monitor stocks on your StockGPT watchlist with AI rankings, score changes and market intelligence."
    ),
    "app/notifications/page.tsx": (
        "Alerts | StockGPT Portfolio Notifications",
        "Review StockGPT alerts for portfolio changes, ranking moves, score shifts and market research updates."
    ),
    "app/world-news/page.tsx": (
        "World News | StockGPT Market Intelligence",
        "Follow global market news, sentiment and AI-assisted summaries from StockGPT."
    ),
    "app/settings/page.tsx": (
        "Account Settings | StockGPT",
        "Manage your StockGPT account, subscription and platform settings."
    ),
    "app/affiliate/page.tsx": (
        "Affiliate Program | StockGPT",
        "Join the StockGPT affiliate program and partner with an AI-powered market research platform."
    ),
    "app/login/page.tsx": (
        "Log In | StockGPT",
        "Log in to StockGPT to access AI stock rankings, portfolio tools and market intelligence."
    ),
    "app/signup/page.tsx": (
        "Create Account | StockGPT",
        "Create a StockGPT account to access AI-powered stock rankings and market research tools."
    ),
    "app/forgot-password/page.tsx": (
        "Reset Password | StockGPT",
        "Request a secure password reset link for your StockGPT account."
    ),
    "app/update-password/page.tsx": (
        "Update Password | StockGPT",
        "Choose a new password for your StockGPT account."
    ),
}


def has_use_client_prefix(text: str) -> bool:
    stripped = text.lstrip()
    return stripped.startswith('"use client"') or stripped.startswith("'use client'")


def ensure_metadata(path: Path, title: str, description: str):
    if not path.exists():
        print(f"Skipping missing {path}")
        return

    text = path.read_text()
    if "export const metadata" in text:
        print(f"Already has metadata: {path}")
        return

    metadata = f'''export const metadata: Metadata = {{
  title: "{title}",
  description:
    "{description}",
}};

'''

    if has_use_client_prefix(text):
        # Client pages cannot export Metadata. Create a route layout instead.
        layout_path = path.parent / "layout.tsx"
        if layout_path.exists():
            layout_text = layout_path.read_text()
            if "export const metadata" in layout_text:
                print(f"Client layout already has metadata: {layout_path}")
                return
        layout_text = f'''import type {{ Metadata }} from "next";
import type {{ ReactNode }} from "react";

{metadata}export default function Layout({{ children }}: {{ children: ReactNode }}) {{
  return children;
}}
'''
        layout_path.write_text(layout_text)
        print(f"Created metadata layout: {layout_path}")
        return

    if 'import type { Metadata } from "next";' not in text:
        text = 'import type { Metadata } from "next";\n' + text

    # Insert after import block.
    lines = text.splitlines(True)
    insert_at = 0
    for i, line in enumerate(lines):
        if line.startswith("import ") or line.strip() == "":
            insert_at = i + 1
            continue
        break

    lines.insert(insert_at, "\n" + metadata)
    path.write_text("".join(lines))
    print(f"Added metadata: {path}")


for file_path, (title, description) in PAGES.items():
    ensure_metadata(Path(file_path), title, description)

# Improve root metadata with a template so future pages remain unique when they provide titles.
layout = Path("app/layout.tsx")
text = layout.read_text()
old = '  title: "StockGPT — AI Stock Rankings & Portfolio Builder",\n'
new = '''  title: {
    default: "StockGPT — AI Stock Rankings & Portfolio Builder",
    template: "%s | StockGPT",
  },
'''
if old in text and "template:" not in text:
    text = text.replace(old, new, 1)
    layout.write_text(text)
    print("Added root title template")
else:
    print("Root title template already present or title format changed")

print("Duplicate title SEO patch complete.")
