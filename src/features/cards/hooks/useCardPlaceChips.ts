import { useEffect, useState } from 'react';

import type { PhotoRef } from '@/features/photos/types';
import {
  peekResolvedPlace,
  resolvePlace,
} from '@/features/photos/services/placeResolve';

import { cardPhotoPlaceChip } from '../utils/cardPlaceChip';

export async function placeChipsForPhotos(
  photos: PhotoRef[],
): Promise<string[]> {
  const labels: string[] = [];
  for (const photo of photos) {
    const place =
      peekResolvedPlace(photo.lat, photo.lng) ??
      (await resolvePlace(photo.lat, photo.lng));
    labels.push(place ? (cardPhotoPlaceChip(place) ?? '') : '');
  }
  return labels;
}

/** assetId → short 구/시 chip. Empty string omitted by callers. */
export function useCardPlaceChips(
  photos: PhotoRef[],
): Record<string, string> {
  const [labels, setLabels] = useState<Record<string, string>>({});
  const key = photos.map((p) => `${p.assetId}:${p.lat}:${p.lng}`).join('|');

  useEffect(() => {
    if (photos.length === 0) {
      setLabels({});
      return;
    }
    let cancelled = false;
    void placeChipsForPhotos(photos).then((chips) => {
      if (cancelled) {
        return;
      }
      const next: Record<string, string> = {};
      photos.forEach((photo, i) => {
        const chip = chips[i];
        if (chip) {
          next[photo.assetId] = chip;
        }
      });
      setLabels(next);
    });
    return () => {
      cancelled = true;
    };
    // photos identity is captured via key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return labels;
}
