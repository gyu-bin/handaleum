/**
 * Serial queue: bake paper-frame map pins to PNG files for Naver `image.httpUri`.
 * Custom React children can't carry RN Image pixels on device; pre-baked PNGs can.
 */

export type MapPinBakeJob = {
  key: string;
  photoUri: string;
  selected: boolean;
  cardSize: number;
};

type Pending = MapPinBakeJob & {
  resolve: (uri: string | null) => void;
};

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();
const queue: Pending[] = [];
let active: Pending | null = null;
const listeners = new Set<() => void>();

/** Bound baked PNG path cache — month switches used to retain every pin forever. */
const BAKE_CACHE_MAX = 96;
/** Cap pending bakes — excess fall back to raw thumbs so zoom doesn't stall. */
const BAKE_QUEUE_MAX = 20;

function cacheBake(key: string, uri: string) {
  if (cache.has(key)) {
    cache.delete(key);
  }
  cache.set(key, uri);
  while (cache.size > BAKE_CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    cache.delete(oldest);
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function bakeKey(photoUri: string, selected: boolean, cardSize: number): string {
  return `${photoUri}|${selected ? 1 : 0}|${cardSize}`;
}

function trimQueue() {
  while (queue.length > BAKE_QUEUE_MAX) {
    // Drop the oldest non-selected from the back (selected sit at front).
    let dropAt = -1;
    for (let i = queue.length - 1; i >= 0; i -= 1) {
      if (!queue[i]!.selected) {
        dropAt = i;
        break;
      }
    }
    if (dropAt < 0) {
      break;
    }
    const [dropped] = queue.splice(dropAt, 1);
    if (!dropped) {
      break;
    }
    inflight.delete(dropped.key);
    dropped.resolve(null);
  }
}

function pump() {
  if (active || queue.length === 0) {
    emit();
    return;
  }
  active = queue.shift() ?? null;
  emit();
}

/** Subscribe the off-screen bake host to the active job. */
export function subscribePinBake(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getActivePinBakeJob(): MapPinBakeJob | null {
  return active;
}

export function completePinBake(uri: string | null) {
  const job = active;
  active = null;
  if (job) {
    if (uri) {
      cacheBake(job.key, uri);
    }
    job.resolve(uri);
  }
  pump();
}

/**
 * Host cancelled mid-capture (React effect teardown). Put the job back on the
 * queue instead of resolving null — that was leaving gray placeholder pins.
 */
export function deferActivePinBake() {
  const job = active;
  active = null;
  if (job && !queue.includes(job)) {
    queue.unshift(job);
  }
  // Don't pump synchronously — let the next tick / new Image onLoad drive it
  // so we don't immediately re-enter the same cancelled effect.
  setTimeout(() => {
    pump();
  }, 0);
}

/**
 * Returns a file:// PNG of the framed pin, or null on failure.
 * Dedupes concurrent requests for the same photo/selection size.
 */
export function requestMapPinBake(
  photoUri: string,
  selected: boolean,
  cardSize: number,
): Promise<string | null> {
  const key = bakeKey(photoUri, selected, cardSize);
  const hit = cache.get(key);
  if (hit) {
    return Promise.resolve(hit);
  }
  const pending = inflight.get(key);
  if (pending) {
    return pending;
  }

  const work = new Promise<string | null>((resolve) => {
    const pending: Pending = {
      key,
      photoUri,
      selected,
      cardSize,
      resolve: (uri) => {
        inflight.delete(key);
        resolve(uri);
      },
    };
    // Selected pins jump the queue so the open pin frames first.
    if (selected) {
      queue.unshift(pending);
    } else {
      queue.push(pending);
    }
    trimQueue();
    pump();
  });
  inflight.set(key, work);
  return work;
}
