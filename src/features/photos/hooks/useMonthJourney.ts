import { useEffect, useMemo, useState } from 'react';

import type { PhotoRef, VisitPlace } from '../types';
import {
  hydrateVisitPlacesFromPhotos,
  resolveVisitPlaces,
} from '../services/placeResolve';
import { labelsForVisitLevel } from '../utils/placeLabels';

/** Swallow rapid GPS batch churn; month swipe should not wait half a second. */
const RESOLVE_DEBOUNCE_MS = 120;

/**
 * O(n) fingerprint without allocating a multi-MB join string (2600+ months).
 */
function photosFingerprint(photos: PhotoRef[]): string {
  const n = photos.length;
  if (n === 0) {
    return '0';
  }
  let h = n | 0;
  let latSum = 0;
  let lngSum = 0;
  for (let i = 0; i < n; i += 1) {
    const p = photos[i]!;
    latSum += p.lat;
    lngSum += p.lng;
    const id = p.assetId;
    h = (Math.imul(h, 31) + id.length) | 0;
    h = (Math.imul(h, 31) + (id.charCodeAt(0) || 0)) | 0;
    h = (Math.imul(h, 31) + (id.charCodeAt(id.length - 1) || 0)) | 0;
    h = (Math.imul(h, 31) + Math.round(p.lat * 1000)) | 0;
    h = (Math.imul(h, 31) + Math.round(p.lng * 1000)) | 0;
  }
  return `${n}:${h}:${latSum.toFixed(2)}:${lngSum.toFixed(2)}`;
}

/** Skip state updates (and the map re-render they cause) when nothing changed. */
function sameVisitPlaces(a: VisitPlace[], b: VisitPlace[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i]!.key !== b[i]!.key || a[i]!.label !== b[i]!.label) {
      return false;
    }
  }
  return true;
}

export type UseMonthJourneyOptions = {
  /**
   * When false, skip network geocode (keep hydrated/disk places).
   * Pass `!isFetching` so progressive GPS batches don't cancel geocode storms.
   */
  enabled?: boolean;
  /** Clear places when the month changes so we don't flash the previous month. */
  resetKey?: string;
};

/**
 * Reverse-geocodes month photos; exposes familiar place labels for header chips.
 * Cold start: hydrate from disk immediately (GPS was already cached; names now too).
 */
export function useMonthJourney(
  photos: PhotoRef[],
  options?: UseMonthJourneyOptions,
): {
  places: string[];
  visitPlaces: VisitPlace[];
  isResolving: boolean;
} {
  const enabled = options?.enabled ?? true;
  const resetKey = options?.resetKey;
  const [visitPlaces, setVisitPlaces] = useState<VisitPlace[]>([]);
  const [isResolving, setIsResolving] = useState(false);

  const photosKey = photosFingerprint(photos);

  // Immediate disk/memory hydrate — do not wait for isFetching / geocode.
  // MapCanvas is memoized so chip updates do not churn native markers.
  useEffect(() => {
    if (photos.length === 0) {
      setVisitPlaces([]);
      setIsResolving(false);
      return;
    }
    const hydrated = hydrateVisitPlacesFromPhotos(photos);
    if (hydrated.length > 0) {
      setVisitPlaces((prev) => (sameVisitPlaces(prev, hydrated) ? prev : hydrated));
    }
    // Disk miss: keep previous chips until progress/final — avoids empty flash
    // under the new month title while geocode catches up.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by photosKey/resetKey
  }, [photosKey, resetKey]);

  useEffect(() => {
    let cancelled = false;

    if (!enabled) {
      return;
    }

    if (photos.length === 0) {
      return;
    }

    setIsResolving(true);
    const signal = { cancelled: false };
    const timer = setTimeout(() => {
      void resolveVisitPlaces(photos, {
        signal,
        onProgress: (partial) => {
          if (!signal.cancelled && partial.length > 0) {
            setVisitPlaces((prev) =>
              sameVisitPlaces(prev, partial) ? prev : partial,
            );
          }
        },
      })
        .then((next) => {
          if (cancelled) {
            return;
          }
          if (next.length > 0) {
            setVisitPlaces((prev) =>
              sameVisitPlaces(prev, next) ? prev : next,
            );
          }
          setIsResolving(false);
        })
        .catch((error) => {
          console.warn('resolveVisitPlaces failed', error);
          if (!cancelled) {
            setIsResolving(false);
          }
        });
    }, RESOLVE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      signal.cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by photosKey
  }, [photosKey, enabled]);

  const places = useMemo(
    () => labelsForVisitLevel(visitPlaces, 'dong'),
    [visitPlaces],
  );

  return { places, visitPlaces, isResolving };
}
