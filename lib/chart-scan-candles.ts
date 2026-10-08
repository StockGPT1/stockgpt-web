import { SCANNER_INDICATOR_CATALOG } from "./chart-scan-indicators.ts";

type Bias = "bullish" | "bearish" | "neutral";
type Category = "Reversal" | "Continuation" | "Indecision";
export type CandlePattern = { id: string; name: string; bias: Bias; candles: number; category: Category; rule: string };

// A shared checklist drives both image readers, coverage validation and the
// consumer capability window. These are visual rules, not win probabilities.
export const CANDLE_PATTERNS: readonly CandlePattern[] = [
  { id: "bullish-engulfing", name: "Bullish engulfing", bias: "bullish", candles: 2, category: "Reversal", rule: "After a decline, a rising real body covers the preceding falling real body." },
  { id: "bearish-engulfing", name: "Bearish engulfing", bias: "bearish", candles: 2, category: "Reversal", rule: "After a rise, a falling real body covers the preceding rising real body." },
  { id: "hammer", name: "Hammer", bias: "bullish", candles: 1, category: "Reversal", rule: "After a decline, a small body near the high has a lower wick at least twice the body and little upper wick." },
  { id: "inverted-hammer", name: "Inverted hammer", bias: "bullish", candles: 1, category: "Reversal", rule: "After a decline, a small body near the low has a long upper wick and little lower wick; further confirmation is needed." },
  { id: "hanging-man", name: "Hanging man", bias: "bearish", candles: 1, category: "Reversal", rule: "After a rise, a small body near the high has a long lower wick; further bearish confirmation is needed." },
  { id: "shooting-star", name: "Shooting star", bias: "bearish", candles: 1, category: "Reversal", rule: "After a rise, a small body near the low has a long upper wick and little lower wick." },
  { id: "doji", name: "Doji", bias: "neutral", candles: 1, category: "Indecision", rule: "The open and close are almost equal. A tiny body alone does not establish a direction." },
  { id: "dragonfly-doji", name: "Dragonfly doji", bias: "bullish", candles: 1, category: "Reversal", rule: "Near a declining swing, open and close are near the high with a long lower wick and little upper wick." },
  { id: "gravestone-doji", name: "Gravestone doji", bias: "bearish", candles: 1, category: "Reversal", rule: "Near a rising swing, open and close are near the low with a long upper wick and little lower wick." },
  { id: "white-spinning-top", name: "White spinning top", bias: "neutral", candles: 1, category: "Indecision", rule: "A small rising body has meaningful wicks on both sides; colour alone is not directional confirmation." },
  { id: "black-spinning-top", name: "Black spinning top", bias: "neutral", candles: 1, category: "Indecision", rule: "A small falling body has meaningful wicks on both sides; colour alone is not directional confirmation." },
  { id: "bullish-harami", name: "Bullish harami", bias: "bullish", candles: 2, category: "Reversal", rule: "After a decline, a small rising body sits inside the previous large falling body." },
  { id: "bearish-harami", name: "Bearish harami", bias: "bearish", candles: 2, category: "Reversal", rule: "After a rise, a small falling body sits inside the previous large rising body." },
  { id: "bullish-harami-cross", name: "Bullish harami cross", bias: "bullish", candles: 2, category: "Reversal", rule: "After a decline, a doji body is inside the preceding large falling body." },
  { id: "bearish-harami-cross", name: "Bearish harami cross", bias: "bearish", candles: 2, category: "Reversal", rule: "After a rise, a doji body is inside the preceding large rising body." },
  { id: "piercing-line", name: "Piercing line", bias: "bullish", candles: 2, category: "Reversal", rule: "After a decline, a rising candle opens below the prior low and closes above the midpoint of the prior falling body, below its open." },
  { id: "dark-cloud-cover", name: "Dark cloud cover", bias: "bearish", candles: 2, category: "Reversal", rule: "After a rise, a falling candle opens above the prior high and closes below the midpoint of the prior rising body, above its open." },
  { id: "morning-star", name: "Morning star", bias: "bullish", candles: 3, category: "Reversal", rule: "After a decline, a long falling body, separated small body and strong rising body recover beyond the first body's midpoint." },
  { id: "evening-star", name: "Evening star", bias: "bearish", candles: 3, category: "Reversal", rule: "After a rise, a long rising body, separated small body and strong falling body retreat beyond the first body's midpoint." },
  { id: "morning-doji-star", name: "Morning doji star", bias: "bullish", candles: 3, category: "Reversal", rule: "A morning-star sequence uses a doji for its separated middle candle." },
  { id: "evening-doji-star", name: "Evening doji star", bias: "bearish", candles: 3, category: "Reversal", rule: "An evening-star sequence uses a doji for its separated middle candle." },
  { id: "three-white-soldiers", name: "Three white soldiers", bias: "bullish", candles: 3, category: "Reversal", rule: "After a decline or base, three substantial rising bodies open within the prior body and close progressively higher near their highs." },
  { id: "three-black-crows", name: "Three black crows", bias: "bearish", candles: 3, category: "Reversal", rule: "After a rise, three substantial falling bodies open within the prior body and close progressively lower near their lows." },
  { id: "tweezer-bottom", name: "Tweezer bottom", bias: "bullish", candles: 2, category: "Reversal", rule: "Near a declining swing, two adjacent candles reject approximately the same low; distinguish this from a multi-swing double bottom." },
  { id: "tweezer-top", name: "Tweezer top", bias: "bearish", candles: 2, category: "Reversal", rule: "Near a rising swing, two adjacent candles reject approximately the same high; distinguish this from a multi-swing double top." },
  { id: "bullish-abandoned-baby", name: "Bullish abandoned baby", bias: "bullish", candles: 3, category: "Reversal", rule: "After a decline, a doji's entire range gaps below its neighbours, followed by a strong rising reversal candle." },
  { id: "bearish-abandoned-baby", name: "Bearish abandoned baby", bias: "bearish", candles: 3, category: "Reversal", rule: "After a rise, a doji's entire range gaps above its neighbours, followed by a strong falling reversal candle." },
  { id: "bullish-doji-star", name: "Bullish doji star", bias: "bullish", candles: 2, category: "Reversal", rule: "After a decline, a long falling body is followed by a doji body gapped below it; reversal confirmation remains pending." },
  { id: "bearish-doji-star", name: "Bearish doji star", bias: "bearish", candles: 2, category: "Reversal", rule: "After a rise, a long rising body is followed by a doji body gapped above it; reversal confirmation remains pending." },
  { id: "bullish-tri-star", name: "Bullish tri-star", bias: "bullish", candles: 3, category: "Reversal", rule: "After a decline, three dojis form with the middle doji body gapped lower and the third returning higher." },
  { id: "bearish-tri-star", name: "Bearish tri-star", bias: "bearish", candles: 3, category: "Reversal", rule: "After a rise, three dojis form with the middle doji body gapped higher and the third returning lower." },
  { id: "bullish-kicking", name: "Bullish kicking", bias: "bullish", candles: 2, category: "Reversal", rule: "A bearish marubozu is followed by a bullish marubozu whose whole range gaps above the first." },
  { id: "bearish-kicking", name: "Bearish kicking", bias: "bearish", candles: 2, category: "Reversal", rule: "A bullish marubozu is followed by a bearish marubozu whose whole range gaps below the first." },
  { id: "rising-three-methods", name: "Rising three methods", bias: "bullish", candles: 5, category: "Continuation", rule: "In an uptrend, a long rising candle contains three small pullback candles within its range, then another strong rise closes above the first." },
  { id: "falling-three-methods", name: "Falling three methods", bias: "bearish", candles: 5, category: "Continuation", rule: "In a downtrend, a long falling candle contains three small rebound candles within its range, then another strong fall closes below the first." },
  { id: "upside-tasuki-gap", name: "Upside Tasuki gap", bias: "bullish", candles: 3, category: "Continuation", rule: "Two rising candles leave a real upward range gap; a small falling third candle enters but does not fill that gap." },
  { id: "downside-tasuki-gap", name: "Downside Tasuki gap", bias: "bearish", candles: 3, category: "Continuation", rule: "Two falling candles leave a real downward range gap; a small rising third candle enters but does not fill that gap." },
  { id: "rising-window", name: "Rising window", bias: "bullish", candles: 2, category: "Continuation", rule: "In an uptrend, the newer candle's low is above the previous high, leaving an unfilled upward range gap." },
  { id: "falling-window", name: "Falling window", bias: "bearish", candles: 2, category: "Continuation", rule: "In a downtrend, the newer candle's high is below the previous low, leaving an unfilled downward range gap." },
  { id: "white-marubozu", name: "White marubozu", bias: "bullish", candles: 1, category: "Continuation", rule: "A substantial rising body opens near the low and closes near the high, with negligible wicks." },
  { id: "black-marubozu", name: "Black marubozu", bias: "bearish", candles: 1, category: "Continuation", rule: "A substantial falling body opens near the high and closes near the low, with negligible wicks." },
  { id: "on-neck", name: "On-neck pattern", bias: "bearish", candles: 2, category: "Continuation", rule: "In a downtrend, a long falling body is followed by a rising candle opening lower and closing around the prior low, below the prior body." },
  { id: "long-lower-shadow", name: "Long lower shadow", bias: "bullish", candles: 1, category: "Reversal", rule: "Near a declining swing, a lower wick substantially exceeds the body and shows rejection of lower prices." },
  { id: "long-upper-shadow", name: "Long upper shadow", bias: "bearish", candles: 1, category: "Reversal", rule: "Near a rising swing, an upper wick substantially exceeds the body and shows rejection of higher prices." },
  // Counterattack compares closes; separating lines compares opens and requires
  // a long second body with a negligible wick at its opening end. These are
  // distinct formations, not aliases for engulfing or marubozu.
  // Reference: https://github.com/TA-Lib/ta-lib/blob/main/src/ta_func/ta_CDLCOUNTERATTACK.c
  // Reference: https://github.com/TA-Lib/ta-lib/blob/main/src/ta_func/ta_CDLSEPARATINGLINES.c
  { id: "bullish-counterattack", name: "Bullish counterattack", bias: "bullish", candles: 2, category: "Reversal", rule: "After a decline, a long falling body is followed by a long rising body that opens lower and recovers to approximately the same close as the first; confirmation is needed." },
  { id: "bearish-counterattack", name: "Bearish counterattack", bias: "bearish", candles: 2, category: "Reversal", rule: "After a rise, a long rising body is followed by a long falling body that opens higher and retreats to approximately the same close as the first; confirmation is needed." },
  { id: "bullish-separating-lines", name: "Bullish separating lines", bias: "bullish", candles: 2, category: "Continuation", rule: "In an uptrend, a falling candle is followed by a long rising body opening at approximately the first candle's open, with negligible lower wick; the bodies extend to opposite sides of their shared open." },
  { id: "bearish-separating-lines", name: "Bearish separating lines", bias: "bearish", candles: 2, category: "Continuation", rule: "In a downtrend, a rising candle is followed by a long falling body opening at approximately the first candle's open, with negligible upper wick; the bodies extend to opposite sides of their shared open." },
  // Keep the close-depth distinction explicit: on-neck stops near the prior
  // low, in-neck barely enters the prior body, and thrusting goes farther in
  // while remaining below its midpoint.
  // Reference: https://github.com/TA-Lib/ta-lib/blob/main/src/ta_func/ta_CDLINNECK.c
  // Reference: https://github.com/TA-Lib/ta-lib/blob/main/src/ta_func/ta_CDLTHRUSTING.c
  { id: "in-neck", name: "In-neck pattern", bias: "bearish", candles: 2, category: "Continuation", rule: "In a downtrend, a long falling body is followed by a rising candle opening below the prior low and closing only slightly above the prior close, barely inside its body; distinguish it from on-neck and deeper thrusting recovery." },
  { id: "thrusting", name: "Thrusting pattern", bias: "bearish", candles: 2, category: "Continuation", rule: "In a downtrend, a long falling body is followed by a rising candle opening below the prior low and closing meaningfully above the prior close but below the body's midpoint; a tiny recovery is in-neck, not thrusting." },
];

export const SCANNER_INDICATORS = ["Volume", "RSI", "MACD", "Stochastic", "EMA", "SMA", "VWAP", "Bollinger Bands", "Ichimoku"] as const;
// Scope counts, not a promise that every item is readable in every image.
export const CANDLE_LOOKBACK = 120;
// The first count includes candle patterns and the nine core indicator tools.
// Technical indicator recognition is counted separately from the actual catalog,
// never by counting a second reading of the same indicator as another type.
const chartCheckScope = CANDLE_PATTERNS.length + SCANNER_INDICATORS.length;
const roundedScope = (count: number) => `${Math.floor(count / 10) * 10}+`;
export const SCANNER_CAPABILITY_STATS = [
  { value: roundedScope(chartCheckScope), label: "chart indicators", detail: "patterns + indicators" },
  { value: `${Math.floor(SCANNER_INDICATOR_CATALOG.length / 100) * 100}+`, label: "technical indicators", detail: "recognised when visible" },
  { value: `${Math.floor(CANDLE_LOOKBACK / 100) * 100}+`, label: "candle lookback", detail: `up to ${CANDLE_LOOKBACK}, when readable` },
] as const;

export type CandleCheck = { id: string; name: string; bias: Bias; category: Category; status: "detected" | "unconfirmed" | "not_present" | "unclear" | "not_applicable" | "not_checked"; evidence: string | null; confidence: number; completed: boolean };
export type CandleAudit = { total: number; checked: number; detected: number; unclear: number; applicable: boolean; checks: CandleCheck[] };
type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue => value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

export function candlePatternId(value: unknown, name: unknown): string | null {
  if (typeof value === "string" && CANDLE_PATTERNS.some(pattern => pattern.id === value)) return value;
  const normaliseName = (value: string) => value.toLowerCase().replace(/[-_]/g, " ");
  const text = typeof name === "string" ? normaliseName(name) : "";
  return [...CANDLE_PATTERNS].sort((a, b) => b.name.length - a.name.length).find(pattern => text.includes(normaliseName(pattern.name)))?.id ?? null;
}

export function hasCompleteCandleAudit(value: unknown, series: unknown) {
  const raw = object(value);
  const ids = [...array(raw.present).map(value => object(value).id), ...array(raw.absent), ...array(raw.unclear), ...array(raw.not_applicable)];
  if (ids.length !== CANDLE_PATTERNS.length || new Set(ids).size !== ids.length ||
    !CANDLE_PATTERNS.every(pattern => ids.includes(pattern.id))) return false;
  return series === "candles" ? array(raw.not_applicable).length === 0
    : array(raw.not_applicable).length === CANDLE_PATTERNS.length;
}

export function normaliseCandleAudit(value: unknown, series: unknown, reviewed: boolean, candidateValue?: unknown): CandleAudit {
  const raw = object(value), candidate = object(candidateValue);
  const applicable = series === "candles";
  const checks = CANDLE_PATTERNS.map((pattern): CandleCheck => {
    const base = { id: pattern.id, name: pattern.name, category: pattern.category, bias: pattern.bias, evidence: null, confidence: 0, completed: false };
    if (!applicable) return { ...base, status: "not_applicable" };
    const present = array(raw.present).map(object).find(item => item.id === pattern.id);
    if (present) {
      const evidence = typeof present.evidence === "string" ? present.evidence.replace(/\s+/g, " ").trim().slice(0, 260) : "";
      const confidence = typeof present.confidence === "number" && Number.isFinite(present.confidence) ? Math.max(0, Math.min(100, Math.round(present.confidence))) : 0;
      if (evidence.length < 12 || present.context_confirmed !== true || typeof present.candles_visible !== "number" || present.candles_visible < pattern.candles || confidence < 60) return { ...base, status: "unclear" };
      const before = array(candidate.present).map(object).find(item => item.id === pattern.id);
      const agreed = reviewed && before?.context_confirmed === true && typeof before.candles_visible === "number" && before.candles_visible >= pattern.candles &&
        typeof before.confidence === "number" && Number.isFinite(before.confidence) && before.confidence >= 60 && typeof before.evidence === "string" && before.evidence.trim().length >= 12;
      return { ...base, status: agreed ? "detected" : "unconfirmed", evidence, confidence,
        completed: agreed && present.completed === true && before?.completed === true };
    }
    if (array(raw.absent).includes(pattern.id)) return { ...base, status: "not_present" };
    if (array(raw.unclear).includes(pattern.id)) return { ...base, status: "unclear" };
    return { ...base, status: "not_checked" };
  });
  return { total: checks.length, checked: checks.filter(check => check.status !== "not_checked").length,
    detected: checks.filter(check => check.status === "detected").length, unclear: checks.filter(check => check.status === "unclear").length, applicable, checks };
}

export const CANDLE_CHECKLIST_PROMPT = `MANDATORY CANDLE CHECKLIST: evaluate EVERY following id separately on every analysis and independent read. Inspect up to the last ${CANDLE_LOOKBACK} readable completed candles and important visible turning points. Use fewer when the supplied image contains fewer visible, readable completed candles; never invent hidden history or claim the full lookback was reviewed without seeing it. Exclude a live/unclosed candle from the completed-candle lookback. Pattern neighbours must be actually adjacent in the image: never bridge cropped areas or unreadable gaps to form a candle sequence. If missing history prevents the required context from being established, mark that pattern unclear. Apply the required preceding trend, bodies, wicks, gaps and neighbouring candles. Do not force a match, infer a body from UI/volume, confuse an inverted hammer with a hammer, or treat all dojis as directional. Gap patterns require visible actual gaps; session boundaries alone are not gaps. If the chart/time resolution cannot establish a rule, mark unclear. A live/unclosed last candle is not a completed formation; completed=false. Candle colour alone does not determine direction.
${CANDLE_PATTERNS.map(pattern => `${pattern.id} | ${pattern.name} | ${pattern.candles} candle(s) | ${pattern.rule}`).join("\n")}
Return candle_audit with four arrays: present (objects), absent (ids), unclear (ids), not_applicable (ids). EVERY id must appear EXACTLY ONCE across these arrays, including patterns not found. For candles, not_applicable=[]; for price-line/unknown/unsupported charts put ALL ids in not_applicable and no candle findings. An empty/missing checklist is invalid.
Each present object: {"id":"bullish-engulfing","evidence":"specific candle location and required context","candles_visible":2,"context_confirmed":true,"completed":true,"confidence":80,"frame_id":"price","localisation_confirmed":true,"localisation_confidence":90,"evidence_boxes":[]}. Give local crop boxes around the actual candle group, not just the final candle of a multi-candle formation. Use one strongest recent occurrence per id. Missing context means unclear, not present. Do not repeat every detection in signals: reserve signals for up to six strongest independent trade clues; the app surfaces detected candle checks separately.`;
