import type { PrintResult } from "./printer.types";

/** How long a processed request id is remembered: long enough for any retry. */
const REMEMBER_MS = 30 * 60 * 1000;

/**
 * Print requests by id, so a repeated request never prints twice by accident.
 *
 * The client sends a `requestId` and reuses it when it lost the response (E22): the job may
 * have been sent and only the HTTP answer got lost. Per id:
 *
 * - in progress        -> the repeat waits for the same send
 * - sent (ok)          -> the repeat gets the same answer, marked `duplicate`, nothing sent
 * - uncertain          -> same: never re-sent automatically; a new print needs a new id,
 *                         which is the operator's conscious decision after checking the printer
 * - surely failed      -> forgotten, so the same id can be retried
 *
 * Kept in memory: a restart forgets ids. That only matters for a response lost exactly
 * across a restart, and the history (M01) still records every send.
 */
export function createRequestLedger(now: () => number = Date.now) {
  const entries = new Map<string, { at: number; result: Promise<PrintResult> }>();

  function forgetOld() {
    const limit = now() - REMEMBER_MS;
    for (const [id, e] of entries) if (e.at < limit) entries.delete(id);
  }

  return {
    async run(requestId: string, send: () => Promise<PrintResult>): Promise<PrintResult> {
      forgetOld();
      const known = entries.get(requestId);
      if (known) return { ...(await known.result), duplicate: true };

      const result = send();
      entries.set(requestId, { at: now(), result });
      const settled = await result.catch((err: unknown) => {
        entries.delete(requestId);
        throw err;
      });
      if (!settled.ok && !settled.uncertain) entries.delete(requestId);
      return settled;
    },
  };
}
