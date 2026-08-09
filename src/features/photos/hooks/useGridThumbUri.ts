import { useEffect, useState } from 'react';

import type { DummyImageSize } from '../services/dummyPhotos';
import {
  isGridThumbWarmPaused,
  peekAssetFileUri,
  resolveAssetUri,
  syncAssetDisplayUri,
} from '../services/mediaLibrary';

/**
 * Grid cell URI for the scroll hot path.
 * - Sync string when possible — no setState.
 * - Miss: one resolve, then cheap peek retries (no hammering while flinging).
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

  useEffect(() => {
    if (syncUri) {
      return;
    }
    let cancelled = false;
    let attempt = 0;
    const run = async () => {
      // One real resolve — further loops only peek (warm may finish later).
      const first = await resolveAssetUri(assetId, { imageSize });
      if (cancelled) {
        return;
      }
      if (first) {
        setAsyncHit({ id: assetId, uri: first });
        return;
      }
      while (!cancelled && attempt < 16) {
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
          setTimeout(r, Math.min(1500, 200 * attempt)),
        );
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [assetId, imageSize, retryNonce, syncUri]);

  if (syncUri) {
    return syncUri;
  }
  return asyncHit?.id === assetId ? asyncHit.uri : null;
}
