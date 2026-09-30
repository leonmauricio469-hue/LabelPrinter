import assert from "node:assert/strict";
import { test } from "node:test";
import { crossSiteRejection } from "./same-origin.ts";

const req = (headers: Record<string, string>) =>
  new Request("http://127.0.0.1:3000/api/labels", { method: "POST", headers });

test("a JSON request from the app itself is accepted", () => {
  const r = req({ host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000", "content-type": "application/json" });

  assert.equal(crossSiteRejection(r), null);
});

test("a form posted by another website is rejected", () => {
  // <form enctype="text/plain" action="http://127.0.0.1:3000/api/labels"> on any page.
  const r = req({ host: "127.0.0.1:3000", origin: "https://evil.example", "content-type": "text/plain" });

  assert.equal(crossSiteRejection(r)?.status, 403);
});

test("a body that is not JSON is rejected even without an Origin header", () => {
  const r = req({ host: "127.0.0.1:3000", "content-type": "text/plain" });

  assert.equal(crossSiteRejection(r)?.status, 415);
});

test("JSON sent from another origin is rejected", () => {
  const r = req({ host: "127.0.0.1:3000", origin: "http://192.168.1.50:8080", "content-type": "application/json" });

  assert.equal(crossSiteRejection(r)?.status, 403);
});

test("a request without a body only needs the same origin", () => {
  const r = req({ host: "127.0.0.1:3000", origin: "https://evil.example" });

  assert.equal(crossSiteRejection(r, { body: false })?.status, 403);
  assert.equal(crossSiteRejection(req({ host: "127.0.0.1:3000" }), { body: false }), null);
});
