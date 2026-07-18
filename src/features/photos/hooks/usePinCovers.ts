import { useCallback, useSyncExternalStore } from 'react';

import {
  clearPinCover,
  readPinCovers,
  writePinCover,
  type PinCoverMap,
} from '../services/pinCoverStorage';
import type { MonthKey } from '../types';

const cache = new Map<MonthKey, PinCoverMap>();
const listeners = new Map<MonthKey, Set<() => void>>();

function getCached(month: MonthKey): PinCoverMap {
  const existing = cache.get(month);
  if (existing) {
    return existing;
  }
  const loaded = readPinCovers(month);
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

/**
 * Per-month pin cover photos (placeKey → assetId).
 */
export function usePinCovers(month: MonthKey): {
  covers: PinCoverMap;
  setCover: (placeKey: string, assetId: string) => void;
  clearCover: (placeKey: string) => void;
  coverFor: (placeKey: string) => string | undefined;
} {
  const covers = useSyncExternalStore(
    (listener) => subscribeMonth(month, listener),
    () => getCached(month),
    () => getCached(month),
  );

  const setCover = useCallback(
    (placeKey: string, assetId: string) => {
      const next = writePinCover(month, placeKey, assetId);
      cache.set(month, next);
      emit(month);
    },
    [month],
  );

  const clearCover = useCallback(
    (placeKey: string) => {
      const next = clearPinCover(month, placeKey);
      cache.set(month, next);
      emit(month);
    },
    [month],
  );

  const coverFor = useCallback(
    (placeKey: string) => covers[placeKey],
    [covers],
  );

  return { covers, setCover, clearCover, coverFor };
}
