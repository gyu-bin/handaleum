import { useCallback, useSyncExternalStore } from 'react';

import { queryClient } from '@/lib/queryClient';

import { photosQueryKeys } from './photosQueryKeys';
import {
  isDevDummyPhotosEnabled,
  setDevDummyPhotosEnabled,
} from '../services/dummyPhotos';

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** __DEV__-only small demo set (~18 pins). Default on until disabled. */
export function useDevDummyPhotos(): {
  enabled: boolean;
  setEnabled: (next: boolean) => void;
} {
  const enabled = useSyncExternalStore(
    subscribe,
    isDevDummyPhotosEnabled,
    () => false,
  );

  const setEnabled = useCallback((next: boolean) => {
    setDevDummyPhotosEnabled(next);
    void queryClient.invalidateQueries({ queryKey: photosQueryKeys.all });
    emit();
  }, []);

  return { enabled, setEnabled };
}
