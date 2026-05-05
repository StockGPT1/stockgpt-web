import { getTickerTape } from "@/lib/yahoo";

function formatPrice(value: number) {
  if (!Number.isFinite(value)) return "—";

  if (value >= 1000) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return value.toFixed(2);
}

function formatChangePct(value: number) {
  if (!Number.isFinite(value)) return "—";

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function toneClassName(value: number) {
  if (value > 0) return "text-emerald-300";
  if (value < 0) return "text-red-300";
  return "text-[#faf6f0]/70";
}

function arrow(value: number) {
  if (value > 0) return "▲";
  if (value < 0) return "▼";
  return "■";
}

export async function TickerTape() {
  const tickerItems = await getTickerTape([
    "^GSPC",
    "^IXIC",
    "^DJI",
    "^VIX",
    "AAPL",
    "MSFT",
    "NVDA",
    "AMZN",
    "GOOGL",
    "META",
  ]);

  if (tickerItems.length === 0) {
    return null;
  }

  const repeated = [...tickerItems, ...tickerItems, ...tickerItems];

  return (
    <div className="relative z-30 h-[30px] shrink-0 overflow-hidden border-b border-[#ddb159]/16 bg-[#03140d] shadow-[0_6px_18px_rgba(0,0,0,0.22)]">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#03140d] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#03140d] to-transparent" />

      <div className="stock-ticker-track flex h-full min-w-max items-center whitespace-nowrap">
        {repeated.map((item, index) => (
          <div
            key={`${item.yahooSymbol}-${index}`}
            className="flex h-full items-center gap-2 border-r border-[#ddb159]/14 px-5"
            title={`${item.symbol}: ${formatPrice(item.price)} (${formatChangePct(
              item.changePct,
            )})`}
          >
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
              {item.symbol}
            </span>

            <span className="text-[10px] font-bold tabular-nums text-[#faf6f0]/82">
              {formatPrice(item.price)}
            </span>

            <span
              className={[
                "text-[10px] font-extrabold tabular-nums",
                toneClassName(item.changePct),
              ].join(" ")}
            >
              {arrow(item.changePct)} {formatChangePct(item.changePct)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
