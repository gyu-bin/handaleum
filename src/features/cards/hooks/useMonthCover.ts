import { useCallback, useSyncExternalStore } from 'react';

import type { MonthKey } from '@/features/photos/types';

import { readMonthCover, writeMonthCover } from '../services/monthCoverStorage';

const cache = new Map<MonthKey, string | null>();
const listeners = new Map<MonthKey, Set<() => void>>();

function getCached(month: MonthKey): string | null {
  if (cache.has(month)) {
    return cache.get(month) ?? null;
  }
  const loaded = readMonthCover(month);
  cache.set(month, loaded);
  return loaded;
}

function emit(month: MonthKey) {
  listeners.get(month)?.forEach((listener) => listener());
}

function subscribeMonth(month: MonthKey, listener: () => void): () => void {
  let set = listeners.get(month);
  if (!set) {
    set = new Set();
    listeners.set(month, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
  };
}

/** Per-month summary hero cover (assetId). */
export function useMonthCover(month: MonthKey): {
  coverAssetId: string | null;
  setCover: (assetId: string) => void;
} {
  const coverAssetId = useSyncExternalStore(
    (listener) => subscribeMonth(month, listener),
    () => getCached(month),
    () => getCached(month),
  );

  const setCover = useCallback(
    (assetId: string) => {
      try {
        const next = writeMonthCover(month, assetId);
        cache.set(month, next);
        emit(month);
      } catch (error) {
        console.error('month setCover failed', month, error);
      }
    },
    [month],
  );

  return { coverAssetId, setCover };
}
