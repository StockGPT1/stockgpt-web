import sharp, { type OverlayOptions } from "sharp";
import type { ChartLayout } from "./chart-scanner.ts";
import type { AxisPixelRow, EvidenceFrame, ImageBox, ScanGeometry } from "./chart-scan-coordinates.ts";

type Guide = { url: string; description: string };
type PixelRect = { left: number; top: number; width: number; height: number };
const imageOptions = { limitInputPixels: 16_000_000, failOn: "error" as const };
const dataUrl = (buffer: Buffer) => "data:image/png;base64," + buffer.toString("base64");

function pixelRect(box: ImageBox, width: number, height: number): PixelRect {
  const left = Math.max(0, Math.floor(box.x_pct / 100 * width));
  const top = Math.max(0, Math.floor(box.y_pct / 100 * height));
  return { left, top, width: Math.max(1, Math.min(width - left, Math.ceil(box.width_pct / 100 * width))),
    height: Math.max(1, Math.min(height - top, Math.ceil(box.height_pct / 100 * height))) };
}

// Detect the ink bands of printed labels, not their guessed semantic positions.
// A per-row median handles light/dark themes and coloured current-price badges.
export function detectAxisLabelBands(pixels: Uint8Array, width: number, height: number, channels: number) {
  const active: boolean[] = [];
  for (let y = 0; y < height; y++) {
    const values: number[] = [];
    for (let x = 0; x < width; x++) values.push(pixels[(y * width + x) * channels]);
    const sorted = [...values].sort((a, b) => a - b), background = sorted[Math.floor(width / 2)];
    const ink = values.reduce((count, value) => count + (Math.abs(value - background) >= 42 ? 1 : 0), 0);
    active.push(ink >= Math.max(3, width * 0.025) && ink < width * 0.6);
  }
  // Join a single antialiased gap within a glyph, never nearby labels.
  for (let y = 1; y < height - 1; y++) if (active[y - 1] && active[y + 1]) active[y] = true;
  const bands: Array<{ top: number; bottom: number; centre: number }> = [];
  for (let y = 0; y < height; y++) {
    if (!active[y]) continue;
    const top = y;
    while (y + 1 < height && active[y + 1]) y++;
    const size = y - top + 1;
    if (size >= 5 && size <= Math.min(48, height * 0.1)) bands.push({ top, bottom: y, centre: (top + y) / 2 });
  }
  return bands.slice(0, 18);
}

export function detectGridRows(pixels: Uint8Array, width: number, height: number, channels: number) {
  const rows: number[] = [];
  if (channels < 3) return [];
  for (let y = 2; y < height - 2; y++) {
    let consistent = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      if (Math.max(r, g, b) - Math.min(r, g, b) > 45) continue;
      const mean = (r + g + b) / 3;
      const before = i - width * channels * 2, after = i + width * channels * 2;
      const a = (pixels[before] + pixels[before + 1] + pixels[before + 2]) / 3;
      const c = (pixels[after] + pixels[after + 1] + pixels[after + 2]) / 3;
      if ((mean - a >= 6 && mean - c >= 6) || (a - mean >= 6 && c - mean >= 6)) consistent++;
    }
    if (consistent / width >= 0.7) rows.push(y);
  }
  const centres: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const first = rows[i];
    while (i + 1 < rows.length && rows[i + 1] === rows[i] + 1) i++;
    if (rows[i] - first <= 3) centres.push((first + rows[i]) / 2);
  }
  return centres;
}

export async function buildChartImageGuides(buffers: Buffer[], layout: ChartLayout) {
  const originals = await Promise.all(buffers.map(buffer => sharp(buffer, imageOptions).rotate().png().toBuffer({ resolveWithObject: true })));
  const geometry: ScanGeometry = { axis_rows: [], frames: [], image_sizes: originals.map(image => ({ width: image.info.width, height: image.info.height })) };
  const guides: Guide[] = [];
  const primary = originals[0], plot = layout.price_plot_box;
  if (plot) {
    const bounds = pixelRect(plot, primary.info.width, primary.info.height);
    const plotPixels = await sharp(primary.data).extract(bounds).toColourspace("srgb").removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const gridRows = detectGridRows(plotPixels.data, bounds.width, bounds.height, plotPixels.info.channels);
    for (const side of ["right", "left"] as const) {
      const edge = side === "right" ? bounds.left + bounds.width : bounds.left;
      const reach = Math.ceil(primary.info.width * 0.18);
      const outside = side === "right"
        ? { left: edge, width: Math.min(primary.info.width - edge, reach) }
        : { left: Math.max(0, edge - reach), width: Math.min(edge, reach) };
      const readBands = async (strip: PixelRect) => {
        if (strip.width < 16) return { bands: [], clipped: false };
        const gray = await sharp(primary.data).extract(strip).greyscale().raw().toBuffer({ resolveWithObject: true });
        const bands = detectAxisLabelBands(gray.data, strip.width, strip.height, gray.info.channels);
        const clipped = bands.some(band => {
          let edgeInk = 0;
          for (let y = band.top; y <= band.bottom; y++) {
            const values = Array.from({ length: strip.width }, (_, x) => gray.data[(y * strip.width + x) * gray.info.channels]);
            const background = [...values].sort((a, b) => a - b)[Math.floor(strip.width / 2)];
            const edgeValues = side === "right" ? values.slice(0, 3) : values.slice(-3);
            if (edgeValues.some(value => Math.abs(value - background) >= 42)) edgeInk++;
          }
          return edgeInk >= 2;
        });
        return { bands, clipped };
      };
      let strip = { ...outside, top: bounds.top, height: bounds.height };
      const outsideReading = await readBands(strip);
      let bands = outsideReading.bands;
      let overlapping = false;
      if (bands.length < 3 || outsideReading.clipped) {
        // Phone charts often print their price scale over the plot, and the
        // locator's approximate edge can include it. Recover the actual label
        // pixels just inside that edge; neither their prices nor Y's are guessed.
        const inset = Math.min(reach, Math.floor(bounds.width / 4));
        const left = side === "right" ? Math.max(bounds.left, edge - inset) : outside.left;
        const right = side === "right" ? outside.left + outside.width : Math.min(bounds.left + bounds.width, edge + inset);
        strip = { left, width: right - left, top: bounds.top, height: bounds.height };
        bands = (await readBands(strip)).bands;
        overlapping = true;
      }
      if (bands.length < 3) continue;
      const rowHeight = 72, gutter = 140, cropWidth = Math.min(480, strip.width * 3);
      const composites: OverlayOptions[] = [];
      const rows: AxisPixelRow[] = [];
      for (let index = 0; index < bands.length; index++) {
        const band = bands[index], id = `${side}${overlapping ? "-overlap" : ""}-${index + 1}`;
        const top = Math.max(0, band.top - 3), height = Math.min(strip.height - top, band.bottom - top + 4);
        const cropped = await sharp(primary.data).extract({ ...strip, top: strip.top + top, height }).resize({ width: cropWidth, height: rowHeight - 12, fit: "contain", background: "#111827" }).png().toBuffer();
        const label = Buffer.from(`<svg width="${gutter}" height="${rowHeight}"><rect width="100%" height="100%" fill="#111827"/><text x="8" y="41" fill="white" font-family="sans-serif" font-size="13">${id}</text></svg>`);
        composites.push({ input: label, left: 0, top: index * rowHeight }, { input: cropped, left: gutter, top: index * rowHeight + 6 });
        const nearby = gridRows.filter(y => Math.abs(y - band.centre) <= Math.max(3, (band.bottom - band.top) * 0.35))
          .sort((a, b) => Math.abs(a - band.centre) - Math.abs(b - band.centre));
        const centre = nearby[0] ?? band.centre;
        rows.push({ id, y_pct: (strip.top + centre) / primary.info.height * 100 });
      }
      const atlas = await sharp({ create: { width: gutter + cropWidth, height: rowHeight * bands.length, channels: 3, background: "#111827" } }).composite(composites).png().toBuffer();
      geometry.axis_rows.push(...rows);
      guides.push({ url: dataUrl(atlas), description: `PRIMARY ${side} price-label atlas. Copy the exact displayed row_id (${rows.map(row => row.id).join(", ")}) for each readable printed price. These are cropped original-pixel bands, not new charts.${overlapping ? " This recovery crop overlaps the plot edge: ignore candle/line fragments and rows without a complete printed numeric price label." : ""} Choose only the actual price axis. Coordinates are computed from original pixels; never return a y coordinate.` });
    }
  }
  const regions = [
    ...(plot ? [{ id: "price", source_image: 0, box: plot }] : []),
    ...layout.indicators.filter(region => region.box && region.readable).map(region => ({ id: region.id, source_image: region.source_image, box: region.box! })),
  ].slice(0, 7);
  for (const region of regions) {
    const original = originals[region.source_image];
    if (!original) continue;
    const rect = pixelRect(region.box, original.info.width, original.info.height);
    if (rect.width < 24 || rect.height < 12) continue;
    const frame: EvidenceFrame = { id: region.id, source_image: region.source_image, box: {
      x_pct: rect.left / original.info.width * 100, y_pct: rect.top / original.info.height * 100,
      width_pct: rect.width / original.info.width * 100, height_pct: rect.height / original.info.height * 100,
    } };
    const crop = await sharp(original.data).extract(rect).resize({ width: Math.min(1400, rect.width), withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true });
    const w = crop.info.width, h = crop.info.height, pad = 30;
    const markings = [0, 25, 50, 75, 100].map(p => `<text x="${pad + p / 100 * w}" y="20" fill="#1d4ed8" font-size="16" text-anchor="middle">${p}</text><text x="25" y="${pad + p / 100 * h}" fill="#1d4ed8" font-size="16" text-anchor="end">${p}</text>`).join("");
    const coordinates = Buffer.from(`<svg width="${w + pad * 2}" height="${h + pad * 2}"><rect width="100%" height="100%" fill="white"/><g font-family="sans-serif">${markings}</g></svg>`);
    const atlas = await sharp(coordinates).composite([{ input: crop.data, left: pad, top: pad }]).png().toBuffer();
    geometry.frames.push(frame);
    guides.push({ url: dataUrl(atlas), description: `Evidence close-up frame_id=${frame.id}, source_image=${frame.source_image}. Blue outer rulers show 0–100% of the INNER chart crop (exclude the white ruler border). Return evidence_boxes in these LOCAL crop percentages. Two troughs need two small boxes on the troughs, not one chart-wide rectangle.` });
  }
  return { guides, geometry };
}
