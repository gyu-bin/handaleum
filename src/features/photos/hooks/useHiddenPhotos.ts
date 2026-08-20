import { useCallback, useSyncExternalStore } from 'react';

import {
  hidePhoto,
  readHiddenPhotos,
  unhidePhoto,
  type HiddenPhotoSet,
} from '../services/hiddenPhotoStorage';
import type { MonthKey } from '../types';

const cache = new Map<MonthKey, HiddenPhotoSet>();
const listeners = new Map<MonthKey, Set<() => void>>();

function getCached(month: MonthKey): HiddenPhotoSet {
  const existing = cache.get(month);
  if (existing) {
    return existing;
  }
  const loaded = readHiddenPhotos(month);
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

/** Per-month photos hidden from the map, recap, and playback. */
export function useHiddenPhotos(month: MonthKey): {
  hidden: HiddenPhotoSet;
  hide: (assetId: string) => void;
  unhide: (assetId: string) => void;
} {
  const hidden = useSyncExternalStore(
    (listener) => subscribeMonth(month, listener),
    () => getCached(month),
    () => getCached(month),
  );

  const hide = useCallback(
    (assetId: string) => {
      try {
        const next = hidePhoto(month, assetId);
        cache.set(month, next);
        emit(month);
      } catch (error) {
        console.error('hidePhoto failed', month, assetId, error);
      }
    },
    [month],
  );

  const unhide = useCallback(
    (assetId: string) => {
      try {
        const next = unhidePhoto(month, assetId);
        cache.set(month, next);
        emit(month);
      } catch (error) {
        console.error('unhidePhoto failed', month, assetId, error);
      }
    },
    [month],
  );

  return { hidden, hide, unhide };
}
