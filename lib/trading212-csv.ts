export type Trading212InvestmentPosition = {
  sourceTicker: string;
  shares: number;
  entryPrice: number;
  costBasis: number;
  purchaseDate: string | null;
};

export type Trading212CsvParseResult =
  | {
      accepted: true;
      positions: Trading212InvestmentPosition[];
      ignoredNonInvestmentRows: number;
      investmentRows: number;
    }
  | {
      accepted: false;
      positions: [];
      ignoredNonInvestmentRows: number;
      investmentRows: number;
      issues: string[];
    };

export type Trading212SupportedInstrument = {
  ticker: string;
  score: number | null;
  rank: number | null;
};

export type Trading212MappedHolding = {
  ticker: string;
  shares: number;
  entry_price: number;
  purchase_date: string | null;
  score_at_entry: number | null;
  rank_at_entry: number | null;
  allocation_pct: null;
};

export type Trading212MappingResult =
  | { accepted: true; holdings: Trading212MappedHolding[] }
  | { accepted: false; unsupportedTickers: string[]; issues: string[] };

type CsvRow = Record<string, string>;

type InvestmentEvent = {
  rowNumber: number;
  ticker: string;
  side: "buy" | "sell";
  shares: number;
  price: number;
  timestamp: number | null;
  date: string | null;
};

const INVESTMENT_ACTIONS = ["buy", "sell"] as const;
const NON_INVESTMENT_ACTION_MARKERS = [
  "cash deposit",
  "deposit",
  "withdrawal",
  "withdraw",
  "dividend",
  "interest",
  "fee",
  "currency conversion",
  "conversion",
  "exchange",
  "card",
  "transfer",
  "tax",
  "lending",
] as const;

function normaliseHeader(header: string) {
  return header
    .trim()
    .toLowerCase()
    .replace(/\uFEFF/gu, "")
    .replace(/[^a-z0-9]+/gu, "");
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function parseCsv(csvText: string): CsvRow[] {
  const cleaned = csvText.replace(/\r\n/gu, "\n").replace(/\r/gu, "\n").trim();
  if (!cleaned) return [];
  const lines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map(normaliseHeader);
  if (headers.some((header) => !header)) return [];

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? ""]),
    );
  });
}

function getFirstValue(row: CsvRow, possibleHeaders: string[]) {
  for (const header of possibleHeaders) {
    const value = row[normaliseHeader(header)];
    if (value != null && value.trim() !== "") return value.trim();
  }
  return "";
}

function parseNumber(value: string) {
  if (!value.trim()) return null;
  const cleaned = value
    .replace(/[£$€,%]/gu, "")
    .replace(/\s/gu, "")
    .replace(/^\((.*)\)$/u, "-$1")
    .replace(/,/gu, "");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function roundShares(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function roundPrice(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function parseDateEvidence(value: string) {
  const raw = value.trim();
  if (!raw) return { timestamp: null, date: null };

  const isoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/u);
  if (isoDate) {
    const date = `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;
    const timestamp = Date.UTC(
      Number(isoDate[1]),
      Number(isoDate[2]) - 1,
      Number(isoDate[3]),
      Number(isoDate[4] ?? 0),
      Number(isoDate[5] ?? 0),
      Number(isoDate[6] ?? 0),
    );
    return { timestamp, date };
  }

  const ukDate = raw.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/u);
  if (ukDate) {
    const year = Number(ukDate[3].length === 2 ? `20${ukDate[3]}` : ukDate[3]);
    const month = Number(ukDate[2]);
    const day = Number(ukDate[1]);
    const date = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return {
      timestamp: Date.UTC(
        year,
        month - 1,
        day,
        Number(ukDate[4] ?? 0),
        Number(ukDate[5] ?? 0),
        Number(ukDate[6] ?? 0),
      ),
      date,
    };
  }

  return { timestamp: null, date: null };
}

export function normaliseTrading212Ticker(value: string) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s.*$/u, "")
    .replace(/_US_EQ$/u, "")
    .replace(/(?:\.US|-US|_US|:US)$/u, "");
}

export function trading212TickerCandidates(value: string) {
  const base = normaliseTrading212Ticker(value);
  if (!base) return [];
  return Array.from(
    new Set([base, base.replace(/\./gu, "-"), base.replace(/-/gu, ".")]),
  ).filter(Boolean);
}

export function mapTrading212Positions(
  positions: Trading212InvestmentPosition[],
  supportedInstruments: Trading212SupportedInstrument[],
): Trading212MappingResult {
  const stockMap = new Map(
    supportedInstruments.map((row) => [row.ticker.toUpperCase(), row]),
  );
  const unsupportedTickers: string[] = [];
  const issues: string[] = [];
  const holdings: Trading212MappedHolding[] = [];
  const claimedCanonicalTickers = new Map<string, string>();

  for (const position of positions) {
    const matches = trading212TickerCandidates(position.sourceTicker)
      .map((candidate) => stockMap.get(candidate))
      .filter((row): row is Trading212SupportedInstrument => Boolean(row));
    const uniqueMatches = Array.from(
      new Map(matches.map((row) => [row.ticker.toUpperCase(), row])).values(),
    );
    if (uniqueMatches.length === 0) {
      unsupportedTickers.push(position.sourceTicker);
      continue;
    }
    if (uniqueMatches.length > 1) {
      issues.push(
        `${position.sourceTicker} maps ambiguously to ${uniqueMatches.map((row) => row.ticker).join(", ")}.`,
      );
      continue;
    }
    const match = uniqueMatches[0];
    const ticker = match.ticker.toUpperCase();
    const alreadyClaimedBy = claimedCanonicalTickers.get(ticker);
    if (alreadyClaimedBy && alreadyClaimedBy !== position.sourceTicker) {
      issues.push(`${alreadyClaimedBy} and ${position.sourceTicker} both map to ${ticker}.`);
      continue;
    }
    claimedCanonicalTickers.set(ticker, position.sourceTicker);
    holdings.push({
      ticker,
      shares: position.shares,
      entry_price: position.entryPrice,
      purchase_date: position.purchaseDate,
      score_at_entry: match.score == null ? null : Number(match.score),
      rank_at_entry: match.rank == null ? null : Number(match.rank),
      allocation_pct: null,
    });
  }

  if (unsupportedTickers.length > 0 || issues.length > 0) {
    return {
      accepted: false,
      unsupportedTickers: Array.from(new Set(unsupportedTickers)).sort(),
      issues,
    };
  }
  return {
    accepted: true,
    holdings: holdings.sort((a, b) => a.ticker.localeCompare(b.ticker)),
  };
}

function classifyAction(action: string, hasInvestmentFields: boolean) {
  const normalized = action.trim().toLowerCase();
  const investment = INVESTMENT_ACTIONS.find((candidate) => normalized.includes(candidate));
  if (investment) return investment;
  if (!normalized && hasInvestmentFields) return "buy";
  if (
    NON_INVESTMENT_ACTION_MARKERS.some((candidate) => normalized.includes(candidate)) ||
    (!hasInvestmentFields && normalized !== "")
  ) {
    return "ignore";
  }
  return "invalid";
}

function rowInvestmentFields(row: CsvRow) {
  const ticker = getFirstValue(row, [
    "Ticker",
    "Symbol",
    "Instrument ticker",
    "Instrument",
    "ISIN ticker",
  ]);
  const shares = getFirstValue(row, [
    "No. of shares",
    "No of shares",
    "Shares",
    "Quantity",
    "Qty",
    "Number of shares",
    "Filled quantity",
  ]);
  const price = getFirstValue(row, [
    "Price / share",
    "Price per share",
    "Price",
    "Average price",
    "Avg price",
    "Avg. price",
    "Execution price",
  ]);
  const total = getFirstValue(row, [
    "Total",
    "Total value",
    "Value",
    "Amount",
    "Result",
    "Order value",
  ]);
  return { ticker, shares, price, total };
}

export function parseTrading212Csv(csvText: string): Trading212CsvParseResult {
  const rows = parseCsv(csvText);
  const issues: string[] = [];
  const events: InvestmentEvent[] = [];
  let ignoredNonInvestmentRows = 0;
  let investmentRows = 0;

  if (rows.length === 0) {
    return {
      accepted: false,
      positions: [],
      ignoredNonInvestmentRows: 0,
      investmentRows: 0,
      issues: ["The CSV is empty or does not contain a usable header and data row."],
    };
  }

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const fields = rowInvestmentFields(row);
    const action = getFirstValue(row, ["Action", "Type", "Transaction type", "Event"]);
    const hasInvestmentFields = Boolean(fields.ticker || fields.shares || fields.price);
    const classification = classifyAction(action, hasInvestmentFields);

    if (classification === "ignore") {
      ignoredNonInvestmentRows += 1;
      return;
    }
    if (classification === "invalid") {
      issues.push(`Row ${rowNumber} has an unrecognised investment-like action.`);
      return;
    }

    investmentRows += 1;
    const ticker = normaliseTrading212Ticker(fields.ticker);
    const rawShares = parseNumber(fields.shares);
    const rawPrice = parseNumber(fields.price);
    const rawTotal = parseNumber(fields.total);
    const shares = rawShares == null ? null : Math.abs(rawShares);
    const derivedPrice =
      rawPrice != null && Math.abs(rawPrice) > 0
        ? Math.abs(rawPrice)
        : shares != null && shares > 0 && rawTotal != null && Math.abs(rawTotal) > 0
          ? Math.abs(rawTotal) / shares
          : null;

    if (!ticker || !/^[A-Z][A-Z0-9.\-]{0,15}$/u.test(ticker)) {
      issues.push(`Row ${rowNumber} has a missing or invalid investment ticker.`);
      return;
    }
    if (shares == null || shares <= 0) {
      issues.push(`Row ${rowNumber} (${ticker}) has an invalid share quantity.`);
      return;
    }
    if (derivedPrice == null || derivedPrice <= 0) {
      issues.push(`Row ${rowNumber} (${ticker}) has no defensible positive execution price.`);
      return;
    }

    const dateValue = getFirstValue(row, [
      "Date",
      "Time",
      "Created",
      "Execution time",
      "Trading time",
      "Transaction date",
    ]);
    const dateEvidence = parseDateEvidence(dateValue);
    events.push({
      rowNumber,
      ticker,
      side: classification,
      shares: roundShares(shares),
      price: roundPrice(derivedPrice),
      timestamp: dateEvidence.timestamp,
      date: dateEvidence.date,
    });
  });

  if (issues.length > 0) {
    return { accepted: false, positions: [], ignoredNonInvestmentRows, investmentRows, issues };
  }

  const eventsByTicker = new Map<string, InvestmentEvent[]>();
  for (const event of events) {
    const current = eventsByTicker.get(event.ticker) ?? [];
    current.push(event);
    eventsByTicker.set(event.ticker, current);
  }

  const positions: Trading212InvestmentPosition[] = [];
  for (const [ticker, tickerEvents] of eventsByTicker) {
    const hasSale = tickerEvents.some((event) => event.side === "sell");
    if (hasSale && tickerEvents.some((event) => event.timestamp == null)) {
      issues.push(`${ticker} includes a sale but does not provide complete chronological evidence.`);
      continue;
    }
    if (hasSale) {
      const timestampCounts = new Map<number, number>();
      for (const event of tickerEvents) {
        const timestamp = event.timestamp as number;
        timestampCounts.set(timestamp, (timestampCounts.get(timestamp) ?? 0) + 1);
      }
      if (Array.from(timestampCounts.values()).some((count) => count > 1)) {
        issues.push(`${ticker} has investment rows with ambiguous identical timestamps.`);
        continue;
      }
    }

    const ordered = hasSale
      ? [...tickerEvents].sort((a, b) => (a.timestamp as number) - (b.timestamp as number))
      : tickerEvents;
    let shares = 0;
    let cost = 0;
    let purchaseDate: string | null = null;

    for (const event of ordered) {
      if (event.side === "buy") {
        shares = roundShares(shares + event.shares);
        cost += event.shares * event.price;
        purchaseDate = purchaseDate ?? event.date;
        continue;
      }
      if (shares <= 0 || event.shares > shares + 0.0000005) {
        issues.push(`Row ${event.rowNumber} (${ticker}) sells more shares than the CSV has established.`);
        break;
      }
      const averageCost = cost / shares;
      shares = roundShares(shares - event.shares);
      cost = shares <= 0 ? 0 : cost - event.shares * averageCost;
    }

    if (shares > 0 && !issues.some((issue) => issue.includes(`(${ticker})`) || issue.startsWith(ticker))) {
      const entryPrice = cost / shares;
      if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
        issues.push(`${ticker} has an indeterminate remaining cost basis.`);
      } else {
        positions.push({
          sourceTicker: ticker,
          shares: roundShares(shares),
          entryPrice: roundPrice(entryPrice),
          costBasis: roundMoney(roundShares(shares) * roundPrice(entryPrice)),
          purchaseDate,
        });
      }
    }
  }

  if (issues.length > 0) {
    return { accepted: false, positions: [], ignoredNonInvestmentRows, investmentRows, issues };
  }
  if (positions.length === 0) {
    return {
      accepted: false,
      positions: [],
      ignoredNonInvestmentRows,
      investmentRows,
      issues: ["The CSV does not reconstruct any open investment holdings."],
    };
  }

  return {
    accepted: true,
    positions: positions.sort((a, b) => a.sourceTicker.localeCompare(b.sourceTicker)),
    ignoredNonInvestmentRows,
    investmentRows,
  };
}
