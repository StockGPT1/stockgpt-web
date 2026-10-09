import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
function compile(path) {
  return ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}
function load(code, imports, timers = {}) {
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", "setTimeout", "clearTimeout", code)(
    imports, loadedModule, loadedModule.exports, timers.setTimeout ?? setTimeout, timers.clearTimeout ?? clearTimeout,
  );
  return loadedModule.exports;
}
const summary = load(compile("../lib/news-summary.ts"), require);
const code = compile("../lib/news-publisher.ts");
const turn = () => new Promise((resolve) => setImmediate(resolve));
const publicIp = { address: "8.8.8.8", family: 4 };
const article = "The company reported quarterly revenue of $20 billion, ahead of its previous forecast. Management raised its full-year outlook after demand improved. The board approved a new investment programme. A fourth sentence must not appear.";

function harness({ responses = [], lookup = async () => [publicIp] } = {}) {
  const calls = [], dns = [], timers = new Map();
  let timerId = 0;
  const imports = (name) => {
    if (name === "./news-summary.ts") return summary;
    if (name === "node:net") return require(name);
    if (name === "node:dns/promises") return { lookup: async (hostname, options) => {
      dns.push({ hostname, options });
      return lookup(hostname, options);
    } };
    assert.equal(name, "node:https");
    return { request: (url, options, callback) => {
      const request = new EventEmitter();
      const call = { url: url.href, options, request, destroyed: false };
      const index = calls.push(call) - 1;
      request.destroy = () => { call.destroyed = true; request.emit("error", new Error("Cancelled")); };
      request.end = (body) => {
        call.body = body;
        options.lookup(url.hostname, {}, (error, address, family) => {
          assert.ifError(error);
          call.pinned = { address, family };
        });
        options.lookup(url.hostname, { all: true }, (error, addresses) => {
          assert.ifError(error);
          call.pinnedAll = addresses;
        });
        const fixture = responses[index];
        if (!fixture) return;
        queueMicrotask(() => {
          if (call.destroyed) return;
          const response = new EventEmitter();
          response.statusCode = fixture.status ?? 200;
          response.headers = fixture.headers ?? {};
          response.destroy = () => { call.responseDestroyed = true; };
          callback(response);
          if (call.responseDestroyed) return;
          for (const chunk of fixture.chunks ?? [Buffer.from(fixture.html ?? "")]) {
            response.emit("data", chunk);
            if (call.responseDestroyed) return;
          }
          response.emit("end");
        });
      };
      return request;
    } };
  };
  const api = load(code, imports, {
    setTimeout: (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId; },
    clearTimeout: (id) => timers.delete(id),
  });
  return { ...api, calls, dns, timers };
}
const api = harness();

test("extracts publisher metadata in priority order and retains only three original sentences", () => {
  const html = `<meta content='${article}' property='og:description'><meta name="description" content="Another publisher description that is long enough to be useful to readers.">`;
  assert.equal(api.extractPublisherSummary(html, "Quarterly company update"), article.slice(0, article.indexOf(" A fourth")));
  assert.equal(api.extractPublisherSummary(`<META NAME=description CONTENT="Revenue rose &amp;amp; operating profit improved. Management expects growth to continue over the coming year.">`),
    "Revenue rose & operating profit improved. Management expects growth to continue over the coming year.");
});

test("JSON-LD fallback reads only a NewsArticle, including nested graphs and articleBody", () => {
  const generic = { "@type": "WebSite", description: article };
  const news = { "@context": "https://schema.org", "@graph": [{ "@type": ["Article", "NewsArticle"], headline: "Quarterly company update", articleBody: article }] };
  assert.equal(api.extractPublisherSummary(`<script type="application/ld+json">${JSON.stringify(generic)}</script>`), null);
  assert.equal(api.extractPublisherSummary(`<script type="application/ld+json">broken JSON</script><script type="application/ld+json">${JSON.stringify(news)}</script>`),
    article.slice(0, article.indexOf(" A fourth")));
  assert.equal(api.extractPublisherSummary(`<p>${article}</p>`), null);
  assert.equal(api.extractPublisherSummary(`<!-- <meta name="description" content='${article}'> -->`), null);
  assert.equal(api.extractPublisherSummary(`<script>const markup = "<meta name='description' content='${article}'>";</script>`), null);
  assert.equal(api.extractPublisherSummary(`<script type="application/ld+json">${JSON.stringify(news)}`), null);
});

test("rejects headline copies, encoded link-only text and publisher access boilerplate", () => {
  const headline = "The company raises its revenue forecast after stronger quarterly demand";
  for (const content of [headline, "&lt;a href=&quot;https://publisher.com/news&quot;&gt;https://publisher.com/news&lt;/a&gt;", "Subscribe to our service for the latest breaking news and exclusive updates.", "This website uses cookies to personalise content and improve your experience."]) {
    assert.equal(api.extractPublisherSummary(`<meta property="og:title" content="${headline}"><meta name="description" content='${content}'>`, headline), null);
  }
  assert.equal(api.extractPublisherSummary(`<meta name="description" content='${headline}'><meta property="og:description" content='${article}'>`, headline), article.slice(0, article.indexOf(" A fourth")));
  assert.equal(api.extractPublisherSummary(`<meta property="og:title" content="${headline}"><meta name="description" content="${headline}. ${"Extra details from the actual article ".repeat(30)}.">`), null);
});

test("literal article fallback extracts matching original paragraphs and excludes surrounding UI", () => {
  const headline = "Investors look to bumper earnings season to maintain US share prices momentum";
  const original = "US shares are trading close to record levels as investors await the next earnings season. Analysts expect companies to report further profit growth over the coming quarter. Investors will also be watching the outlook for interest rates.";
  const html = `<nav><p>Browse our navigation links and discover the latest articles from all markets.</p></nav><article id="node-7861" role="article" class="node node--type-news node--view-mode-full"><header><h1>${headline}</h1><p class="byline">This article was written by an author at the publisher today.</p></header><aside><p>Our sidebar offers other news stories and premium subscriber promotions today.</p></aside><p>Subscribe to our service for the latest news and exclusive updates.</p><p>${original}</p><script>const other = "<p>Fake prose from a script must never become a source excerpt.</p>";</script><article><h2>Related market story</h2><p>A different article reports unrelated facts about a company in another market.</p></article></article><footer><p>All rights reserved by the original publisher and its group companies.</p></footer>`;
  assert.equal(api.extractPublisherSummary(html, `${headline} - AJ Bell`), original);
  assert.equal(api.extractPublisherSummary(`<h1>${headline}</h1><article><p>${original}</p></article>`, headline), original);
});

test("article fallback rejects unrelated cards, bare paragraphs and missing or mismatched headlines", () => {
  const headline = "Investors expect a bumper earnings season to support US share prices";
  const unrelated = "A different company reported lower revenue and said demand had softened during the quarter. Management cut its annual outlook as operating costs increased.";
  for (const html of [
    `<h1>${headline}</h1><article><h2>Unrelated company reports weaker revenue</h2><p>${unrelated}</p></article>`,
    `<article><h1>Unrelated company reports weaker revenue</h1><p>${unrelated}</p></article>`,
    `<h1>${headline}</h1><p>${unrelated}</p>`,
    `<h1>${headline}</h1><article><p>${unrelated}</p></article><article><p>${unrelated}</p></article>`,
    `<article><p>${unrelated}</p></article>`,
    `<nav><article><h1>${headline}</h1><p>${unrelated}</p></article></nav>`,
  ]) assert.equal(api.extractPublisherSummary(html, headline), null);
  assert.equal(api.extractPublisherSummary(`<article><h1>${headline}</h1><p>${unrelated}</p></article>`), null);
});

test("long descriptions never exceed 700 characters or fabricate new article claims", () => {
  const long = "The company " + "reported stronger demand across its operations ".repeat(30) + ".";
  const text = api.compactPublisherExcerpt(long);
  assert.ok(text.length <= 700);
  assert.ok(long.startsWith(text.slice(0, -1)));
  assert.equal(text.at(-1), "…");
  assert.equal(api.compactPublisherExcerpt("Revenue grew by 12.5% in the quarter. Profit rose as well. Guidance stayed unchanged. More detail follows."),
    "Revenue grew by 12.5% in the quarter. Profit rose as well. Guidance stayed unchanged.");
});

test("rejects unsafe URL destinations before issuing DNS or HTTP requests", async () => {
  const fetcher = harness();
  for (const url of ["http://publisher.com/news", "https://user:pass@publisher.com/news", "https://publisher.com:443/news", "https://publisher.com:8443/news", "https://localhost/news", "https://host.local/news", "https://127.0.0.1/news", "https://0x7f000001/news", "https://2130706433/news", "https://169.254.169.254/latest", "https://[::1]/news", "https://[::ffff:127.0.0.1]/news", "https://[2002:7f00:1::]/news"]) {
    assert.equal(await fetcher.fetchPublicNewsPage(url), null, url);
  }
  assert.equal(fetcher.calls.length, 0);
  assert.equal(fetcher.dns.length, 0);
  assert.ok(api.validatePublicNewsUrl("https://publisher.com/news"));
  assert.ok(api.isPublicNewsAddress("2606:4700:4700::1111"));
  for (const address of ["0.0.0.0", "10.1.2.3", "100.64.0.1", "172.16.0.1", "192.168.1.1", "192.0.2.1", "198.18.0.1", "198.51.100.1", "203.0.113.1", "224.0.0.1", "fe80::1", "fc00::1", "2001:db8::1", "2001::1", "3fff::1"]) {
    assert.equal(api.isPublicNewsAddress(address), false, address);
  }
});

test("rejects private or mixed DNS answers and pins approved DNS to the request", async () => {
  for (const answers of [[{ address: "10.0.0.1", family: 4 }], [publicIp, { address: "192.168.0.1", family: 4 }]]) {
    const unsafe = harness({ lookup: async () => answers });
    assert.equal(await unsafe.fetchPublicNewsPage("https://publisher.com/news"), null);
    assert.equal(unsafe.calls.length, 0);
  }
  let resolutions = 0;
  const safe = harness({ lookup: async () => ++resolutions === 1 ? [publicIp] : [{ address: "10.0.0.1", family: 4 }], responses: [{ html: "safe" }] });
  assert.equal((await safe.fetchPublicNewsPage("https://publisher.com/news")).html, "safe");
  assert.deepEqual(safe.calls[0].pinned, publicIp);
  assert.deepEqual(safe.calls[0].pinnedAll, [publicIp]);
  assert.equal(safe.calls[0].options.agent, false);
  assert.equal(resolutions, 1);
  assert.equal(safe.timers.size, 0);
});

test("each redirect is revalidated and DNS checked before connection", async () => {
  const unsafe = harness({ responses: [{ status: 302, headers: { location: "https://127.0.0.1/admin" } }] });
  assert.equal(await unsafe.fetchPublicNewsPage("https://publisher.com/news"), null);
  assert.equal(unsafe.calls.length, 1);
  const privateDns = harness({ responses: [{ status: 302, headers: { location: "https://second.com/news" } }], lookup: async (host) => host === "second.com" ? [{ address: "10.0.0.1", family: 4 }] : [publicIp] });
  assert.equal(await privateDns.fetchPublicNewsPage("https://publisher.com/news"), null);
  assert.equal(privateDns.calls.length, 1);
  const safe = harness({ responses: [{ status: 301, headers: { location: "/article" } }, { html: "article" }] });
  assert.deepEqual(await safe.fetchPublicNewsPage("https://publisher.com/news"), { html: "article", status: 200, url: "https://publisher.com/article" });
  assert.equal(safe.dns.length, 2);
});

test("response size, redirect count and encoding stay bounded", async () => {
  for (const fixture of [{ headers: { "content-length": String(api.MAX_NEWS_PAGE_BYTES + 1) }, chunks: [Buffer.alloc(api.MAX_NEWS_PAGE_BYTES + 1, "a")] }, { chunks: [Buffer.alloc(api.MAX_NEWS_PAGE_BYTES, "b"), Buffer.from("extra")] }]) {
    const bounded = harness({ responses: [fixture] });
    const page = await bounded.fetchPublicNewsPage("https://publisher.com/news");
    assert.equal(Buffer.byteLength(page.html), api.MAX_NEWS_PAGE_BYTES);
    assert.equal(bounded.calls[0].responseDestroyed, true);
    assert.equal(bounded.timers.size, 0);
  }
  const encoded = harness({ responses: [{ headers: { "content-encoding": "gzip" }, html: "encoded" }] });
  assert.equal(await encoded.fetchPublicNewsPage("https://publisher.com/news"), null);
  const redirects = harness({ responses: Array.from({ length: 5 }, () => ({ status: 302, headers: { location: "/next" } })) });
  assert.equal(await redirects.fetchPublicNewsPage("https://publisher.com/news"), null);
  assert.equal(redirects.calls.length, 4);
});

test("one deadline covers stalled DNS and destroys stalled publisher requests", async () => {
  const stalledDns = harness({ lookup: () => new Promise(() => {}) });
  const dnsResult = stalledDns.fetchPublicNewsPage("https://publisher.com/news");
  stalledDns.timers.values().next().value.callback();
  assert.equal(await dnsResult, null);
  assert.equal(stalledDns.calls.length, 0);
  assert.equal(stalledDns.timers.size, 0);
  const stalledRequest = harness();
  const requestResult = stalledRequest.fetchPublicNewsPage("https://publisher.com/news", { timeoutMs: 50 });
  await turn();
  assert.equal(stalledRequest.timers.values().next().value.delay, 50);
  stalledRequest.timers.values().next().value.callback();
  assert.equal(await requestResult, null);
  assert.equal(stalledRequest.calls[0].destroyed, true);
  assert.equal(stalledRequest.timers.size, 0);
});

test("Google article wrappers alone permit a bounded 1MB prefix for late signed-link attributes", async () => {
  const marker = '<div data-n-a-sg="signature" data-n-a-ts="timestamp">';
  const googleHtml = " ".repeat(581287) + marker + " ".repeat(api.MAX_GOOGLE_ARTICLE_PAGE_BYTES);
  for (const path of ["/rss/articles/encoded", "/articles/encoded"]) {
    const wrapper = harness({ responses: [{ html: googleHtml }] });
    const page = await wrapper.fetchPublicNewsPage(`https://news.google.com${path}`);
    assert.ok(page.html.includes(marker));
    assert.equal(Buffer.byteLength(page.html), api.MAX_GOOGLE_ARTICLE_PAGE_BYTES);
    assert.equal(wrapper.calls[0].responseDestroyed, true);
  }
  for (const url of ["https://news.google.com/other", "https://publisher.com/articles/encoded"]) {
    const ordinary = harness({ responses: [{ html: googleHtml }] });
    assert.equal(Buffer.byteLength((await ordinary.fetchPublicNewsPage(url)).html), api.MAX_NEWS_PAGE_BYTES);
  }
  const rpc = harness({ responses: [{ html: googleHtml }] });
  assert.equal(Buffer.byteLength((await rpc.fetchPublicNewsPage("https://news.google.com/_/DotsSplashUi/data/batchexecute", { method: "POST", body: "f.req=sample" })).html), api.MAX_NEWS_PAGE_BYTES);
});

test("Google's read-only POST uses the same transport limits and strips credential headers", async () => {
  const google = harness({ responses: [{ html: "rpc response" }] });
  const result = await google.fetchPublicNewsPage("https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je", { method: "POST", body: "f.req=sample", headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "secret", Cookie: "session", Host: "localhost" } });
  assert.equal(result.html, "rpc response");
  assert.equal(google.calls[0].body, "f.req=sample");
  assert.equal(google.calls[0].options.headers["content-type"], "application/x-www-form-urlencoded");
  for (const header of ["authorization", "cookie", "host"]) assert.equal(google.calls[0].options.headers[header], undefined);
  assert.equal(await google.fetchPublicNewsPage("https://publisher.com/submit", { method: "POST", body: "example" }), null);
  assert.equal(await google.fetchPublicNewsPage("https://news.google.com/_/DotsSplashUi/data/batchexecute", { method: "POST", body: "x".repeat(64 * 1024 + 1) }), null);
  assert.equal(google.calls.length, 1);
});

test("publisher summary fetch returns original metadata and returns null on unavailable pages", async () => {
  const fetcher = harness({ responses: [{ html: `<meta property="og:description" content='${article}'>` + " ".repeat(api.MAX_NEWS_PAGE_BYTES) }, { status: 403 }] });
  assert.equal(await fetcher.fetchPublisherSummary("https://publisher.com/news", "Quarterly company update"), article.slice(0, article.indexOf(" A fourth")));
  assert.equal(await fetcher.fetchPublisherSummary("https://publisher.com/blocked"), null);
});
