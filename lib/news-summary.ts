export type NewsSummaryArticle = {
  title?: string | null;
  summary?: string | null;
  source?: string | null;
  url?: string | null;
};

function decodeEntities(text: string) {
  const named: Record<string, string> = {
    amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ",
    rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—",
  };
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (!code.startsWith("#")) return named[code.toLowerCase()] ?? entity;
    const point = code[1].toLowerCase() === "x"
      ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : " ";
  });
}

export function cleanNewsText(value: string) {
  let text = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  // RSS often escapes its entire HTML description, including link attributes.
  for (let pass = 0; pass < 2; pass++) {
    text = decodeEntities(text)
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(/<[^>]*>/g, " ");
  }
  return text.replace(/\s+/g, " ").trim();
}

function comparable(value: string) {
  return cleanNewsText(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

export function getUsableNewsSummary(article: NewsSummaryArticle): string | null {
  if (!article.summary) return null;
  if (/^https:\/\/news\.google\.com\//i.test(article.url ?? "") &&
    /(?:<|&lt;|&amp;lt;)a\b/i.test(article.summary)) return null;
  const text = cleanNewsText(article.summary);
  if (/^(?:https?:\/\/|www\.)\S+$/i.test(text)) return null;
  const withoutLinks = text
    .replace(/https?:\/\/\S+|\bwww\.\S+/gi, " ")
    .replace(/\[\+\d+ chars\]/gi, "")
    .replace(/\s+/g, " ").trim();
  if (withoutLinks.length < 40 || withoutLinks.split(/\s+/).length < 7) return null;
  if (/^(?:no (?:full )?(?:summary|description)|summary (?:is )?unavailable|read (?:the )?(?:full )?(?:article|story)|click here|subscribe (?:to|for)|sign (?:in|up) to)/i.test(withoutLinks)) return null;
  const content = comparable(withoutLinks);
  const headline = comparable(article.title ?? "");
  const source = comparable(article.source ?? "");
  if (headline && (content === headline || content === headline + source)) return null;
  if (content === source) return null;
  return withoutLinks;
}
