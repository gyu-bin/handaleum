import { useCallback, useSyncExternalStore } from 'react';

import {
  clearHomeLocation,
  readHomeLocation,
  writeHomeLocation,
} from '../services/homeLocationStorage';
import type { HomeLocation } from '../types';

let cache: HomeLocation | null | undefined;
const listeners = new Set<() => void>();

function getSnapshot(): HomeLocation | null {
  if (cache === undefined) {
    cache = readHomeLocation();
  }
  return cache;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(next: HomeLocation | null) {
  cache = next;
  listeners.forEach((listener) => listener());
}

/**
 * The single home location, shared app-wide. Not per-month: home does not
 * change when you page through the calendar.
 */
export function useHomeLocation(): {
  home: HomeLocation | null;
  setHome: (home: HomeLocation) => void;
  clearHome: () => void;
} {
  const home = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setHome = useCallback((next: HomeLocation) => {
    emit(writeHomeLocation(next));
  }, []);

  const clearHome = useCallback(() => {
    emit(clearHomeLocation());
  }, []);

  return { home, setHome, clearHome };
}
