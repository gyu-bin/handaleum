import { useEffect, useState } from 'react';

import type { PhotoPermissionStatus } from '@/features/photos/hooks/usePhotoPermission';

import {
  isStampLibrarySyncing,
  startStampLibrarySync,
  subscribeStampLibrarySync,
} from '../services/stampLibrarySyncRunner';

/**
 * Keeps stamp UI in sync with the single-flight full-album scan.
 * Starts the scan when photo library access is ready (also started from map).
 */
export function useStampLibrarySync(permission: {
  isReady: boolean;
  status: PhotoPermissionStatus;
}): {
  syncing: boolean;
} {
  const [syncing, setSyncing] = useState(isStampLibrarySyncing);

  useEffect(() => {
    return subscribeStampLibrarySync(setSyncing);
  }, []);

  useEffect(() => {
    if (!permission.isReady) {
      return;
    }
    const hasAccess =
      permission.status === 'granted' || permission.status === 'limited';
    if (!hasAccess) {
      return;
    }
    void startStampLibrarySync();
  }, [permission.isReady, permission.status]);

  return { syncing };
}
