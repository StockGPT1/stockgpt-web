import assert from "node:assert/strict";
import test from "node:test";
import { cleanNewsText, getUsableNewsSummary } from "../lib/news-summary.ts";

const title = "Company raises revenue outlook as cloud sales accelerate";
test("URL-only and escaped RSS link descriptions are not news summaries", () => {
  for (const summary of ["https://example.com/news/story", `<a href="https://example.com/news">${title}</a> Example`, `&lt;a href=&quot;https://example.com/news&quot;&gt;${title}&lt;/a&gt; Example`, `${title} - Example`, "No summary available.", "Read the full article at https://example.com/news"]) {
    assert.equal(getUsableNewsSummary({ title, source: "Example", summary }), null);
  }
});
test("publisher prose survives RSS encoding without HTML, links or provider truncation markers", () => {
  const summary = "The company increased its annual sales forecast after stronger demand for its cloud services. Shares rose 3% in early trading.";
  assert.equal(getUsableNewsSummary({title, summary: `<![CDATA[<p>${summary}</p>]]>`}), summary);
  assert.equal(getUsableNewsSummary({title, summary: `${summary} https://example.com/news [+120 chars]`}), summary);
  assert.equal(cleanNewsText("&amp;lt;p&amp;gt;Revenue rose &#51;%.&amp;lt;/p&amp;gt;"), "Revenue rose 3%.");
});
test("a Google RSS list of linked headlines is not mistaken for publisher prose", () => {
  assert.equal(getUsableNewsSummary({title, url: "https://news.google.com/rss/articles/ABC123", summary: `<ol><li><a href="https://example.com/1">${title}</a> Example</li><li><a href="https://example.com/2">Other stocks rise as investors assess an update from the central bank</a> Other source</li></ol>`}), null);
});
