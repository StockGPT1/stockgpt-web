import { lookup as lookupAddress } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { cleanNewsText, getUsableNewsSummary } from "./news-summary.ts";

export const MAX_NEWS_PAGE_BYTES = 512 * 1024;
export const MAX_GOOGLE_ARTICLE_PAGE_BYTES = 1024 * 1024;
export const PUBLIC_NEWS_TIMEOUT_MS = 8_000;

type PublicAddress = { address: string; family: number };
export type PublicNewsPage = { html: string; url: string; status: number };
export type PublicNewsPageOptions = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
};

/** Reject special-use, private, loopback, multicast and IP translation ranges. */
export function isPublicNewsAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  if (family !== 6 || address.includes("%")) return false;
  const pieces = address.toLowerCase().split("::");
  const left = pieces[0].split(":").filter(Boolean);
  const right = (pieces[1] ?? "").split(":").filter(Boolean);
  const words = [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right]
    .map((word) => parseInt(word, 16));
  // Only global unicast 2000::/3; excludes mapped IPv4, NAT64 and local ranges.
  if ((words[0] & 0xe000) !== 0x2000) return false;
  return !(
    words[0] === 0x2002 || // 6to4 embeds an IPv4 destination.
    (words[0] === 0x2001 && (words[1] < 0x0200 || words[1] === 0x0db8)) ||
    (words[0] === 0x3fff && words[1] <= 0x0fff)
  );
}

export function validatePublicNewsUrl(value: string): URL | null {
  if (!value || value.length > 4096 || /[\u0000-\u0020]/.test(value)) return null;
  try {
    const url = new URL(value);
    const authority = value.match(/^https:\/\/([^/?#]+)/i)?.[1] ?? "";
    if (url.protocol !== "https:" || url.username || url.password || url.port ||
      /\]:\d+$|^[^\[]*:\d+$/.test(authority)) return null;
    const hostname = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
    if (!hostname || /(?:^|\.)(?:localhost|local|internal|invalid|test|example)$/.test(hostname)) return null;
    if (isIP(hostname)) return isPublicNewsAddress(hostname) ? url : null;
    if (!hostname.includes(".") || !/^[a-z\d.-]+$/.test(hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

function withAbort<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const aborted = () => reject(new Error("News page deadline exceeded"));
    if (signal.aborted) { aborted(); return; }
    signal.addEventListener("abort", aborted, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", aborted));
  });
}

async function publicAddress(url: URL, signal: AbortSignal): Promise<PublicAddress> {
  const hostname = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
  const family = isIP(hostname);
  const addresses = family ? [{ address: hostname, family }]
    : await withAbort(lookupAddress(hostname, { all: true, verbatim: true }), signal);
  if (!addresses.length || addresses.some(({ address }) => !isPublicNewsAddress(address))) {
    throw new Error("Non-public publisher address");
  }
  // Prefer IPv4 when both exist; many server hosts have no IPv6 route.
  return addresses.find((entry) => entry.family === 4) ?? addresses[0];
}

type PageResponse = { status: number; html?: string; redirect?: string };
function readPage(
  url: URL,
  address: PublicAddress,
  options: PublicNewsPageOptions,
  signal: AbortSignal,
): Promise<PageResponse> {
  return new Promise((resolve, reject) => {
    // Google places its signed publisher-link attributes after a large script.
    // This narrowly scoped wrapper allowance never applies to publisher pages.
    const maxBytes = (options.method ?? "GET") === "GET" && url.hostname === "news.google.com" &&
      /^\/(?:rss\/)?articles\/[^/]+\/?$/.test(url.pathname)
      ? MAX_GOOGLE_ARTICLE_PAGE_BYTES : MAX_NEWS_PAGE_BYTES;
    let completed = false;
    const finish = (result?: PageResponse, error?: Error) => {
      if (completed) return;
      completed = true;
      signal.removeEventListener("abort", aborted);
      if (error) reject(error); else resolve(result!);
    };
    const headers: Record<string, string> = {
      "user-agent": "Mozilla/5.0 (compatible; StockGPT/1.0)",
      accept: "text/html,application/xhtml+xml,application/json,text/plain;q=0.8",
      "accept-encoding": "identity",
    };
    for (const [name, value] of Object.entries(options.headers ?? {})) {
      if (["accept", "accept-language", "content-type"].includes(name.toLowerCase()) &&
        value.length <= 256 && !/[\r\n]/.test(value)) headers[name.toLowerCase()] = value;
    }
    if (options.body) headers["content-length"] = String(Buffer.byteLength(options.body));
    const request = httpsRequest(url, {
      method: options.method ?? "GET", headers, agent: false, family: address.family,
      // Connect only to the address already validated above, preserving URL host/SNI.
      lookup: (_hostname, lookupOptions, callback) => lookupOptions.all
        ? callback(null, [address]) : callback(null, address.address, address.family),
    }, (response) => {
      const status = response.statusCode ?? 0;
      response.on("error", (error: Error) => finish(undefined, error));
      if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
        finish({ status, redirect: response.headers.location });
        response.destroy();
        return;
      }
      const encoding = response.headers["content-encoding"];
      if (status < 200 || status >= 300 ||
        (encoding && encoding !== "identity")) {
        finish(undefined, new Error("Unusable publisher response"));
        response.destroy();
        return;
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      response.on("data", (chunk: Buffer) => {
        const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        const bounded = data.subarray(0, maxBytes - bytes);
        bytes += bounded.length;
        chunks.push(bounded);
        // Metadata is normally in the head. A bounded prefix still permits
        // complete meta tags; incomplete JSON-LD is never parsed below.
        if (bytes === maxBytes) {
          finish({ status, html: Buffer.concat(chunks).toString("utf8") });
          response.destroy();
          request.destroy();
          return;
        }
      });
      response.on("end", () => finish({ status, html: Buffer.concat(chunks).toString("utf8") }));
      response.on("aborted", () => finish(undefined, new Error("Publisher response aborted")));
    });
    const aborted = () => {
      finish(undefined, new Error("News page deadline exceeded"));
      request.destroy();
    };
    request.on("error", (error) => finish(undefined, error));
    if (signal.aborted) { aborted(); return; }
    signal.addEventListener("abort", aborted, { once: true });
    request.end(options.body);
  });
}

/** Bounded public HTTPS transport, also used for Google's article-link lookup. */
export async function fetchPublicNewsPage(
  value: string,
  options: PublicNewsPageOptions = {},
): Promise<PublicNewsPage | null> {
  let url = validatePublicNewsUrl(value);
  if (!url || (options.body && Buffer.byteLength(options.body) > 64 * 1024)) return null;
  let method = options.method ?? "GET";
  if ((method !== "GET" && method !== "POST") || (method === "GET" && options.body)) return null;
  let body = options.body;
  const timeout = Number.isFinite(options.timeoutMs)
    ? Math.max(1, Math.min(PUBLIC_NEWS_TIMEOUT_MS, options.timeoutMs!)) : PUBLIC_NEWS_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    for (let redirects = 0; redirects <= 3; redirects++) {
      if (controller.signal.aborted) return null;
      // The only POST needed by article resolution is Google's read-only RPC.
      if (method === "POST" && (url.hostname !== "news.google.com" ||
        url.pathname !== "/_/DotsSplashUi/data/batchexecute")) return null;
      const address = await publicAddress(url, controller.signal);
      const response = await readPage(url, address, { ...options, method, body }, controller.signal);
      if (!response.redirect) return { html: response.html ?? "", status: response.status, url: url.href };
      url = validatePublicNewsUrl(new URL(response.redirect, url).href);
      if (!url) return null;
      if (response.status === 303 || ((response.status === 301 || response.status === 302) && method === "POST")) {
        method = "GET";
        body = undefined;
      }
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
  return null;
}

function attributes(tag: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const match of tag.matchAll(/([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)) {
    values[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4];
  }
  return values;
}

export function compactPublisherExcerpt(value: string): string {
  const text = cleanNewsText(value);
  const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
  const sentences: string[] = [];
  for (const { segment } of segmenter.segment(text)) {
    const sentence = segment.trim();
    if (!sentence) continue;
    if ([...sentences, sentence].join(" ").length > 700) break;
    sentences.push(sentence);
    if (sentences.length === 3) break;
  }
  if (sentences.length) return sentences.join(" ");
  if (text.length <= 700) return text;
  const boundary = text.lastIndexOf(" ", 699);
  return text.slice(0, boundary > 0 ? boundary : 699).trimEnd() + "…";
}

function isPublisherBoilerplate(text: string): boolean {
  return /^(?:subscribe\b|sign (?:in|up)\b|become a (?:member|subscriber)\b|to (?:continue reading|read (?:this|the) (?:article|story))\b|(?:get|read|find|discover|view|follow|browse) (?:all )?(?:the )?(?:latest |breaking |top )?(?:news|headlines|updates)\b|latest (?:news|breaking news)\b|please (?:enable|accept)\b)/i.test(text) ||
    /\b(?:we|this (?:site|website)) (?:use|uses) cookies\b|\bcookie (?:consent|preferences)\b|\benable javascript\b|\baccept all cookies\b/i.test(text);
}

function headlineMatches(headline: string, supplied: string): boolean {
  const comparable = (value: string) => cleanNewsText(value).normalize("NFKC")
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  if (comparable(headline) === comparable(supplied)) return true;
  // Google appends the publisher name to otherwise identical headlines.
  const withoutPublisher = cleanNewsText(supplied)
    .match(/^(.*)\s+[-–—|]\s+[\p{L}\p{N}][\p{L}\p{N} .,&’'-]{1,79}$/u)?.[1];
  return Boolean(withoutPublisher && comparable(headline) === comparable(withoutPublisher));
}

function literalArticles(html: string): string[] {
  const articles: string[] = [];
  let depth = 0;
  let start = 0;
  let nestedStart = 0;
  let cursor = 0;
  let content = "";
  for (const match of html.matchAll(/<\/?article\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)) {
    const closing = /^<\//.test(match[0]);
    if (!closing) {
      if (depth === 0) { start = match.index + match[0].length; cursor = start; content = ""; }
      if (depth === 1) { nestedStart = match.index; content += html.slice(cursor, nestedStart); }
      depth++;
    } else if (depth > 0) {
      depth--;
      if (depth === 1) cursor = match.index + match[0].length;
      if (depth === 0) {
        content += html.slice(cursor, match.index);
        articles.push(content);
      }
    }
  }
  return articles;
}

/** An original source excerpt is allowed only from a matching literal article. */
export function extractPublisherArticleExcerpt(html: string, title?: string | null): string | null {
  if (!title) return null;
  const cleanHtml = html.replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|nav|footer|aside|form|button)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, "");
  const pageHeadlines = [...cleanHtml.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/gi)]
    .map((match) => cleanNewsText(match[1]));
  const articles = literalArticles(cleanHtml);
  for (const article of articles) {
    const articleHeadline = article.match(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/i)?.[1];
    const firstHeading = article.match(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]\s*>/i);
    const firstParagraph = article.search(/<p\b/i);
    if (articleHeadline) {
      if (!headlineMatches(articleHeadline, title)) continue;
    } else {
      if (articles.length !== 1) continue;
      if (!pageHeadlines.some((headline) => headlineMatches(headline, title))) continue;
      // A leading card heading identifies a different story, even when the
      // containing page has a matching headline elsewhere.
      if (firstHeading && (firstParagraph < 0 || firstHeading.index! < firstParagraph) &&
        !headlineMatches(firstHeading[1], title)) continue;
    }
    const proseHtml = article.replace(/<header\b[^>]*>[\s\S]*?<\/header\s*>/gi, "");
    const paragraphs: string[] = [];
    for (const match of proseHtml.matchAll(/<p\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/p\s*>/gi)) {
      const classes = attributes(match[1]).class ?? "";
      if (/(?:^|\s)(?:byline|author|date|timestamp|share|social|caption|subscribe|newsletter|cookie)(?:$|[-_\s])/i.test(classes)) continue;
      const text = cleanNewsText(match[2]);
      if (isPublisherBoilerplate(text) || /^(?:read more|also read|related articles|advertisement|all rights reserved|copyright)\b/i.test(text)) continue;
      const usable = getUsableNewsSummary({ summary: text, title: articleHeadline ?? title });
      if (usable) paragraphs.push(usable);
      if (paragraphs.join(" ").length >= 2100) break;
    }
    const excerpt = compactPublisherExcerpt(paragraphs.join(" "));
    if (getUsableNewsSummary({ summary: excerpt, title }) &&
      (!articleHeadline || getUsableNewsSummary({ summary: excerpt, title: articleHeadline }))) return excerpt;
  }
  return null;
}

/** Prefer publisher descriptions, then use a matching article's original prose. */
export function extractPublisherSummary(html: string, title?: string | null): string | null {
  const descriptions = new Map<string, string[]>();
  const titles = title ? [title] : [];
  let siteName = "";
  const metadataHtml = html.replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, "");
  for (const match of metadataHtml.matchAll(/<meta\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)) {
    const attrs = attributes(match[0]);
    const key = (attrs.property ?? attrs.name ?? "").toLowerCase();
    if (!attrs.content) continue;
    if (["og:title", "twitter:title"].includes(key)) titles.push(attrs.content);
    if (key === "og:site_name") siteName = attrs.content;
    if (["og:description", "description", "twitter:description"].includes(key)) {
      descriptions.set(key, [...(descriptions.get(key) ?? []), attrs.content]);
    }
  }
  const pageTitle = metadataHtml.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1];
  if (pageTitle) titles.push(pageTitle);
  const structured: { text: string; title?: string }[] = [];
  let nodes = 0;
  const visit = (value: unknown, depth: number) => {
    if (!value || typeof value !== "object" || depth > 12 || ++nodes > 2000) return;
    if (Array.isArray(value)) { value.forEach((entry) => visit(entry, depth + 1)); return; }
    const entry = value as Record<string, unknown>;
    const types = Array.isArray(entry["@type"]) ? entry["@type"] : [entry["@type"]];
    if (types.some((type) => typeof type === "string" && /(?:^|[/#])(?:[A-Za-z]*NewsArticle)$/.test(type))) {
      for (const key of ["description", "articleBody"]) {
        if (typeof entry[key] === "string") structured.push({
          text: entry[key], title: typeof entry.headline === "string" ? entry.headline : undefined,
        });
      }
    }
    Object.values(entry).forEach((child) => visit(child, depth + 1));
  };
  for (const match of html.matchAll(/<script\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (attributes(match[1]).type?.toLowerCase() !== "application/ld+json") continue;
    try { visit(JSON.parse(match[2]), 0); } catch { /* Invalid metadata is unavailable. */ }
  }
  const candidates: { text: string; title?: string }[] = [
    ...["og:description", "description", "twitter:description"]
      .flatMap((key) => (descriptions.get(key) ?? []).map((text) => ({ text }))),
    ...structured,
  ];
  for (const candidate of candidates) {
    const cleaned = cleanNewsText(candidate.text);
    if (isPublisherBoilerplate(cleaned)) continue;
    const candidateTitles = [...titles, ...(candidate.title ? [candidate.title] : [])];
    const usable = getUsableNewsSummary({ summary: cleaned, title, source: siteName });
    if (!usable || candidateTitles.some((headline) => !getUsableNewsSummary({ summary: usable, title: headline, source: siteName }))) continue;
    const excerpt = compactPublisherExcerpt(usable);
    if (getUsableNewsSummary({ summary: excerpt, title, source: siteName }) &&
      !candidateTitles.some((headline) => !getUsableNewsSummary({ summary: excerpt, title: headline, source: siteName }))) return excerpt;
  }
  return extractPublisherArticleExcerpt(html, title);
}

export async function fetchPublisherSummary(url: string, title?: string | null): Promise<string | null> {
  const page = await fetchPublicNewsPage(url);
  return page ? extractPublisherSummary(page.html, title) : null;
}
