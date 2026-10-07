export type ScannerIndicatorCategory = "Momentum" | "Trend" | "Moving averages" | "Volatility" | "Volume" | "Price levels";
export type ScannerIndicator = {
  id: string;
  name: string;
  aliases: readonly string[];
  category: ScannerIndicatorCategory;
  evidence: string;
};

// Recognition reference, not a calculation engine or an accuracy benchmark.
// Names were checked against these primary catalogs; the visual guidance is
// deliberately limited to labelled plots and evidence present in the upload:
// https://www.tradingview.com/support/folders/43000587405-built-in-indicators/
// https://xgboosted.github.io/pandas-ta-classic/indicators.html
// https://ta-lib.github.io/ta-lib-python/funcs.html
// https://www.mql5.com/en/docs/indicators/iframa
// https://www.mql5.com/en/docs/indicators/iac
// Aliases, lookback periods and individual lines within an indicator do not
// contribute extra entries. Candle formations have their own separate catalog.
export const SCANNER_INDICATOR_CATALOG: readonly ScannerIndicator[] = [
  { id: "rsi", name: "RSI", aliases: ["Relative Strength Index"], category: "Momentum", evidence: "Read the labelled RSI line against visible midline and extreme levels; divergence needs aligned price swings." },
  { id: "macd", name: "MACD", aliases: ["Moving Average Convergence Divergence"], category: "Momentum", evidence: "Compare labelled MACD and signal lines, zero crossings and histogram direction; do not count them as separate indicators." },
  { id: "stochastic", name: "Stochastic", aliases: ["Stochastic Oscillator", "Stoch", "Slow Stochastic", "Fast Stochastic"], category: "Momentum", evidence: "Compare the labelled K and D plots and visible extreme zones; distinguish stochastic price from Stochastic RSI." },
  { id: "stochastic-rsi", name: "Stochastic RSI", aliases: ["Stoch RSI", "StochRSI"], category: "Momentum", evidence: "Require a Stochastic RSI label; read visible K/D crosses and zones without substituting ordinary RSI values." },
  { id: "cci", name: "Commodity Channel Index", aliases: ["CCI"], category: "Momentum", evidence: "Read visible CCI zero or labelled threshold crossings and turning direction; avoid assuming hidden threshold values." },
  { id: "cmo", name: "Chande Momentum Oscillator", aliases: ["CMO"], category: "Momentum", evidence: "Use the labelled CMO line, visible zero level and turning points to describe momentum balance." },
  { id: "momentum", name: "Momentum", aliases: ["MOM", "Momentum Indicator"], category: "Momentum", evidence: "Check the labelled momentum plot against its displayed baseline; implementations may use different baselines." },
  { id: "roc", name: "Rate of Change", aliases: ["ROC", "ROCP", "ROCR", "ROCR100"], category: "Momentum", evidence: "Read the labelled rate-of-change plot and its displayed baseline; percentage and ratio variants remain one family." },
  { id: "williams-r", name: "Williams %R", aliases: ["Williams R", "WILLR", "%R"], category: "Momentum", evidence: "Read the labelled Williams range oscillator against visible zones and recent turns; do not confuse it with RSI." },
  { id: "ultimate-oscillator", name: "Ultimate Oscillator", aliases: ["UO", "ULTOSC"], category: "Momentum", evidence: "Describe visible oscillator direction or labelled zone crossings; divergence requires matching price and oscillator swings." },
  { id: "awesome-oscillator", name: "Awesome Oscillator", aliases: ["AO"], category: "Momentum", evidence: "Check the labelled histogram relative to zero and previous bars; colour alone does not establish a trade trigger." },
  { id: "accelerator-oscillator", name: "Accelerator Oscillator", aliases: ["Accelerator Decelerator Oscillator", "AC Oscillator"], category: "Momentum", evidence: "Identify the labelled acceleration histogram and changes around its visible baseline, separate from Awesome Oscillator." },
  { id: "ppo", name: "Percentage Price Oscillator", aliases: ["PPO"], category: "Momentum", evidence: "Read labelled PPO and signal plots plus zero crossings; preserve its percentage scale rather than MACD units." },
  { id: "apo", name: "Absolute Price Oscillator", aliases: ["APO"], category: "Momentum", evidence: "Read the labelled absolute oscillator relative to its visible zero line; do not substitute percentage oscillator values." },
  { id: "trix", name: "TRIX", aliases: ["Triple Exponential Oscillator"], category: "Momentum", evidence: "Use labelled TRIX direction, visible zero and signal crossings; a hidden signal line cannot supply a cross." },
  { id: "true-strength", name: "True Strength Index", aliases: ["SMI Ergodic", "SMI Ergodic Indicator", "SMI Ergodic Oscillator"], category: "Momentum", evidence: "Require the full true-strength or SMI Ergodic label and compare visible main/signal lines and zero; TSI alone is ambiguous." },
  { id: "dpo", name: "Detrended Price Oscillator", aliases: ["DPO"], category: "Momentum", evidence: "Describe visible cyclical turns; account for any displayed offset and never treat shifted peaks as current entry timing." },
  { id: "kst", name: "Know Sure Thing", aliases: ["KST", "KST Oscillator"], category: "Momentum", evidence: "Read labelled KST and signal crosses or baseline turns; report only the lines actually visible." },
  { id: "coppock", name: "Coppock Curve", aliases: ["Coppock"], category: "Momentum", evidence: "Use the labelled curve, visible zero level and upward or downward turn; timeframe context must be readable." },
  { id: "fisher-transform", name: "Fisher Transform", aliases: ["Fisher"], category: "Momentum", evidence: "Read the labelled Fisher and trigger plots against visible turns and extremes; unlabeled spikes are insufficient." },
  { id: "relative-vigor", name: "Relative Vigor Index", aliases: ["RVGI", "Relative Vigor"], category: "Momentum", evidence: "Require the full vigor label or RVGI; compare visible main and signal lines without confusing volatility RVI." },
  { id: "elder-ray", name: "Elder Ray Index", aliases: ["Elder Ray", "Elder-Ray", "Bull Bear Power", "Bulls Bears Power"], category: "Momentum", evidence: "Use labelled bull and bear power plots as one indicator; compare their visible signs and change with price." },
  { id: "balance-of-power", name: "Balance of Power", aliases: ["BOP"], category: "Momentum", evidence: "Read the labelled power plot, baseline and recent balance shift; avoid claims about unseen order-book activity." },
  { id: "efficiency-ratio", name: "Efficiency Ratio", aliases: ["Kaufman Efficiency Ratio", "ER"], category: "Momentum", evidence: "Describe visible efficiency rising or falling; efficiency measures directional consistency, not bullish versus bearish direction." },
  { id: "schaff-trend-cycle", name: "Schaff Trend Cycle", aliases: ["STC"], category: "Momentum", evidence: "Read the labelled cycle line and visible extreme-zone exits, without inventing unstated thresholds." },
  { id: "connors-rsi", name: "Connors RSI", aliases: ["CRSI", "ConnorsRSI"], category: "Momentum", evidence: "Require a Connors RSI label; use visible composite readings or turns without treating it as ordinary RSI." },
  { id: "chande-forecast", name: "Chande Forecast Oscillator", aliases: ["CFO"], category: "Momentum", evidence: "Read the labelled forecast oscillator relative to displayed zero and recent turns; projected price is not a promised outcome." },
  { id: "price-momentum", name: "Price Momentum Oscillator", aliases: ["PMO", "DecisionPoint PMO"], category: "Momentum", evidence: "Read labelled PMO and signal plots, visible crosses and slope; no cross can be inferred from a single hidden line." },
  { id: "stochastic-momentum", name: "Stochastic Momentum Index", aliases: ["Stochastic Momentum"], category: "Momentum", evidence: "Require the full stochastic-momentum label and visible plots; SMI alone is ambiguous with the different SMI Ergodic system." },
  { id: "kdj", name: "KDJ", aliases: ["KDJ Oscillator"], category: "Momentum", evidence: "Identify the labelled K, D and J plots together; J overshoot is a displayed oscillator feature, not a guaranteed reversal." },
  { id: "qqe", name: "Quantitative Qualitative Estimation", aliases: ["QQE"], category: "Momentum", evidence: "Read labelled QQE main and trailing plots, visible crosses and zones; do not invent hidden RSI calculations." },
  { id: "rsx", name: "RSX", aliases: ["Relative Strength Xtra"], category: "Momentum", evidence: "Require the RSX label and use visible turns or zones; do not rename an unlabelled smooth line RSX." },
  { id: "center-of-gravity", name: "Center of Gravity Oscillator", aliases: ["Center of Gravity", "CG Oscillator", "COG Oscillator"], category: "Momentum", evidence: "Use labelled oscillator and trigger lines with their visible turns; do not confuse it with a similarly named price channel." },

  { id: "adx", name: "Average Directional Index", aliases: ["ADX", "DMI", "Directional Movement Index"], category: "Trend", evidence: "ADX describes strength, not direction; use labelled DI lines for directional comparison and count the whole system once." },
  { id: "aroon", name: "Aroon", aliases: ["Aroon Up Down", "Aroon Indicator", "Aroon Oscillator", "AROONOSC"], category: "Trend", evidence: "Compare labelled up/down lines, or zero on an explicitly labelled oscillator display; components and oscillator variant count as one family." },
  { id: "vortex", name: "Vortex Indicator", aliases: ["Vortex", "VI"], category: "Trend", evidence: "Compare the labelled positive and negative vortex plots; only a visible crossing supports a change in lead." },
  { id: "parabolic-sar", name: "Parabolic SAR", aliases: ["PSAR", "SAR"], category: "Trend", evidence: "Require labelled SAR dots; describe their visible side of price and flips, not an unseen stop value." },
  { id: "supertrend", name: "Supertrend", aliases: ["Super Trend"], category: "Trend", evidence: "Use the labelled trail and visible price relationship or flips; colour alone cannot establish the indicator identity." },
  { id: "ichimoku", name: "Ichimoku", aliases: ["Ichimoku Cloud", "Ichimoku Kinko Hyo"], category: "Trend", evidence: "Read labelled cloud and lines relative to price; distinguish projected cloud from current evidence and count components once." },
  { id: "special-k", name: "Pring Special K", aliases: ["Pring's Special K", "Special K"], category: "Momentum", evidence: "Read the labelled composite momentum curve and visible signal or baseline; multiple smoothed components count as one system." },
  { id: "trend-strength", name: "Trend Strength Index", aliases: ["Trend Strength"], category: "Trend", evidence: "Require the full trend-strength label and visible signed trend plot; TSI alone is ambiguous with True Strength Index." },
  { id: "choppiness", name: "Choppiness Index", aliases: ["CHOP"], category: "Trend", evidence: "Use the labelled choppiness curve to describe range versus trend conditions; it does not independently supply direction." },
  { id: "vhf", name: "Vertical Horizontal Filter", aliases: ["VHF"], category: "Trend", evidence: "Read rising or falling labelled filter values as changing trendiness, without assigning a direction from the filter alone." },
  { id: "rank-correlation", name: "Rank Correlation Index", aliases: ["RCI", "RCI Ribbon"], category: "Momentum", evidence: "Read the labelled rank-correlation curves and displayed reference levels; multiple ribbon lookbacks remain one type." },
  { id: "gann-hilo", name: "Gann HiLo Activator", aliases: ["HiLo Activator", "HILO"], category: "Trend", evidence: "Use the labelled activator trail and visible side changes relative to price; no unseen trail levels can be priced." },
  { id: "chande-kroll", name: "Chande Kroll Stop", aliases: ["Chande-Kroll Stop", "CKS"], category: "Trend", evidence: "Read labelled long and short stop trails and price crossings; treat settings-dependent distances as chart observations." },
  { id: "chandelier-exit", name: "Chandelier Exit", aliases: ["Chandelier", "CE"], category: "Trend", evidence: "Compare labelled exit trails with price and visible trail flips; avoid declaring a position or executed exit." },
  { id: "ttm-trend", name: "TTM Trend", aliases: ["TTM_Trend"], category: "Trend", evidence: "Require the TTM Trend label or legend and explain the displayed trend state without inventing its hidden source settings." },
  { id: "qstick", name: "Qstick", aliases: ["Q Stick"], category: "Trend", evidence: "Read the labelled Qstick plot relative to its visible zero level and recent direction; do not recalculate candle-body averages." },

  { id: "ema", name: "EMA", aliases: ["Exponential Moving Average"], category: "Moving averages", evidence: "Use the labelled EMA, displayed period and price relationship; crossings need both visible labelled lines." },
  { id: "sma", name: "SMA", aliases: ["Simple Moving Average"], category: "Moving averages", evidence: "Read the labelled simple average and price position; MA without a readable method remains an unidentified generic average." },
  { id: "wma", name: "Weighted Moving Average", aliases: ["WMA"], category: "Moving averages", evidence: "Require a weighted-average label and describe visible slope or price crossing; do not infer its period." },
  { id: "hma", name: "Hull Moving Average", aliases: ["HMA"], category: "Moving averages", evidence: "Use the labelled Hull line, its visible slope and relation to price; smoothing is not a promise of timely turns." },
  { id: "dema", name: "Double Exponential Moving Average", aliases: ["DEMA"], category: "Moving averages", evidence: "Require the DEMA label and read visible line slope or crossing; a pair of EMAs is not automatically DEMA." },
  { id: "tema", name: "Triple Exponential Moving Average", aliases: ["TEMA"], category: "Moving averages", evidence: "Require the TEMA label and inspect visible price relation; three plotted EMAs are not evidence of TEMA." },
  { id: "t3", name: "Tillson T3", aliases: ["T3", "T3 Moving Average"], category: "Moving averages", evidence: "Read the labelled T3 line and visible slope or crossing; do not infer smoothing settings." },
  { id: "kama", name: "Kaufman Adaptive Moving Average", aliases: ["KAMA", "Kaufman's Adaptive Moving Average"], category: "Moving averages", evidence: "Use the labelled adaptive average's visible slope and price position; hidden efficiency calculations are unavailable." },
  { id: "vidya", name: "Variable Index Dynamic Average", aliases: ["VIDYA"], category: "Moving averages", evidence: "Read the labelled dynamic average and price relationship; do not estimate invisible adaptation parameters." },
  { id: "alma", name: "Arnaud Legoux Moving Average", aliases: ["ALMA"], category: "Moving averages", evidence: "Use the labelled ALMA line, displayed slope and crossings; offset and sigma settings cannot be guessed." },
  { id: "frama", name: "Fractal Adaptive Moving Average", aliases: ["FRAMA"], category: "Moving averages", evidence: "Require the FRAMA label and describe its visible line relation to price without inventing fractal dimensions." },
  { id: "vwma", name: "Volume Weighted Moving Average", aliases: ["VWMA"], category: "Moving averages", evidence: "Read the labelled VWMA and price position; distinguish its rolling lookback from cumulative VWAP." },
  { id: "smma", name: "Smoothed Moving Average", aliases: ["SMMA", "RMA", "Wilder Moving Average", "Wilder's Moving Average"], category: "Moving averages", evidence: "Use the labelled smoothed average, its visible slope and crossing; Wilder/RMA aliases do not create extra indicators." },
  { id: "zero-lag-ma", name: "Zero Lag Moving Average", aliases: ["ZLMA", "ZLEMA", "Zero Lag EMA", "Zero Lag Exponential Moving Average"], category: "Moving averages", evidence: "Require the zero-lag average label and read visible relation to price; its name does not prove zero practical delay." },
  { id: "lsma", name: "Least Squares Moving Average", aliases: ["LSMA", "Linear Regression Moving Average", "Linear Regression Curve"], category: "Moving averages", evidence: "Read the labelled fitted average and price position; a regression fit does not establish a future price path." },
  { id: "mcginley", name: "McGinley Dynamic", aliases: ["MCGD", "McGinley"], category: "Moving averages", evidence: "Use the labelled dynamic line and visible price relationship without reconstructing its adaptation formula." },
  { id: "mama", name: "MESA Adaptive Moving Average", aliases: ["MAMA"], category: "Moving averages", evidence: "Read labelled MAMA and any paired FAMA line together as one system; crosses require both plots to be visible." },
  { id: "swma", name: "Symmetrically Weighted Moving Average", aliases: ["SWMA"], category: "Moving averages", evidence: "Require the SWMA label and use visible price relation and slope, without inferring unseen weighting choices." },
  { id: "jma", name: "Jurik Moving Average", aliases: ["JMA"], category: "Moving averages", evidence: "Read the labelled Jurik line and price relation; variants or proprietary settings cannot be determined from line shape." },
  { id: "trima", name: "Triangular Moving Average", aliases: ["TRIMA", "TMA"], category: "Moving averages", evidence: "Require the triangular-average label and read visible slope or crossings; do not identify it from smoothness alone." },
  { id: "super-smoother", name: "Ehlers Super Smoother", aliases: ["Super Smoother", "SSF", "Super Smoother Filter"], category: "Moving averages", evidence: "Use the labelled smoothed price filter and visible line relation to price; filter parameters remain unknown unless shown." },

  { id: "bollinger-bands", name: "Bollinger Bands", aliases: ["BB", "BBANDS"], category: "Volatility", evidence: "Read labelled upper, middle and lower bands together; visible width and price position do not guarantee a breakout." },
  { id: "keltner", name: "Keltner Channel", aliases: ["Keltner Channels", "KC"], category: "Volatility", evidence: "Use the labelled channel, its visible width and price relation; distinguish it from Bollinger Bands by the label." },
  { id: "donchian", name: "Donchian Channel", aliases: ["Donchian Channels", "DC", "Price Channel"], category: "Volatility", evidence: "Read the labelled high/low channel and visible boundary tests; require a closed candle before claiming a completed break." },
  { id: "atr", name: "Average True Range", aliases: ["ATR"], category: "Volatility", evidence: "Describe the visible ATR line as range magnitude; ATR does not independently provide bullish or bearish direction." },
  { id: "natr", name: "Normalized Average True Range", aliases: ["NATR", "Normalized ATR"], category: "Volatility", evidence: "Read the labelled normalized range plot and its percentage scale; do not substitute absolute ATR values." },
  { id: "historical-volatility", name: "Historical Volatility", aliases: ["HV", "HVOL", "Realized Volatility"], category: "Volatility", evidence: "Use labelled historical volatility and visible change; annualization, lookback and forecast volatility cannot be inferred." },
  { id: "relative-volatility", name: "Relative Volatility Index", aliases: ["RVI Volatility"], category: "Volatility", evidence: "Require an explicit volatility label; RVI alone is ambiguous with Relative Vigor Index and must remain unidentified." },
  { id: "chaikin-volatility", name: "Chaikin Volatility", aliases: ["CVI"], category: "Volatility", evidence: "Read the labelled volatility curve and recent expansion or contraction without confusing it with Chaikin Money Flow." },
  { id: "mass-index", name: "Mass Index", aliases: ["MASSI"], category: "Volatility", evidence: "Read the labelled mass curve and displayed thresholds; range expansion does not by itself establish reversal direction." },
  { id: "ulcer-index", name: "Ulcer Index", aliases: ["UI"], category: "Volatility", evidence: "Use the labelled drawdown-risk plot and visible change; it describes downside stress, not a guaranteed next move." },
  { id: "acceleration-bands", name: "Acceleration Bands", aliases: ["ACCBANDS", "ABANDS"], category: "Volatility", evidence: "Require labelled acceleration bands and describe visible boundary tests or width; no hidden band value may be supplied." },
  { id: "aberration", name: "Aberration", aliases: ["Aberration Channel"], category: "Volatility", evidence: "Use the labelled channel and visible price placement; do not infer its construction from three unlabelled lines." },
  { id: "holt-winter", name: "Holt Winter Channel", aliases: ["Holt Winters Channel", "HWC"], category: "Volatility", evidence: "Read labelled fitted channel bounds and price relation; projected smoothing lines remain estimates, not future observations." },
  { id: "volume-flow", name: "Volume Flow Indicator", aliases: ["VFI"], category: "Volume", evidence: "Read the labelled volume-flow curve, visible baseline and aligned price swings; no hidden flow calculations may be reconstructed." },
  { id: "elder-thermometer", name: "Elder Thermometer", aliases: ["Elder's Thermometer", "THERMO"], category: "Volatility", evidence: "Read the labelled activity plot and any visible average; range activity does not independently determine price direction." },

  { id: "volume", name: "Volume", aliases: ["VOL", "Trading Volume"], category: "Volume", evidence: "Compare visible volume bars with nearby bars and price moves; distinguish volume from candles and missing numerical totals." },
  { id: "vwap", name: "VWAP", aliases: ["Volume Weighted Average Price", "Anchored VWAP", "AVWAP"], category: "Volume", evidence: "Use the labelled VWAP and visible price relation; anchor and session settings must be shown and do not create extra types." },
  { id: "obv", name: "On Balance Volume", aliases: ["OBV", "On-Balance Volume"], category: "Volume", evidence: "Read the labelled cumulative volume line and aligned swings; its absolute value is not directly comparable with price." },
  { id: "accumulation-distribution", name: "Accumulation Distribution Line", aliases: ["ADL", "A/D", "Accumulation/Distribution", "Accumulation Distribution"], category: "Volume", evidence: "Use the labelled accumulation/distribution line and aligned price swings; do not call it order flow or actual institutional buying." },
  { id: "chaikin-money-flow", name: "Chaikin Money Flow", aliases: ["CMF"], category: "Volume", evidence: "Read labelled CMF relative to visible zero and recent movement; distinguish it from Chaikin Oscillator and volatility." },
  { id: "chaikin-oscillator", name: "Chaikin Oscillator", aliases: ["ADOSC", "Accumulation Distribution Oscillator"], category: "Volume", evidence: "Use the labelled A/D oscillator and visible zero crosses; do not report the cumulative A/D line as this oscillator." },
  { id: "money-flow", name: "Money Flow Index", aliases: ["MFI"], category: "Volume", evidence: "Require the MFI label and read displayed zones or aligned divergence; do not treat MFI as RSI without volume." },
  { id: "force-index", name: "Elder Force Index", aliases: ["Force Index", "EFI"], category: "Volume", evidence: "Read the labelled force plot, zero and visible spikes with price; a spike cannot identify an unseen trader's intent." },
  { id: "ease-of-movement", name: "Ease of Movement", aliases: ["EOM", "EMV", "Ease of Movement Value"], category: "Volume", evidence: "Use the labelled movement plot and baseline to describe movement efficiency; scaling settings cannot be guessed." },
  { id: "negative-volume", name: "Negative Volume Index", aliases: ["NVI"], category: "Volume", evidence: "Read the labelled cumulative index and any visible average or divergence; never equate it with proven smart-money activity." },
  { id: "positive-volume", name: "Positive Volume Index", aliases: ["PVI"], category: "Volume", evidence: "Read the labelled cumulative index and visible slope or average crossings without inferring market participant identities." },
  { id: "price-volume-trend", name: "Price Volume Trend", aliases: ["PVT", "Volume Price Trend", "VPT"], category: "Volume", evidence: "Read the labelled cumulative volume-weighted trend and aligned price swings; hidden totals cannot be recomputed." },
  { id: "klinger", name: "Klinger Oscillator", aliases: ["KVO", "Klinger Volume Oscillator"], category: "Volume", evidence: "Compare labelled Klinger and signal plots, visible zero and crosses; no invisible signal line can confirm a cross." },
  { id: "volume-oscillator", name: "Volume Oscillator", aliases: ["VO", "PVO", "Percentage Volume Oscillator", "VOSC"], category: "Volume", evidence: "Use the labelled volume oscillator and its shown baseline; percentage and absolute display variants remain one type." },
  { id: "relative-volume", name: "Relative Volume", aliases: ["RVOL", "Relative Volume at Time"], category: "Volume", evidence: "Read the labelled relative-volume ratio and visible reference; baseline window and time normalization must be shown." },
  { id: "volume-profile", name: "Volume Profile", aliases: ["VP", "Visible Range Volume Profile", "Fixed Range Volume Profile", "Session Volume Profile", "VRVP", "FRVP", "SVP"], category: "Volume", evidence: "Use visible profile nodes and labelled value-area or control levels; range/session variants and profile components count once." },
  { id: "volume-delta", name: "Volume Delta", aliases: ["Delta Volume", "Cumulative Volume Delta", "CVD"], category: "Volume", evidence: "Require a delta-volume label and visible plot; cumulative versus bar variants count once and cannot reveal unshown order-book data." },
  { id: "net-volume", name: "Net Volume", aliases: ["NetVol"], category: "Volume", evidence: "Read the labelled signed-volume plot and baseline; do not confuse price-direction-signed volume with bid/ask volume delta." },
  { id: "volume-weighted-macd", name: "Volume Weighted MACD", aliases: ["VWMACD", "VW MACD"], category: "Volume", evidence: "Require the volume-weighted MACD label, then compare visible lines and histogram without substituting ordinary MACD." },

  { id: "pivot-points", name: "Pivot Points", aliases: ["Pivot Points Standard", "Traditional Pivot Points", "Camarilla Pivot Points", "Woodie Pivot Points", "Fibonacci Pivot Points"], category: "Price levels", evidence: "Use explicitly labelled pivot levels and visible price reactions; calculation variants and S/R components count once." },
  { id: "pivot-high-low", name: "Pivot Points High Low", aliases: ["Pivot High Low", "Swing Pivots"], category: "Price levels", evidence: "Read labelled swing-pivot markers and actual surrounding bars; future-confirmed markers cannot establish a real-time past trigger." },
  { id: "zigzag", name: "Zig Zag", aliases: ["ZigZag"], category: "Price levels", evidence: "Describe visible labelled swing connections; the latest leg can redraw and is not a confirmed future swing." },
  { id: "regression-channel", name: "Linear Regression Channel", aliases: ["Regression Channel", "LRC"], category: "Price levels", evidence: "Read the labelled fitted channel and visible price placement; a fitted historical slope is not a future-price guarantee." },
  { id: "volatility-stop", name: "Volatility Stop", aliases: ["VSTOP"], category: "Trend", evidence: "Require the labelled volatility-based stop trail and visible side of price; projected or hidden trail values cannot be priced." },
  { id: "central-pivot-range", name: "Central Pivot Range", aliases: ["CPR"], category: "Price levels", evidence: "Require the CPR label and visible band with price reactions; do not label projected next-period pivots as current observed reactions." },
] as const;

const normaliseLabel = (label: string) => label.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
const lookup = new Map(SCANNER_INDICATOR_CATALOG.flatMap(indicator =>
  [indicator.name, ...indicator.aliases].map(label => [normaliseLabel(label), indicator] as const)));

/** Resolve labels, never prose, arbitrary coloured lines or partial acronyms. */
export function resolveScannerIndicator(label: unknown): ScannerIndicator | null {
  if (typeof label !== "string" || label.length > 160) return null;
  const clean = label.replace(/\([^)]*\)|\[[^\]]*\]/g, "").trim();
  const exact = lookup.get(normaliseLabel(clean));
  if (exact) return exact;
  // Legends often suffix a period and source: RSI_14, EMA20, MACD 12 26 close 9.
  // Remove only configuration tokens, so "RSI recovery" is not a label match.
  const withoutConfig = clean.replace(/[_\s]+(?=\d)/g, " ").replace(/\s*\d+(?:\.\d+)?(?:[\s,]+(?:\d+(?:\.\d+)?|close|open|high|low|hl2|hlc3|ohlc4))*$/i, "").trim();
  return lookup.get(normaliseLabel(withoutConfig)) ?? null;
}

export const INDICATOR_CATEGORY_GUIDANCE: Readonly<Record<ScannerIndicatorCategory, string>> = {
  Momentum: "Read the labelled oscillator, displayed scale, baseline and actual crossings. Divergence needs aligned price and oscillator swings. Extreme readings alone are not reversals.",
  Trend: "Read labelled trend states, trails or comparison lines. Strength/range filters do not independently establish direction; component lines form one indicator.",
  "Moving averages": "Require the labelled method and visible line. Describe slope, price position or actual crosses. Periods and repeated instances do not create new indicator types.",
  Volatility: "Read labelled range, bands or risk plots. Expansion/contraction is not direction. Hidden lookbacks, annualisation and numerical thresholds cannot be reconstructed.",
  Volume: "Read labelled volume plots, relative participation or aligned swings. Distinguish cumulative series, profiles and delta. Do not infer hidden orders or trader identities.",
  "Price levels": "Require a labelled level system and visible price reactions. Projected, fitted, delayed or repainting outputs are conditional; do not turn them into past real-time signals.",
};

export const INDICATOR_LAYOUT_PROMPT = `OPTIONAL INDICATOR RECOGNITION CATALOG (${SCANNER_INDICATOR_CATALOG.length} distinct types, not per-image checks):\n${Object.keys(INDICATOR_CATEGORY_GUIDANCE).map(category => `${category}: ${SCANNER_INDICATOR_CATALOG.filter(indicator => indicator.category === category).map(indicator => `${indicator.name}${indicator.aliases.length ? ` [${indicator.aliases.join("/")}]` : ""}`).join("; ")}`).join("\n")}\nOnly inventory indicators whose label AND plot are visible. A catalog name is not evidence. Use Unidentified indicator when the visible label is missing or ambiguous, including RVI, TSI, SMI or MA without a readable full method name. Do not invent absent indicators, hidden calculations, settings or values. Inventory up to 10 visible regions; one type may have several instances. Other clearly labelled custom plots can be inventoried without claiming catalog recognition.`;

export const INDICATOR_ANALYSIS_GUIDANCE = `GROUNDED INDICATOR READING: This is screenshot recognition, not computation from market history. Require a visible indicator label AND its plotted evidence; an inventory name alone does not confirm identity. Match the actual method, display and settings, not line colour. Missing labels or plots mean unreadable/not_confirmed, never guessed values. Do not output a checklist of every catalog type or claim all ${SCANNER_INDICATOR_CATALOG.length} are present. Return one indicator_checks entry per inventoried region (up to 10 initially), including unreadable ones; report specific findings only when visible. Aliases, lookback periods and component lines do not count as extra types. Unknown custom plots may be described literally, without assigning an unverified formula.\n${Object.entries(INDICATOR_CATEGORY_GUIDANCE).map(([category, guidance]) => `${category}: ${guidance}`).join("\n")}`;

/** Bounded guidance for identified regions; absent catalog entries add no work. */
export function indicatorEvidenceGuidance(names: readonly unknown[]): string {
  const selected = new Map<string, ScannerIndicator>();
  for (const name of names.slice(0, 30)) {
    const indicator = resolveScannerIndicator(name);
    if (indicator) selected.set(indicator.id, indicator);
    if (selected.size >= 10) break;
  }
  return [...selected.values()].map(indicator => `${indicator.name}: ${indicator.evidence}`).join("\n");
}
