import { useEffect, useState } from 'react';

import { isDevDummyPhotosEnabled } from '@/features/photos/services/dummyPhotos';
import type { PhotoPermissionStatus } from '@/features/photos/hooks/usePhotoPermission';

import {
  isStampLibrarySyncing,
  startStampLibrarySync,
  subscribeStampLibrarySync,
} from '../services/stampLibrarySyncRunner';
import {
  countCollected,
  readStampsCollected,
} from '../services/stampsStorage';

/** Fallback if the user opens 발도장 without visiting the map first. */
const STAMP_SCREEN_SYNC_DELAY_MS = 12_000;
/** Sample mode: kick sooner so the list isn't empty while map kickoff waits. */
const DUMMY_STAMP_SYNC_DELAY_MS = 400;
/** Below this, force a full sample resync (real-album race can wipe stamps). */
const DUMMY_STAMP_MIN_COUNT = 20;

/**
 * Keeps stamp UI in sync with the single-flight full-album scan.
 * Starts only after a long delay — the map owns the earlier deferred kickoff
 * so we don't race first paint / pin bake with an immediate album GPS pass.
 * __DEV__ sample mode syncs immediately and does not need album permission.
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
    const dummy = isDevDummyPhotosEnabled();
    if (!dummy && !permission.isReady) {
      return;
    }
    const hasAccess =
      permission.status === 'granted' || permission.status === 'limited';
    if (!dummy && !hasAccess) {
      return;
    }
    const sparse =
      dummy && countCollected(readStampsCollected()) < DUMMY_STAMP_MIN_COUNT;
    const delay = dummy ? DUMMY_STAMP_SYNC_DELAY_MS : STAMP_SCREEN_SYNC_DELAY_MS;
    const timer = setTimeout(() => {
      void startStampLibrarySync({ force: sparse });
    }, delay);
    return () => clearTimeout(timer);
  }, [permission.isReady, permission.status]);

  return { syncing };
}
