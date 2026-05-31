from pathlib import Path

path = Path("components/SavedPortfolio.tsx")
text = path.read_text()

helper = '''
function formatMoney(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
'''

if "function formatMoney(value: number)" not in text:
    marker = "type ReplacementRecommendation = {"
    text = text.replace(marker, helper + "\n" + marker, 1)

replacements = {
    "${cashBalance.toLocaleString()}": "${formatMoney(cashBalance)}",
    "${totalValue.toLocaleString()}": "${formatMoney(totalValue)}",
    "${holdingsValue.toLocaleString()}": "${formatMoney(holdingsValue)}",
    "${Math.abs(totalPnLDollars).toLocaleString()}": "${formatMoney(Math.abs(totalPnLDollars))}",
    "Basis ${inceptionBasis.toLocaleString()}": "Basis ${formatMoney(inceptionBasis)}",
}

for old, new in replacements.items():
    text = text.replace(old, new)

path.write_text(text)
print("Formatted portfolio cash and money totals to 2 decimal places.")
