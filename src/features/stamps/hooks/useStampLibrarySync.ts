import { useEffect, useRef, useState } from 'react';

import type { PhotoPermissionStatus } from '@/features/photos/hooks/usePhotoPermission';

import { syncStampsFromLibrary } from '../services/stampBackfill';
import { countCollected, readStampsCollected } from '../services/stampsStorage';

/**
 * On StampScreen: after photo permission is ready, sync stamps from all GPS
 * photos in the real album (not current month only, not __DEV__ dummy).
 * Blocking loader while the collection is still empty; otherwise syncs in
 * background and keeps `syncing` true until finished.
 */
export function useStampLibrarySync(permission: {
  isReady: boolean;
  status: PhotoPermissionStatus;
}): {
  syncing: boolean;
} {
  const [syncing, setSyncing] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!permission.isReady || started.current) {
      return;
    }
    const hasAccess =
      permission.status === 'granted' || permission.status === 'limited';
    if (!hasAccess) {
      setSyncing(false);
      return;
    }

    started.current = true;
    const showBlock = countCollected(readStampsCollected()) === 0;
    setSyncing(true);
    if (!showBlock) {
      // Non-empty: still sync, but grid stays visible (StampScreen uses syncing).
    }

    void syncStampsFromLibrary()
      .catch((error) => {
        console.warn('[stamps] library sync failed', error);
        // Allow retry on next mount if this run failed early.
        started.current = false;
      })
      .finally(() => {
        setSyncing(false);
      });
  }, [permission.isReady, permission.status]);

  return { syncing };
}
