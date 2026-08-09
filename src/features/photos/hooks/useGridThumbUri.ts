import { useEffect, useState } from 'react';

import type { DummyImageSize } from '../services/dummyPhotos';
import {
  isGridThumbWarmPaused,
  peekAssetFileUri,
  resolveAssetUri,
  scheduleGridThumbWarm,
  syncAssetDisplayUri,
} from '../services/mediaLibrary';

/**
 * Grid cell URI for the scroll hot path.
 * - Sync string when possible — no setState.
 * - Miss / iOS `ph://`: idle-warm then one peek upgrade (no hammering while flinging).
 */
export function useGridThumbUri(
  assetId: string,
  imageSize: DummyImageSize = 128,
  retryNonce = 0,
): string | null {
  const syncUri = syncAssetDisplayUri(assetId, imageSize);
  const [asyncHit, setAsyncHit] = useState<{
    id: string;
    uri: string;
  } | null>(null);

  // Viewport warm: each mounted cell asks for a file thumb (paused while flinging).
  useEffect(() => {
    scheduleGridThumbWarm(assetId);
  }, [assetId]);

  useEffect(() => {
    // Durable file:// already — nothing async to do.
    if (syncUri != null && !syncUri.startsWith('ph://')) {
      return;
    }
    let cancelled = false;
    let attempt = 0;
    const run = async () => {
      if (syncUri == null) {
        // Android / cache miss: one real resolve, then peek retries.
        const first = await resolveAssetUri(assetId, { imageSize });
        if (cancelled) {
          return;
        }
        if (first) {
          setAsyncHit({ id: assetId, uri: first });
          return;
        }
      }
      while (!cancelled && attempt < 20) {
        // Don't fight the scroll fling with timer storms.
        if (isGridThumbWarmPaused()) {
          await new Promise((r) => setTimeout(r, 200));
          continue;
        }
        const peek = peekAssetFileUri(assetId);
        if (peek) {
          setAsyncHit({ id: assetId, uri: peek });
          return;
        }
        attempt += 1;
        await new Promise((r) =>
          setTimeout(r, Math.min(1200, 150 * attempt)),
        );
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [assetId, imageSize, retryNonce, syncUri]);

  if (asyncHit?.id === assetId) {
    return asyncHit.uri;
  }
  return syncUri;
}
