/**
 * Status cache that also shares reads in flight.
 *
 * Reading the queue status spawns powershell.exe (~2.3 s). Before, the cache only existed
 * once a read had finished: six requests arriving during the first read started six
 * processes, and `force` (used by the banner on mount and after every print) always started
 * a new one. Now there is one promise per key: whoever asks while it runs, forced or not,
 * gets that same read. `force` only skips a FINISHED result.
 */
export function createStatusCache<T>(
  fetcher: (key: string) => Promise<T>,
  ttlMs: number,
  now: () => number = Date.now,
) {
  const done = new Map<string, { at: number; value: T }>();
  const inFlight = new Map<string, Promise<T>>();

  return {
    get(key: string, options: { force?: boolean } = {}): Promise<T> {
      const running = inFlight.get(key);
      if (running) return running;

      const cached = done.get(key);
      if (!options.force && cached && now() - cached.at < ttlMs) {
        return Promise.resolve(cached.value);
      }

      const read = fetcher(key)
        .then((value) => {
          // Stamped AFTER the read: stamping before would spend most of the TTL on the spawn.
          done.set(key, { at: now(), value });
          return value;
        })
        .finally(() => inFlight.delete(key));
      inFlight.set(key, read);
      return read;
    },
  };
}
