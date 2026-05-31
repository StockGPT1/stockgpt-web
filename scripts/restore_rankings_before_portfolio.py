from pathlib import Path
import subprocess

GOOD_COMMIT = "2d016fb68293e94d39bf2ec61bb85518c55890b6"
path = Path("app/rankings/page.tsx")

subprocess.run(["git", "checkout", GOOD_COMMIT, "--", str(path)], check=True)
text = path.read_text()

# Keep the old visual/layout code, but make it build-safe with metadata in the right place.
if 'import type { Metadata } from "next";' not in text:
    text = 'import type { Metadata } from "next";\n' + text

metadata = '''
export const metadata: Metadata = {
  title: "AI Stock Rankings | StockGPT S&P 500 Leaderboard",
  description:
    "Explore StockGPT AI rankings for S&P 500 stocks using technical, fundamental and market data.",
  robots: { index: false, follow: false },
};
'''

if "export const metadata" not in text:
    marker = "type Ranking = {"
    if marker not in text:
        raise SystemExit("Could not find metadata insertion marker")
    text = text.replace(marker, metadata + "\n" + marker, 1)

path.write_text(text)
print("Restored app/rankings/page.tsx to the pre-portfolio desktop layout with safe metadata.")
