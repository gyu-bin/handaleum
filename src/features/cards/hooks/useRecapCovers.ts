import { useCallback, useSyncExternalStore } from 'react';

import type { MonthKey } from '@/features/photos/types';

import {
  readRecapCovers,
  writeRecapCover,
  type RecapCoverMap,
} from '../services/recapCoverStorage';

const cache = new Map<MonthKey, RecapCoverMap>();
const listeners = new Map<MonthKey, Set<() => void>>();

function getCached(month: MonthKey): RecapCoverMap {
  const existing = cache.get(month);
  if (existing) {
    return existing;
  }
  const loaded = readRecapCovers(month);
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

/** Per-month recap-board cover photos (nodeId → assetId). */
export function useRecapCovers(month: MonthKey): {
  covers: RecapCoverMap;
  setCover: (nodeId: string, assetId: string) => void;
} {
  const covers = useSyncExternalStore(
    (listener) => subscribeMonth(month, listener),
    () => getCached(month),
    () => getCached(month),
  );

  const setCover = useCallback(
    (nodeId: string, assetId: string) => {
      try {
        const next = writeRecapCover(month, nodeId, assetId);
        cache.set(month, next);
        emit(month);
      } catch (error) {
        console.error('recap setCover failed', month, nodeId, error);
      }
    },
    [month],
  );

  return { covers, setCover };
}
