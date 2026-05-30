from pathlib import Path
import re

LEGAL_NAME = "StockGPT, LLC"
MAILING_ADDRESS = "2810 N Church St STE 88611, Wilmington, DE 19802"

path = Path("app/legal/page.tsx")
text = path.read_text()

# Replace the old jurisdiction/operator wording first.
text = text.replace(
'''              The service is operated by StockGPT, a company
              based in the United Kingdom.''',
'''              The service is operated by StockGPT, LLC, a Delaware limited
              liability company. Our mailing address is 2810 N Church St STE
              88611, Wilmington, DE 19802.'''
)

text = text.replace(
'''              These terms are written for StockGPT,
              a subscription-based AI stock research and ranking platform.''',
'''              These terms are written for StockGPT, LLC,
              a subscription-based AI stock research and ranking platform.'''
)

# Remove any remaining UK wording that may appear elsewhere in the legal page.
text = text.replace("based in the United Kingdom", "based in Delaware, United States")
text = text.replace("company based in the United Kingdom", "Delaware limited liability company")

# Replace remaining legal references to StockGPT with the legal entity name.
# Keep it idempotent so rerunning the script does not create "StockGPT, LLC, LLC".
text = re.sub(r"\bStockGPT\b(?!, LLC)", LEGAL_NAME, text)

# Ensure the mailing address appears somewhere on the legal page.
if MAILING_ADDRESS not in text:
    marker = '''            </p>

            <Subheading>1. Acceptance of these Terms</Subheading>'''
    insertion = f'''            </p>

            <p>
              Mailing address: {MAILING_ADDRESS}.
            </p>

            <Subheading>1. Acceptance of these Terms</Subheading>'''
    if marker not in text:
        raise SystemExit("Could not find insertion marker for mailing address")
    text = text.replace(marker, insertion, 1)

required = [
    LEGAL_NAME,
    "Delaware limited",
    MAILING_ADDRESS,
]
missing = [item for item in required if item not in text]
if missing:
    raise SystemExit(f"Missing expected legal entity content: {missing}")

if "based in the United Kingdom" in text or "company based in the United Kingdom" in text:
    raise SystemExit("UK company wording still remains")

path.write_text(text)
print("Updated legal page to StockGPT, LLC, Delaware, and Wilmington mailing address.")
