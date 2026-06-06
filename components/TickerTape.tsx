import Link from "next/link";
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

function isStockTicker(yahooSymbol: string) {
  return !yahooSymbol.startsWith("^");
}

function TickerInner({
  symbol,
  price,
  changePct,
}: {
  symbol: string;
  price: number;
  changePct: number;
}) {
  return (
    <>
      <span className="text-[9px] font-black uppercase tracking-[0.14em] text-[#ddb159]">
        {symbol}
      </span>

      <span className="text-[9px] font-bold tabular-nums text-[#faf6f0]/78">
        {formatPrice(price)}
      </span>

      <span
        className={[
          "text-[9px] font-extrabold tabular-nums",
          toneClassName(changePct),
        ].join(" ")}
      >
        {arrow(changePct)} {formatChangePct(changePct)}
      </span>
    </>
  );
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
    <div className="relative z-30 h-[24px] shrink-0 overflow-hidden border-b border-[#ddb159]/14 bg-[#03140d] shadow-[0_5px_14px_rgba(0,0,0,0.2)]">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-14 bg-gradient-to-r from-[#03140d] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-14 bg-gradient-to-l from-[#03140d] to-transparent" />

      <div className="stock-ticker-track flex h-full min-w-max items-center whitespace-nowrap">
        {repeated.map((item, index) => {
          const title = `${item.symbol}: ${formatPrice(item.price)} (${formatChangePct(
            item.changePct,
          )})`;

          const className =
            "flex h-full items-center gap-2 border-r border-[#ddb159]/12 px-4 transition hover:bg-[#ddb159]/10";

          if (isStockTicker(item.yahooSymbol)) {
            return (
              <Link
                key={`${item.yahooSymbol}-${index}`}
                href={`/stock/${encodeURIComponent(item.yahooSymbol)}`}
                className={className}
                title={`${title} — open ${item.yahooSymbol}`}
              >
                <TickerInner
                  symbol={item.symbol}
                  price={item.price}
                  changePct={item.changePct}
                />
              </Link>
            );
          }

          return (
            <div
              key={`${item.yahooSymbol}-${index}`}
              className={className}
              title={title}
            >
              <TickerInner
                symbol={item.symbol}
                price={item.price}
                changePct={item.changePct}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}