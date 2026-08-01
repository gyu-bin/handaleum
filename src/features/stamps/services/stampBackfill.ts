import { loadAllLocatedPhotos } from '@/features/photos/services/mediaLibrary';
import type { MonthKey } from '@/features/photos/types';
import { currentMonthKey } from '@/features/photos/utils/month';
import { resolveVisitPlaces } from '@/features/photos/utils/placeJourney';

import { notifyStampsChanged } from '../hooks/useStamps';
import {
  isStampsBackfillDone,
  markAllStampsSeen,
  markStampsBackfillDone,
  syncStampsFromVisits,
} from './stampsStorage';

export type StampBackfillResult = {
  added: number;
  skipped: boolean;
};

/**
 * One-shot: all GPS photos → bucketed parallel geocode → silent stamp sync.
 * Cache-first photo load; geocode concurrency capped in resolveVisitPlaces.
 */
export async function runStampBackfill(
  month: MonthKey = currentMonthKey(),
): Promise<StampBackfillResult> {
  if (isStampsBackfillDone()) {
    return { added: 0, skipped: true };
  }

  let totalAdded = 0;

  const photos = await loadAllLocatedPhotos({
    onPartial: (partial) => {
      void resolveVisitPlaces(partial).then((places) => {
        if (isStampsBackfillDone()) {
          return;
        }
        const result = syncStampsFromVisits(places, { month, silent: true });
        if (result.added.length > 0 || result.pruned.length > 0) {
          totalAdded += result.added.length;
          notifyStampsChanged();
        }
      });
    },
  });

  if (!isStampsBackfillDone()) {
    const places = await resolveVisitPlaces(photos);
    const result = syncStampsFromVisits(places, { month, silent: true });
    totalAdded += result.added.length;
  }

  markAllStampsSeen();
  markStampsBackfillDone();
  notifyStampsChanged();

  return { added: totalAdded, skipped: false };
}
