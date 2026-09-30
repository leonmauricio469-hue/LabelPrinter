/**
 * Keeps printer-status polls from overlapping without losing a refresh.
 *
 * Each poll takes ~2.3 s. Before, a request that arrived during a poll was dropped, so the
 * refresh asked right after a print could be lost behind a periodic poll that had read the
 * queue BEFORE the job reached it. Now requests during a poll collapse into one follow-up
 * run (forced if any of them was forced).
 */
export function createPollGate(run: (force: boolean) => Promise<void>) {
  let running = false;
  let pending: { force: boolean } | null = null;

  async function drain(force: boolean): Promise<void> {
    running = true;
    try {
      await run(force);
    } finally {
      running = false;
    }
    const next = pending;
    pending = null;
    if (next) await drain(next.force);
  }

  return {
    request(force: boolean): Promise<void> {
      if (running) {
        pending = { force: force || (pending?.force ?? false) };
        return Promise.resolve();
      }
      return drain(force);
    },
  };
}
