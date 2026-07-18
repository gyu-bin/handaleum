import { useEffect, useMemo, useState } from 'react';

import type { PhotoRef, VisitAdminLevel, VisitPlace } from '../types';
import {
  labelsForVisitLevel,
  resolveVisitPlaces,
} from '../utils/placeJourney';

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
    void resolveVisitPlaces(photos).then((next) => {
      if (!cancelled) {
        setVisitPlaces(next);
        setIsResolving(false);
      }
    });

    return () => {
      cancelled = true;
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
