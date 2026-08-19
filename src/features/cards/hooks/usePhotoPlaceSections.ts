import { useEffect, useRef, useState } from 'react';

import { strings } from '@/shared/constants/strings';

import type { PhotoRef } from '../../photos/types';
import {
  groupPhotosByJourneyPlace,
  type PlaceGroupProgress,
  type PlacePhotoSection,
} from '../../photos/utils/placeJourney';

export type PickerSortMode = 'newest' | 'oldest' | 'place';

function photosFingerprint(photos: PhotoRef[]): string {
  const n = photos.length;
  if (n === 0) {
    return '0';
  }
  const first = photos[0]!;
  const last = photos[n - 1]!;
  return `${n}:${first.assetId}:${last.assetId}:${first.takenAt}:${last.takenAt}`;
}

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
  progress: PlaceGroupProgress | null;
} {
  const [sections, setSections] = useState<PlacePhotoSection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<PlaceGroupProgress | null>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  const photosKey = photosFingerprint(photos);

  useEffect(() => {
    if (!enabled) {
      setSections([]);
      setIsLoading(false);
      setProgress(null);
      return;
    }

    let cancelled = false;
    const signal = { cancelled: false };
    const snapshot = photosRef.current;
    setIsLoading(true);

    void groupPhotosByJourneyPlace(snapshot, strings.cards.placeUnknown, {
      signal,
      onProgress: (next, nextProgress) => {
        if (cancelled) {
          return;
        }
        setSections(next);
        setProgress(nextProgress);
      },
    }).then(
      (next) => {
        if (!cancelled) {
          setSections(next);
          setIsLoading(false);
          setProgress(null);
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
          setProgress(null);
        }
      },
    );

    return () => {
      cancelled = true;
      signal.cancelled = true;
    };
  }, [enabled, photosKey]);

  return { sections, isLoading, progress };
}
