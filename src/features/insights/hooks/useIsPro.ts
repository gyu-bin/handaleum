import { useCallback, useSyncExternalStore } from 'react';

import { readIsPro, writeIsPro } from '../services/placeFirstSeenStorage';

let cache: boolean | undefined;
const listeners = new Set<() => void>();

function getSnapshot(): boolean {
  if (cache === undefined) {
    cache = readIsPro();
  }
  return cache;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(next: boolean) {
  cache = next;
  listeners.forEach((l) => l());
}

/** Local pro flag until RevenueCat. */
export function useIsPro(): {
  isPro: boolean;
  setIsPro: (value: boolean) => void;
} {
  const isPro = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setIsPro = useCallback((value: boolean) => {
    writeIsPro(value);
    emit(value);
  }, []);
  return { isPro, setIsPro };
}
