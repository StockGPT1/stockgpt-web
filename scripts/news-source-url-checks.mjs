import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeLegacyGoogleNewsId,
  parseGoogleNewsRpcUrl,
  resolveNewsSourceUrl,
} from "../lib/news-source-url.ts";

const articleId = "CBMiVEFVX3lxTE5qdW5rdW5rbm93bl90b2tlbg";
const wrapper = `https://news.google.com/rss/articles/${articleId}?oc=5`;
const publisher = "https://publisher.example/business/earnings";
const rpcUrl = "https://news.google.com/_/DotsSplashUi/data/batchexecute";
const frame = (url = publisher, rpc = "Fbv4je", action = "garturlres") =>
  JSON.stringify([["wrb.fr", rpc, JSON.stringify([action, url, 1])]]);
const response = body => `)]}'\n\n${body.length}\n${body}\n\n`;

function legacyId(url) {
  const bytes = Buffer.from(url);
  const length = [];
  let remaining = bytes.length;
  do {
    const byte = remaining & 127;
    remaining = Math.floor(remaining / 128);
    length.push(remaining ? byte | 128 : byte);
  } while (remaining);
  return Buffer.concat([Buffer.from([8, 19, 34, ...length]), bytes, Buffer.from([210, 1, 0])]).toString("base64url");
}

test("ordinary HTTPS sources pass through without any Google requests", async () => {
  assert.equal(await resolveNewsSourceUrl(publisher, () => assert.fail("Unexpected request")), publisher);
  for (const invalid of ["http://publisher.example/a", "https://user:pass@publisher.example/a", "https://publisher.example:8443/a", "https://localhost/a", "file:///tmp/a"]) {
    assert.equal(await resolveNewsSourceUrl(invalid, () => assert.fail("Unexpected request")), null);
  }
});

test("legacy IDs decode both short and multi-byte URL lengths without requests", async () => {
  for (const url of [publisher, `${publisher}?tracking=${"x".repeat(150)}`]) {
    const id = legacyId(url);
    assert.equal(decodeLegacyGoogleNewsId(id), url);
    assert.equal(await resolveNewsSourceUrl(`https://news.google.com/articles/${id}`, () => assert.fail("Unexpected request")), url);
  }
  assert.equal(decodeLegacyGoogleNewsId(legacyId("http://publisher.example/a")), null);
  assert.equal(decodeLegacyGoogleNewsId(Buffer.from([8, 19, 34, 127, 104, 116, 116, 112]).toString("base64url")), null);
});

test("Google requests use only a validated article path and the exact RPC endpoint", async () => {
  for (const invalid of ["https://news.google.com/rss/search?q=test", "https://news.google.com/articles/x", "https://news.google.com/articles/abc%2Fdefghi", "https://news.google.com/articles/abcdefgh/extra"]) {
    assert.equal(await resolveNewsSourceUrl(invalid, () => assert.fail("Unexpected request")), null);
  }
  const lookalike = "https://news.google.com.publisher.example/articles/abcdefgh";
  assert.equal(await resolveNewsSourceUrl(lookalike, () => assert.fail("Unexpected Google request")), lookalike);
});

test("modern wrappers extract same-element parameters and encode the RPC safely", async () => {
  const calls = [];
  const transport = async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) return {
      url, status: 200,
      body: `<div data-n-a-id="unrelated" data-n-a-sg="wrong" data-n-a-ts="1"></div><div data-n-a-ts='1720000000' data-n-a-sg='signature&amp;&quot;value' data-n-a-id='${articleId}'></div>`,
    };
    return { url, status: 200, body: response(frame()) };
  };
  assert.equal(await resolveNewsSourceUrl(wrapper, transport), publisher);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, `https://news.google.com/rss/articles/${articleId}`);
  assert.equal(calls[1].url, rpcUrl);
  assert.equal(calls[1].options.method, "POST");
  const outer = JSON.parse(new URLSearchParams(calls[1].options.body).get("f.req"));
  const inner = JSON.parse(outer[0][0][1]);
  assert.deepEqual(inner.slice(2), [articleId, 1720000000, 'signature&"value']);
  assert.equal(calls[1].options.headers.Cookie, undefined);
});

test("RPC parser ignores unrelated payloads and rejects unsafe or conflicting sources", () => {
  assert.equal(parseGoogleNewsRpcUrl(response(frame())), publisher);
  assert.equal(parseGoogleNewsRpcUrl(response(frame(publisher, "OtherRpc"))), null);
  assert.equal(parseGoogleNewsRpcUrl(response(frame(publisher, "Fbv4je", "unrelated"))), null);
  assert.equal(parseGoogleNewsRpcUrl(response(frame("http://publisher.example/a"))), null);
  assert.equal(parseGoogleNewsRpcUrl(response(frame("https://news.google.com/articles/abcdefgh"))), null);
  assert.equal(parseGoogleNewsRpcUrl(`${response(frame())}${response(frame("https://different.example/a"))}`), null);
  assert.equal(parseGoogleNewsRpcUrl("https://publisher.example/a"), null);
});

test("consent pages, rate limits, malformed RPCs, and transport errors fail without retries", async () => {
  for (const page of [
    { status: 429, body: "rate limited" },
    { status: 200, body: "<h1>Please consent</h1>" },
    { status: 200, body: "<div data-n-a-sg='first'></div><div data-n-a-ts='1720000000'></div>" },
  ]) {
    let calls = 0;
    assert.equal(await resolveNewsSourceUrl(wrapper, async url => {
      calls++;
      return { url, ...page };
    }), null);
    assert.equal(calls, 1);
  }
  assert.equal(await resolveNewsSourceUrl(wrapper, async () => { throw new Error("timeout"); }), null);
  let calls = 0;
  assert.equal(await resolveNewsSourceUrl(wrapper, async url => {
    calls++;
    return { url, status: calls === 1 ? 200 : 429, body: "<div data-n-a-sg='sig' data-n-a-ts='1720000000'></div>" };
  }), null);
  assert.equal(calls, 2);
});

test("an ordinary redirect to a publisher is accepted through the secure transport", async () => {
  assert.equal(await resolveNewsSourceUrl(wrapper, async () => ({ url: publisher, status: 200, body: "publisher page" })), publisher);
});
