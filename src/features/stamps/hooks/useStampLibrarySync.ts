import { useEffect, useRef, useState } from 'react';

import { syncStampsFromLibrary } from '../services/stampBackfill';
import { countCollected, readStampsCollected } from '../services/stampsStorage';

/**
 * On StampScreen mount: sync stamps from all GPS photos (not current month only).
 * Shows a blocking loader only while the collection is still empty.
 */
export function useStampLibrarySync(): {
  syncing: boolean;
} {
  const [syncing, setSyncing] = useState(
    () => countCollected(readStampsCollected()) === 0,
  );
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;
    const showBlock = countCollected(readStampsCollected()) === 0;
    if (showBlock) {
      setSyncing(true);
    }
    void syncStampsFromLibrary()
      .catch((error) => {
        console.warn('[stamps] library sync failed', error);
      })
      .finally(() => {
        setSyncing(false);
      });
  }, []);

  return { syncing };
}
