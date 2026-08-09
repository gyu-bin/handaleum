import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import type { DummyImageSize } from '../services/dummyPhotos';
import { isDummyAssetId } from '../services/dummyPhotos';
import {
  isGridThumbWarmPaused,
  peekAssetFileUri,
  resolveAssetUri,
  scheduleGridThumbWarm,
  syncAssetDisplayUri,
} from '../services/mediaLibrary';

/**
 * Grid cell URI for the scroll hot path.
 * - iOS: always `ph://` for display (pin-export `file://` is for Naver; a bad
 *   export must not replace a working Photos URI with a blank frame).
 * - Android: sync cache, else one resolve + peek retries.
 * Warm still runs in the background for map pins / recycle.
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
    scheduleGridThumbWarm(assetId);
  }, [assetId]);

  useEffect(() => {
    if (Platform.OS === 'ios' && !isDummyAssetId(assetId)) {
      return;
    }
    if (syncUri != null && !syncUri.startsWith('ph://')) {
      return;
    }
    let cancelled = false;
    let attempt = 0;
    const run = async () => {
      if (syncUri == null) {
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

  if (Platform.OS === 'ios' && !isDummyAssetId(assetId)) {
    return `ph://${assetId}`;
  }
  if (asyncHit?.id === assetId) {
    return asyncHit.uri;
  }
  return syncUri;
}
