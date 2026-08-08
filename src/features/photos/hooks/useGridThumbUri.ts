import { useEffect, useState } from 'react';

import type { DummyImageSize } from '../services/dummyPhotos';
import {
  resolveAssetUri,
  syncAssetDisplayUri,
} from '../services/mediaLibrary';

/**
 * Grid cell URI for the scroll hot path.
 * - Sync string when possible (iOS ph:// / warm file:// / dummy) — no setState.
 * - Android cache miss: one resolve + setState.
 * - Does NOT schedule file-thumb warm (that runs only via warmGridThumbs while
 *   scroll is idle — per-cell warm during fling hitched the UI).
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
    void resolveAssetUri(assetId, { imageSize })
      .then((next) => {
        if (!cancelled && next) {
          setAsyncHit({ id: assetId, uri: next });
        }
      })
      .catch((error) => {
        console.warn('useGridThumbUri failed', assetId, error);
      });
    return () => {
      cancelled = true;
    };
  }, [assetId, imageSize, retryNonce, syncUri]);

  if (syncUri) {
    return syncUri;
  }
  return asyncHit?.id === assetId ? asyncHit.uri : null;
}
