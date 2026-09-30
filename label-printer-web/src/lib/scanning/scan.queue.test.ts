import assert from "node:assert/strict";
import { test } from "node:test";
import { createScanQueue } from "./scan.queue.ts";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

const flush = () => new Promise((r) => setImmediate(r));

test("scans that arrive during a print are all printed, in order", async () => {
  const printed: string[] = [];
  const firstPrint = deferred();
  const queue = createScanQueue(async (code) => {
    printed.push(code);
    if (code === "A") await firstPrint.promise;
  });

  queue.push("A");
  queue.push("B");
  queue.push("C");
  firstPrint.resolve();
  await flush();

  assert.deepEqual(printed, ["A", "B", "C"]);
});

test("a failing scan does not stop the ones queued behind it", async () => {
  const printed: string[] = [];
  const queue = createScanQueue(async (code) => {
    if (code === "A") throw new Error("spooler down");
    printed.push(code);
  });

  queue.push("A");
  queue.push("B");
  await flush();

  assert.deepEqual(printed, ["B"]);
});
