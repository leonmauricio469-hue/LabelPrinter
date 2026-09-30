/**
 * Serializes scans so only one is processed at a time, first in, first out.
 *
 * A scan can arrive while the previous one is still going to the spooler (~2.4 s over USB).
 * This used to be a single pending slot: with A printing and B waiting, scanning C replaced
 * B without any notice, and that label was never printed.
 *
 * `process` is expected to report its own errors; one failing scan never blocks the rest.
 */
export function createScanQueue(process: (code: string) => Promise<void>) {
  const pending: string[] = [];
  let running = false;

  async function drain(): Promise<void> {
    running = true;
    while (pending.length > 0) {
      const code = pending.shift()!;
      try {
        await process(code);
      } catch (err) {
        console.error(`scan "${code}" failed:`, err);
      }
    }
    running = false;
  }

  return {
    push(code: string): void {
      pending.push(code);
      if (!running) void drain();
    },
  };
}
