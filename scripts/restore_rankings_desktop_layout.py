from pathlib import Path

path = Path("app/rankings/page.tsx")
text = path.read_text()

old_header = '''            <div
              className={`hidden ${gridCols} items-center gap-3 border-b border-[#072116]/10 bg-[#072116] px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-[#faf6f0]/82 lg:grid`}
            >'''
new_header = '''            <div className="hidden grid-cols-[58px_76px_108px_minmax(0,1fr)_minmax(170px,220px)_92px_96px] items-center gap-3 border-b border-[#072116]/10 bg-[#072116] px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-[#faf6f0]/82 lg:grid">'''

old_row = '''                        className={`group grid min-h-[76px] grid-cols-[46px_minmax(0,1fr)_70px] items-center gap-2 px-3 py-3 transition hover:bg-[#ddb159]/10 sm:grid-cols-[54px_minmax(0,1fr)_82px_78px] lg:${gridCols} lg:min-h-[64px] lg:gap-3 lg:px-4`}'''
new_row = '''                        className="group grid min-h-[76px] grid-cols-[46px_minmax(0,1fr)_70px] items-center gap-2 px-3 py-3 transition hover:bg-[#ddb159]/10 sm:grid-cols-[54px_minmax(0,1fr)_82px_78px] lg:min-h-[64px] lg:grid-cols-[58px_76px_108px_minmax(0,1fr)_minmax(170px,220px)_92px_96px] lg:gap-3 lg:px-4"'''

if old_header not in text:
    raise SystemExit("Could not find rankings header grid block")
if old_row not in text:
    raise SystemExit("Could not find rankings row dynamic grid block")

text = text.replace(old_header, new_header)
text = text.replace(old_row, new_row)

# The gridCols variable is no longer needed and was the source of the Tailwind desktop issue.
text = text.replace('''
  const gridCols =
    "grid-cols-[58px_76px_108px_minmax(0,1fr)_minmax(170px,220px)_92px_96px]";
''', "")

path.write_text(text)
print("Restored rankings desktop grid layout with static Tailwind classes.")
