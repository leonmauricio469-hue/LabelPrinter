import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequestLedger } from "./request.ledger.ts";
import type { PrintResult } from "./printer.types.ts";

function counter(result: PrintResult) {
  let calls = 0;
  return {
    send: async () => {
      calls++;
      return result;
    },
    get calls() {
      return calls;
    },
  };
}

test("repeating a request that was already sent does not print again", async () => {
  const ledger = createRequestLedger();
  const job = counter({ ok: true });

  await ledger.run("req-1", job.send);
  const again = await ledger.run("req-1", job.send);

  assert.equal(job.calls, 1);
  assert.equal(again.duplicate, true);
  assert.equal(again.ok, true);
});

test("the same request arriving twice at once is sent once", async () => {
  const ledger = createRequestLedger();
  const job = counter({ ok: true });

  await Promise.all([ledger.run("req-1", job.send), ledger.run("req-1", job.send)]);

  assert.equal(job.calls, 1);
});

test("an uncertain send is never repeated automatically", async () => {
  const ledger = createRequestLedger();
  const job = counter({ ok: false, uncertain: true, error: "timeout" });

  await ledger.run("req-1", job.send);
  const again = await ledger.run("req-1", job.send);

  assert.equal(job.calls, 1);
  assert.equal(again.uncertain, true);
  assert.equal(again.duplicate, true);
});

test("a request that surely failed can be retried with the same id", async () => {
  const ledger = createRequestLedger();
  const job = counter({ ok: false, error: "OpenPrinter fallo" });

  await ledger.run("req-1", job.send);
  await ledger.run("req-1", job.send);

  assert.equal(job.calls, 2);
});

test("different requests are independent", async () => {
  const ledger = createRequestLedger();
  const job = counter({ ok: true });

  await ledger.run("req-1", job.send);
  await ledger.run("req-2", job.send);

  assert.equal(job.calls, 2);
});
