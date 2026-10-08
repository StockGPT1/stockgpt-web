import { normalisePriceAxis, type PriceAxis } from "./chart-scan-scenario.ts";

export type ImageBox = { x_pct: number; y_pct: number; width_pct: number; height_pct: number };
export type AxisPixelRow = { id: string; y_pct: number };
export type EvidenceFrame = { id: string; source_image: number; box: ImageBox };
export type ScanGeometry = {
  axis_rows: AxisPixelRow[];
  frames: EvidenceFrame[];
  image_sizes: Array<{ width: number; height: number }>;
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function canonicalAxisRow(value: unknown) {
  if (typeof value !== "string") return null;
  const id = value.trim().toLowerCase();
  if (/^(right|left)(-overlap)?-[1-9]\d*$/.test(id)) return id;
  // Older guide images displayed R1/L1. Resolve only that explicit spelling,
  // never approximate an unknown id or accept a model-supplied position.
  const short = /^([rl])(-overlap)?-?([1-9]\d*)$/.exec(id);
  return short ? `${short[1] === "r" ? "right" : "left"}${short[2] ?? ""}-${short[3]}` : null;
}
export function pixelAnchoredAxis(value: unknown, rows: AxisPixelRow[]): PriceAxis {
  const raw = object(value);
  const ticks = Array.isArray(raw.ticks) ? raw.ticks : [];
  const axis = raw.axis_id === "left" || raw.axis_id === "right" ? raw.axis_id : null;
  return normalisePriceAxis({ scale: raw.scale, ticks: ticks.flatMap(value => {
    const tick = object(value);
    const id = canonicalAxisRow(tick.row_id);
    const row = rows.find(row => row.id === id && (!axis || row.id.startsWith(axis + "-")));
    // Positions come only from pixels. A model-provided y_pct is deliberately ignored.
    return row ? [{ price: tick.price, y_pct: row.y_pct }] : [];
  }) });
}

export function cropBoxToImage(value: unknown, frame: EvidenceFrame): ImageBox | null {
  const box = object(value);
  const x = box.x_pct, y = box.y_pct, w = box.width_pct, h = box.height_pct;
  if ([x, y, w, h].some(v => typeof v !== "number" || !Number.isFinite(v))) return null;
  const [left, top, width, height] = [x, y, w, h] as number[];
  if (left < 0 || top < 0 || width < 0.5 || height < 0.5 || left + width > 100 || top + height > 100) return null;
  return {
    x_pct: frame.box.x_pct + left / 100 * frame.box.width_pct,
    y_pct: frame.box.y_pct + top / 100 * frame.box.height_pct,
    width_pct: width / 100 * frame.box.width_pct,
    height_pct: height / 100 * frame.box.height_pct,
  };
}

export function matchedEvidenceBoxes(candidateValue: unknown, reviewedValue: unknown, frame: EvidenceFrame): ImageBox[] {
  const candidate = Array.isArray(candidateValue) ? candidateValue : [];
  const checked = Array.isArray(reviewedValue) ? reviewedValue : [];
  const taken = new Set<number>();
  return checked.slice(0, 3).flatMap(value => {
    const b = cropBoxToImage(value, frame);
    if (!b) return [];
    let match = -1, similarity = 0;
    candidate.forEach((value, index) => {
      if (taken.has(index)) return;
      const a = cropBoxToImage(value, frame);
      if (!a) return;
      const overlap = Math.max(0, Math.min(a.x_pct + a.width_pct, b.x_pct + b.width_pct) - Math.max(a.x_pct, b.x_pct)) *
        Math.max(0, Math.min(a.y_pct + a.height_pct, b.y_pct + b.height_pct) - Math.max(a.y_pct, b.y_pct));
      const union = a.width_pct * a.height_pct + b.width_pct * b.height_pct - overlap;
      const agreement = union > 0 ? overlap / union : 0;
      if (agreement > similarity) { similarity = agreement; match = index; }
    });
    if (match < 0 || similarity < 0.45) return [];
    taken.add(match);
    return [b];
  });
}
