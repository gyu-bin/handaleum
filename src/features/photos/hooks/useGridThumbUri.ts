import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import type { DummyImageSize } from '../services/dummyPhotos';
import { isDummyAssetId } from '../services/dummyPhotos';
import {
  peekAssetFileUri,
  resolveAssetUri,
  scheduleGridThumbWarm,
  syncAssetDisplayUri,
} from '../services/mediaLibrary';

/**
 * Grid cell URI for the scroll hot path.
 * Display must not wait on thumb-warm pause — pause only slows pin exports.
 * - iOS: `ph://` sync
 * - Android: MediaStore `content://` sync when id is numeric; else resolve
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
    // Sync display URI already paints — don't fight decode with pin-thumb bake.
    if (syncUri != null) {
      return;
    }
    scheduleGridThumbWarm(assetId);
  }, [assetId, syncUri]);

  useEffect(() => {
    // Already have a sync display URI (ph:// / content:// / file:// / https).
    if (syncUri != null) {
      return;
    }
    let cancelled = false;
    let attempt = 0;
    const run = async () => {
      while (!cancelled && attempt < 40) {
        const peek = peekAssetFileUri(assetId);
        if (peek) {
          setAsyncHit({ id: assetId, uri: peek });
          return;
        }
        try {
          const resolved = await resolveAssetUri(assetId, { imageSize });
          if (cancelled) {
            return;
          }
          if (resolved) {
            setAsyncHit({ id: assetId, uri: resolved });
            return;
          }
        } catch {
          // Overflow / transient — retry.
        }
        attempt += 1;
        await new Promise((r) =>
          setTimeout(r, Math.min(1200, 100 * attempt)),
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
  // Prefer MediaStore content URI over pin-export file:// (can be missing/corrupt).
  if (Platform.OS === 'android' && !isDummyAssetId(assetId) && /^\d+$/.test(assetId)) {
    return `content://media/external/images/media/${assetId}`;
  }
  if (asyncHit?.id === assetId) {
    return asyncHit.uri;
  }
  return syncUri;
}
