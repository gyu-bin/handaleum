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
    queue.push({
      key,
      photoUri,
      selected,
      cardSize,
      resolve: (uri) => {
        inflight.delete(key);
        resolve(uri);
      },
    });
    pump();
  });
  inflight.set(key, work);
  return work;
}
