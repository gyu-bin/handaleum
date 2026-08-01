import { useEffect, useRef, useState } from 'react';

import { strings } from '@/shared/constants/strings';

import type { PhotoRef } from '../../photos/types';
import {
  groupPhotosByJourneyPlace,
  type PlacePhotoSection,
} from '../../photos/utils/placeJourney';

export type PickerSortMode = 'newest' | 'oldest' | 'place';

/**
 * Resolve journey-place sections for the card photo picker.
 * Idle when sort mode is time-based — callers use a flat list instead.
 */
export function usePhotoPlaceSections(
  photos: PhotoRef[],
  enabled: boolean,
): {
  sections: PlacePhotoSection[];
  isLoading: boolean;
} {
  const [sections, setSections] = useState<PlacePhotoSection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  const photosKey = photos.map((p) => p.assetId).join('|');

  useEffect(() => {
    if (!enabled) {
      setSections([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    const snapshot = photosRef.current;

    void groupPhotosByJourneyPlace(snapshot, strings.cards.placeUnknown).then(
      (next) => {
        if (!cancelled) {
          setSections(next);
          setIsLoading(false);
        }
      },
      (error) => {
        console.error('groupPhotosByJourneyPlace failed', error);
        if (!cancelled) {
          setSections([
            {
              title: strings.cards.placeUnknown,
              data: [...snapshot].sort((a, b) =>
                b.takenAt.localeCompare(a.takenAt),
              ),
            },
          ]);
          setIsLoading(false);
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [enabled, photosKey]);

  return { sections, isLoading };
}
