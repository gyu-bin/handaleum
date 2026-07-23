import { useCallback, useSyncExternalStore } from 'react';

import { IS_MONETIZATION_LIVE } from '@/shared/constants/pricing';
import { readIsPro, writeIsPro } from '../services/placeFirstSeenStorage';

let cache: boolean | undefined;
const listeners = new Set<() => void>();

function getSnapshot(): boolean {
  // All features unlocked until IAP ships.
  if (!IS_MONETIZATION_LIVE) {
    return true;
  }
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

/** Pro flag. While monetization is off, always reports true. */
export function useIsPro(): {
  isPro: boolean;
  setIsPro: (value: boolean) => void;
} {
  const isPro = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setIsPro = useCallback((value: boolean) => {
    if (!IS_MONETIZATION_LIVE) {
      return;
    }
    writeIsPro(value);
    emit(value);
  }, []);
  return { isPro, setIsPro };
}
