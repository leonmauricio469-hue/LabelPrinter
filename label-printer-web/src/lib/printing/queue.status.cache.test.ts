import assert from "node:assert/strict";
import { test } from "node:test";
import { createStatusCache } from "./queue.status.cache.ts";

function slowFetcher() {
  const calls: string[] = [];
  const release: Array<() => void> = [];
  const fetcher = (key: string) => {
    calls.push(key);
    return new Promise<string>((resolve) => release.push(() => resolve(`status of ${key}`)));
  };
  const releaseAll = () => release.splice(0).forEach((r) => r());
  return { calls, fetcher, releaseAll };
}

test("six simultaneous requests for one queue start one PowerShell, not six", async () => {
  const { calls, fetcher, releaseAll } = slowFetcher();
  const cache = createStatusCache(fetcher, 3000, () => 0);

  const pending = Array.from({ length: 6 }, () => cache.get("Zebra"));
  releaseAll();
  const results = await Promise.all(pending);

  assert.equal(calls.length, 1);
  assert.ok(results.every((r) => r === "status of Zebra"));
});

test("forced requests that arrive together also share one read", async () => {
  const { calls, fetcher, releaseAll } = slowFetcher();
  const cache = createStatusCache(fetcher, 3000, () => 0);

  const pending = [cache.get("Zebra", { force: true }), cache.get("Zebra", { force: true })];
  releaseAll();
  await Promise.all(pending);

  assert.equal(calls.length, 1);
});

test("a fresh result is reused, a stale one is read again", async () => {
  let now = 0;
  const { calls, fetcher, releaseAll } = slowFetcher();
  const cache = createStatusCache(fetcher, 3000, () => now);

  const first = cache.get("Zebra");
  releaseAll();
  await first;
  now = 1000;
  await cache.get("Zebra");
  assert.equal(calls.length, 1, "fresh result reused");

  now = 5000;
  const third = cache.get("Zebra");
  releaseAll();
  await third;
  assert.equal(calls.length, 2, "stale result read again");
});

test("a forced request after a finished read reads again", async () => {
  const { calls, fetcher, releaseAll } = slowFetcher();
  const cache = createStatusCache(fetcher, 3000, () => 0);

  const first = cache.get("Zebra");
  releaseAll();
  await first;
  const forced = cache.get("Zebra", { force: true });
  releaseAll();
  await forced;

  assert.equal(calls.length, 2);
});
