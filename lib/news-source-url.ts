export type NewsSourceRequest = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
};

export type NewsSourceTransport = (
  url: string,
  options?: NewsSourceRequest,
) => Promise<{ url: string; status: number; body: string }>;

const GOOGLE_NEWS_HOST = "news.google.com";
const GOOGLE_RPC_URL = "https://news.google.com/_/DotsSplashUi/data/batchexecute";

function sourceUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 4096 || /[\u0000-\u0020]/.test(value)) {
    return null;
  }

  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" || url.username || url.password || url.port ||
      !url.hostname.includes(".") || url.hostname.endsWith(".localhost")
    ) return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

function publisherUrl(value: unknown) {
  const url = sourceUrl(value);
  return url && new URL(url).hostname !== GOOGLE_NEWS_HOST ? url : null;
}

function readVarint(bytes: Buffer, offset: number) {
  let value = 0;
  for (let count = 0; count < 5 && offset + count < bytes.length; count++) {
    const byte = bytes[offset + count];
    value += (byte & 127) * 2 ** (count * 7);
    if (!(byte & 128)) return { value, offset: offset + count + 1 };
  }
  return null;
}

// Older Google IDs contain a length-delimited publisher URL in protobuf field 4.
// Read its actual length, including multi-byte lengths, instead of searching bytes
// for a URL that might belong to another field or a malformed message.
export function decodeLegacyGoogleNewsId(articleId: string): string | null {
  if (!/^[A-Za-z0-9_-]{8,4096}$/.test(articleId)) return null;
  const bytes = Buffer.from(articleId, "base64url");
  let offset = 0;
  let result: string | null = null;

  while (offset < bytes.length) {
    const tag = readVarint(bytes, offset);
    if (!tag || tag.value < 8) return null;
    offset = tag.offset;
    const wire = tag.value & 7;

    if (wire === 0) {
      const field = readVarint(bytes, offset);
      if (!field) return null;
      offset = field.offset;
    } else if (wire === 1 || wire === 5) {
      offset += wire === 1 ? 8 : 4;
    } else if (wire === 2) {
      const length = readVarint(bytes, offset);
      if (!length || length.offset + length.value > bytes.length) return null;
      if (Math.floor(tag.value / 8) === 4) {
        const candidate = publisherUrl(bytes.subarray(length.offset, length.offset + length.value).toString("utf8"));
        if (candidate && result && candidate !== result) return null;
        if (candidate) result = candidate;
      }
      offset = length.offset + length.value;
    } else {
      return null;
    }

    if (offset > bytes.length) return null;
  }

  return result;
}

function decodeAttribute(value: string) {
  return value
    .replace(/&quot;/gi, '"').replace(/&apos;|&#39;/gi, "'")
    .replace(/&#(x[\da-f]+|\d+);/gi, (_, code: string) => {
      const point = code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : Number(code);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : "";
    })
    .replace(/&amp;/gi, "&");
}

function decodingParams(html: string, articleId: string) {
  for (const tag of html.matchAll(/<[a-z][^>]*>/gi)) {
    const attributes = new Map<string, string>();
    for (const attribute of tag[0].matchAll(/\b(data-n-a-(?:id|sg|ts))\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
      attributes.set(attribute[1].toLowerCase(), decodeAttribute(attribute[2] ?? attribute[3]));
    }
    if (attributes.has("data-n-a-id") && attributes.get("data-n-a-id") !== articleId) continue;
    const signature = attributes.get("data-n-a-sg");
    const timestamp = attributes.get("data-n-a-ts");
    if (
      signature && signature.length <= 1024 && !/[\u0000-\u001f]/.test(signature) &&
      timestamp && /^\d{1,12}$/.test(timestamp) && Number(timestamp) > 0
    ) return { signature, timestamp: Number(timestamp) };
  }
  return null;
}

export function parseGoogleNewsRpcUrl(body: string): string | null {
  if (body.length > 512 * 1024) return null;
  let result: string | null = null;

  // Google returns an XSSI prefix and length-prefixed, single-line JSON frames.
  // Parse JSON frames only; unrelated RPCs and arbitrary URLs are never accepted.
  for (const line of body.split(/\r?\n/)) {
    if (!line.trimStart().startsWith("[")) continue;
    try {
      const frame: unknown = JSON.parse(line);
      if (!Array.isArray(frame)) continue;
      for (const item of frame) {
        if (!Array.isArray(item) || item[0] !== "wrb.fr" || item[1] !== "Fbv4je" || typeof item[2] !== "string") continue;
        const decoded: unknown = JSON.parse(item[2]);
        if (!Array.isArray(decoded) || decoded[0] !== "garturlres") continue;
        const candidate = publisherUrl(decoded[1]);
        if (candidate && result && result !== candidate) return null;
        if (candidate) result = candidate;
      }
    } catch {
      // An incomplete frame or upstream protocol change leaves the source unknown.
    }
  }

  return result;
}

/**
 * Resolve a Google News wrapper or pass through an ordinary HTTPS article URL.
 * The injected transport MUST validate and pin public DNS addresses, revalidate
 * redirects, and bound duration/body size. Every returned publisher URL must also
 * be fetched through that transport; this module performs no DNS/security checks.
 */
export async function resolveNewsSourceUrl(
  value: string,
  transport: NewsSourceTransport,
): Promise<string | null> {
  const normalized = sourceUrl(value);
  if (!normalized) return null;
  const url = new URL(normalized);
  if (url.hostname !== GOOGLE_NEWS_HOST) return normalized;
  const match = url.pathname.match(/^\/(?:rss\/)?(?:articles|read)\/([A-Za-z0-9_-]{8,4096})\/?$/);
  if (!match) return null;
  const articleId = match[1];
  const legacy = decodeLegacyGoogleNewsId(articleId);
  if (legacy) return legacy;

  try {
    const page = await transport(`https://${GOOGLE_NEWS_HOST}/rss/articles/${articleId}`, {
      headers: { Accept: "text/html", "Accept-Language": "en-GB,en;q=0.9" },
    });
    if (page.status < 200 || page.status >= 300 || page.body.length > 2 * 1024 * 1024) return null;
    const redirected = publisherUrl(page.url);
    if (redirected) return redirected;
    if (new URL(page.url).hostname !== GOOGLE_NEWS_HOST) return null;
    const params = decodingParams(page.body, articleId);
    if (!params) return null;

    // This undocumented Google RPC is best effort. Missing parameters, access
    // gates, and rate limits remain failures; no cookies or bypasses are used.
    const context = [
      ["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1],
      "X", "X", 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0,
    ];
    const payload = JSON.stringify(["garturlreq", context, articleId, params.timestamp, params.signature]);
    const rpc = await transport(GOOGLE_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: new URLSearchParams({ "f.req": JSON.stringify([[["Fbv4je", payload]]]) }).toString(),
    });
    if (rpc.status < 200 || rpc.status >= 300 || rpc.url !== GOOGLE_RPC_URL) return null;
    return parseGoogleNewsRpcUrl(rpc.body);
  } catch {
    return null;
  }
}
