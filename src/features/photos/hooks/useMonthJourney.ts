import { useEffect, useMemo, useState } from 'react';

import type { PhotoRef, VisitAdminLevel, VisitPlace } from '../types';
import {
  labelsForVisitLevel,
  resolveVisitPlaces,
} from '../utils/placeJourney';

/** Long enough to swallow a time-slider drag, short enough to feel immediate. */
const RESOLVE_DEBOUNCE_MS = 250;

/**
 * Reverse-geocodes month photos once; exposes journey labels and zoom-scoped lists.
 */
export function useMonthJourney(photos: PhotoRef[]): {
  places: string[];
  visitPlaces: VisitPlace[];
  labelsForLevel: (level: VisitAdminLevel) => string[];
  isResolving: boolean;
} {
  const [visitPlaces, setVisitPlaces] = useState<VisitPlace[]>([]);
  const [isResolving, setIsResolving] = useState(false);

  const photosKey = photos
    .map((p) => `${p.assetId}:${p.lat.toFixed(3)},${p.lng.toFixed(3)}`)
    .join('|');

  useEffect(() => {
    let cancelled = false;

    if (photos.length === 0) {
      setVisitPlaces([]);
      setIsResolving(false);
      return;
    }

    setIsResolving(true);
    // Settle before geocoding: dragging the time slider changes the photo set
    // on every frame, and each resolve awaits a permission check per call.
    const timer = setTimeout(() => {
      void resolveVisitPlaces(photos).then((next) => {
        if (!cancelled) {
          setVisitPlaces(next);
          setIsResolving(false);
        }
      });
    }, RESOLVE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by photosKey
  }, [photosKey]);

  const places = useMemo(
    () => visitPlaces.map((p) => p.label),
    [visitPlaces],
  );

  const labelsForLevel = useMemo(
    () => (level: VisitAdminLevel) => labelsForVisitLevel(visitPlaces, level),
    [visitPlaces],
  );

  return { places, visitPlaces, labelsForLevel, isResolving };
}
