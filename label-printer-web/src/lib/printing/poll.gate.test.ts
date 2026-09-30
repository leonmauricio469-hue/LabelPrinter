import assert from "node:assert/strict";
import { test } from "node:test";
import { createPollGate } from "./poll.gate.ts";

const flush = () => new Promise((r) => setImmediate(r));

function controlledPoll() {
  const runs: boolean[] = [];
  const release: Array<() => void> = [];
  const run = (force: boolean) => {
    runs.push(force);
    return new Promise<void>((resolve) => release.push(resolve));
  };
  const finishOne = async () => {
    release.shift()?.();
    await flush();
  };
  return { runs, run, finishOne };
}

test("a refresh asked during a poll runs after it instead of being dropped", async () => {
  const { runs, run, finishOne } = controlledPoll();
  const gate = createPollGate(run);

  void gate.request(false); // periodic poll
  void gate.request(true); // refresh after a print, while the poll runs
  await finishOne();
  await finishOne();

  assert.deepEqual(runs, [false, true]);
});

test("several requests during one poll become a single follow-up", async () => {
  const { runs, run, finishOne } = controlledPoll();
  const gate = createPollGate(run);

  void gate.request(false);
  void gate.request(false);
  void gate.request(true);
  void gate.request(false);
  await finishOne();
  await finishOne();

  assert.deepEqual(runs, [false, true]);
});

test("with nothing pending, polls do not overlap", async () => {
  const { runs, run, finishOne } = controlledPoll();
  const gate = createPollGate(run);

  void gate.request(false);
  await finishOne();
  void gate.request(false);
  await finishOne();

  assert.deepEqual(runs, [false, false]);
});
