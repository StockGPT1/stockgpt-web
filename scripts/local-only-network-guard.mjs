// Optional NODE_OPTIONS preload for local build/acceptance runs. Never imported
// by application runtime. Fail closed before HTTP(S) reaches external services.
import http from "node:http";
import https from "node:https";
const allowed = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
function check(input) {
  if (input && typeof input === "object" && input.socketPath) return;
  const host = typeof input === "string" || input instanceof URL
    ? new URL(input).hostname
    : input?.hostname ?? input?.host ?? "localhost";
  if (!allowed.has(String(host)) && !allowed.has(String(host).replace(/:\d+$/, ""))) {
    throw new Error("Non-local network request refused by local acceptance harness");
  }
}
for (const protocol of [http, https]) {
  for (const method of ["request", "get"]) {
    const original = protocol[method];
    protocol[method] = function (...args) { check(args[0]); return original.apply(this, args); };
  }
}
if (globalThis.fetch) {
  const original = globalThis.fetch;
  globalThis.fetch = function (input, init) {
    check(typeof Request !== "undefined" && input instanceof Request ? input.url : input);
    return original.call(this, input, init);
  };
}
