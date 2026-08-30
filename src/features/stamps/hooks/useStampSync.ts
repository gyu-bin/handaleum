import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';

import type { MonthKey, PhotoRef, VisitPlace } from '@/features/photos/types';
import { currentMonthKey } from '@/features/photos/utils/month';
import { collectBuckets } from '@/features/photos/utils/visitPlaceBuild';
import { getStampsLibrarySyncAt } from '@/lib/storage';

import { lookupDong } from '../services/dongLookup';
import { isKoreaLatLng } from '../services/koreaBounds';
import { mergeMonthPhotosIntoDongIndex } from '../services/stampDongPhotos';
import {
  isStampLibrarySyncing,
  subscribeStampLibrarySync,
} from '../services/stampLibrarySyncRunner';
import { syncStampsFromVisits } from '../services/stampsStorage';
import { notifyStampsChanged } from './useStamps';

export type UseStampSyncOptions = {
  /** False while the month GPS pass is still in flight. */
  enabled?: boolean;
};

function dongVisitsFromPhotos(photos: PhotoRef[]): VisitPlace[] {
  const domestic = photos.filter((photo) =>
    isKoreaLatLng(photo.lat, photo.lng),
  );
  const visits: VisitPlace[] = [];
  for (const bucket of collectBuckets(domestic)) {
    const hit = lookupDong(bucket.lat, bucket.lng);
    if (!hit) {
      continue;
    }
    visits.push({
      key: bucket.key,
      label: `${hit.city} ${hit.name}`,
      level: 'dong',
      province: hit.sido,
      city: hit.city,
      dong: hit.name,
      firstTakenAt: bucket.firstTakenAt,
    });
  }
  return visits;
}

/**
 * After the home map loads this month's photos, mint stamps for any new 동.
 *
 * Full-album sync is on a 6h cooldown / 7-day snapshot, so a photo taken today
 * in a new 동 would otherwise wait. Restricted to the **current month** so
 * opening an older month cannot accrue stamps (2026-08-02). Unseen ids feed
 * the nav red dot and the 발도장 earn overlay — both already subscribe.
 */
export function useStampSync(
  month: MonthKey,
  photos: PhotoRef[] | undefined,
  options?: UseStampSyncOptions,
): void {
  const enabled = options?.enabled ?? true;
  const [librarySyncing, setLibrarySyncing] = useState(isStampLibrarySyncing);

  useEffect(() => subscribeStampLibrarySync(setLibrarySyncing), []);

  useEffect(() => {
    if (!enabled || !photos || photos.length === 0) {
      return;
    }
    if (month !== currentMonthKey()) {
      return;
    }
    // First full pass marks its haul seen; running first would flag old 동 NEW.
    if (getStampsLibrarySyncAt() === 0) {
      return;
    }
    if (librarySyncing) {
      return;
    }

    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled || isStampLibrarySyncing()) {
        return;
      }
      void (async () => {
        try {
          // Index first so NEW / overlay cannot open an empty 동 popup.
          await mergeMonthPhotosIntoDongIndex(photos);
          if (cancelled) {
            return;
          }
          const visits = dongVisitsFromPhotos(photos);
          if (visits.length === 0) {
            return;
          }
          const { added } = syncStampsFromVisits(visits, { month });
          if (added.length > 0) {
            notifyStampsChanged();
          }
        } catch (error) {
          console.warn('[stamps] live sync failed', error);
        }
      })();
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [enabled, librarySyncing, month, photos]);
}
