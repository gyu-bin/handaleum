import { useEffect, useState } from 'react';

import type { PhotoPermissionStatus } from '@/features/photos/hooks/usePhotoPermission';

import {
  isStampLibrarySyncing,
  startStampLibrarySync,
  subscribeStampLibrarySync,
} from '../services/stampLibrarySyncRunner';

/** Fallback if the user opens 발도장 without visiting the map first. */
const STAMP_SCREEN_SYNC_DELAY_MS = 12_000;

/**
 * Keeps stamp UI in sync with the single-flight full-album scan.
 * Starts only after a long delay — the map owns the earlier deferred kickoff
 * so we don't race first paint / pin bake with an immediate album GPS pass.
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
    const timer = setTimeout(() => {
      void startStampLibrarySync();
    }, STAMP_SCREEN_SYNC_DELAY_MS);
    return () => clearTimeout(timer);
  }, [permission.isReady, permission.status]);

  return { syncing };
}
