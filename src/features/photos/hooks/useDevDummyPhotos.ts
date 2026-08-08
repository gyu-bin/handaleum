import { useCallback, useSyncExternalStore } from 'react';

import { queryClient } from '@/lib/queryClient';
import { notifyStampsChanged } from '@/features/stamps/hooks/useStamps';
import { startStampLibrarySync } from '@/features/stamps/services/stampLibrarySyncRunner';
import { clearAllStamps } from '@/features/stamps/services/stampsStorage';
import { setStampsScanIntroSeen } from '@/lib/storage';

import {
  isDevDummyPhotosEnabled,
  setDevDummyPhotosEnabled,
} from '../services/dummyPhotos';
import { clearPlaceResolveCache } from '../services/placeCache';
import { photosQueryKeys } from './photosQueryKeys';

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

/** __DEV__-only nationwide demo hubs. Default on until disabled. */
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
    clearPlaceResolveCache();
    // Sample hubs ↔ stamps: wipe then force full sync so 발도장 matches the map.
    clearAllStamps();
    notifyStampsChanged();
    if (next) {
      setStampsScanIntroSeen();
    }
    void queryClient.invalidateQueries({ queryKey: photosQueryKeys.all });
    void startStampLibrarySync({ force: true });
    emit();
  }, []);

  return { enabled, setEnabled };
}
