/**
 * Cap how many async tasks run at once (MediaLibrary / ImageManipulator spikes
 * OOM on months with hundreds of photos when left unbounded).
 */

export class ConcurrencyQueueOverflowError extends Error {
  constructor(message = 'concurrency queue overflow') {
    super(message);
    this.name = 'ConcurrencyQueueOverflowError';
  }
}

export type ConcurrencyLimiterOptions = {
  /** Max waiting tasks (not including active). Default: unbounded. */
  maxQueue?: number;
  /**
   * When the wait queue is full:
   * - drop-newest: reject the incoming task (default)
   * - drop-oldest: reject the oldest waiter, then enqueue the new one
   */
  onOverflow?: 'drop-newest' | 'drop-oldest';
};

export function createConcurrencyLimiter(
  limit: number,
  options: ConcurrencyLimiterOptions = {},
): <T>(task: () => Promise<T>) => Promise<T> {
  const max = Math.max(1, limit);
  const maxQueue =
    options.maxQueue != null ? Math.max(0, options.maxQueue) : Infinity;
  const onOverflow = options.onOverflow ?? 'drop-newest';
  let active = 0;
  type Waiter = {
    start: () => void;
    reject: (error: unknown) => void;
  };
  const queue: Waiter[] = [];

  const pump = () => {
    if (active >= max) {
      return;
    }
    const next = queue.shift();
    if (!next) {
      return;
    }
    active += 1;
    next.start();
  };

  return function runLimited<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const enqueue = () => {
        queue.push({
          start: () => {
            task().then(
              (value) => {
                active -= 1;
                pump();
                resolve(value);
              },
              (error) => {
                active -= 1;
                pump();
                reject(error);
              },
            );
          },
          reject,
        });
        pump();
      };

      if (queue.length < maxQueue) {
        enqueue();
        return;
      }

      if (onOverflow === 'drop-oldest' && queue.length > 0) {
        const oldest = queue.shift();
        oldest?.reject(new ConcurrencyQueueOverflowError());
        enqueue();
        return;
      }

      reject(new ConcurrencyQueueOverflowError());
    });
  };
}

/** Bound a Map to `max` entries (insertion-order LRU). */
export function lruSet<K, V>(map: Map<K, V>, key: K, value: V, max: number): void {
  if (map.has(key)) {
    map.delete(key);
  }
  map.set(key, value);
  while (map.size > max) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    map.delete(oldest);
  }
}
