/**
 * Cap how many async tasks run at once (MediaLibrary / ImageManipulator spikes
 * OOM on months with hundreds of photos when left unbounded).
 */
export function createConcurrencyLimiter(limit: number): <T>(
  task: () => Promise<T>,
) => Promise<T> {
  const max = Math.max(1, limit);
  let active = 0;
  const queue: Array<() => void> = [];

  const pump = () => {
    if (active >= max) {
      return;
    }
    const start = queue.shift();
    if (!start) {
      return;
    }
    active += 1;
    start();
  };

  return function runLimited<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
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
      });
      pump();
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
