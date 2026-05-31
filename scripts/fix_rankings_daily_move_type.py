from pathlib import Path

path = Path("app/rankings/page.tsx")
text = path.read_text()
old = "const dailyMove = dailyMoveMap.get(ticker);"
new = "const dailyMove = dailyMoveMap.get(ticker)?.changePct;"
if old not in text:
    raise SystemExit("Could not find daily move assignment")
text = text.replace(old, new)
path.write_text(text)
print("Fixed rankings daily move to pass changePct number to DailyMovePill.")
