import { useEffect, useState } from 'react';

import type { DummyImageSize } from '../services/dummyPhotos';
import {
  resolveAssetUri,
  syncAssetDisplayUri,
} from '../services/mediaLibrary';

/**
 * Grid cell URI — sync path only on the hot scroll path.
 * Never runs ImageManipulator / pin-thumb export here (that stalls scroll).
 * iOS/dummy: sync string, zero setState. Android: one resolve when cache misses.
 */
export function useGridThumbUri(
  assetId: string,
  imageSize: DummyImageSize = 128,
  /** Bump to re-run Android resolve after a failed decode. */
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
