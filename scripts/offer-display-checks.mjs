import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as offerCopy from "../lib/limited-offer.ts";

const require = createRequire(import.meta.url);

// Exercise the actual JSX output without booting the app or a billing session.
function loadComponent(path, name) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  new Function("require", "exports", compiled)(
    id => id === "@/lib/limited-offer" ? offerCopy : require(id), exports,
  );
  return exports[name];
}

test("monthly offer is present in server HTML before client effects run", () => {
  const Offer = loadComponent("../components/LimitedTimePriceOffer.tsx", "LimitedTimePriceOffer");
  const html = renderToStaticMarkup(React.createElement(Offer));
  assert.match(html, /sg-limited-offer-current[^>]*>£4\.99</);
  assert.match(html, /sg-limited-offer-original[^>]*>£18\.99</);
  assert.match(html, /standard monthly price £18\.99/);
});

test("founding offer banner makes no invented remaining-places claim", () => {
  const Banner = loadComponent("../components/OfferSeatsMeter.tsx", "OfferSeatsMeter");
  const html = renderToStaticMarkup(React.createElement(Banner));
  assert.match(html, /£4\.99\/month/);
  assert.doesNotMatch(html, /progressbar|spots|claimed|\d+ left/);
});
