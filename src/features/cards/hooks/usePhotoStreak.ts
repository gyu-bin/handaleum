import { useEffect, useSyncExternalStore } from 'react';

import type { MonthKey, PhotoRef } from '@/features/photos/types';
import {
  collectStreakDays,
  computePhotoStreak,
  dayKeyFromDate,
  dayKeysFromPhotos,
  photoStreakView,
  type PhotoStreak,
} from '@/features/photos/utils/photoStreak';
import { isDummyAssetId } from '@/features/photos/services/dummyPhotos';
import {
  ensurePhotoStreakEpoch,
  getPhotoStreakVersion,
  readPhotoStreakDays,
  recordPhotoStreakMonth,
  subscribePhotoStreak,
} from '@/features/photos/services/photoStreakStore';

export function usePhotoStreak(
  month: MonthKey,
  photos: PhotoRef[],
): PhotoStreak | null {
  useSyncExternalStore(
    subscribePhotoStreak,
    getPhotoStreakVersion,
    getPhotoStreakVersion,
  );

  useEffect(() => {
    recordPhotoStreakMonth(month, photos);
  }, [month, photos]);

  const today = dayKeyFromDate(new Date());
  const liveDays = dayKeysFromPhotos(photos);
  const dummyPreview = photos.some((photo) => isDummyAssetId(photo.assetId));
  const epoch = dummyPreview
    ? (liveDays[0] ?? ensurePhotoStreakEpoch())
    : ensurePhotoStreakEpoch();
  const days = collectStreakDays(
    readPhotoStreakDays(),
    month,
    liveDays,
    epoch,
    today,
  );
  const { current, best } = computePhotoStreak(days, today);
  return photoStreakView(current, best);
}
