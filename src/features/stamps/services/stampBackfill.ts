import { loadAllLocatedPhotos } from '@/features/photos/services/mediaLibrary';
import { currentMonthKey } from '@/features/photos/utils/month';
import { resolveVisitPlaces } from '@/features/photos/utils/placeJourney';
import type { PhotoRef } from '@/features/photos/types';

import { notifyStampsChanged } from '../hooks/useStamps';
import {
  countCollected,
  markAllStampsSeen,
  readStampsCollected,
  syncStampsFromVisits,
} from './stampsStorage';

export type StampLibrarySyncResult = {
  added: number;
};

/** Slightly larger than map month loads — full album can be tens of thousands. */
const LIBRARY_GPS_BATCH = 16;

/**
 * Lifetime accumulate from all GPS photos in the real album.
 * Always silent — no earn popup / tab badge from bulk scan.
 * New-visit popups come from map month sync (useStampSync) only.
 *
 * Progressive: as GPS batches resolve, places are geocoded and written so the
 * stamp grid fills while the rest of the library is still scanning.
 */
export async function syncStampsFromLibrary(): Promise<StampLibrarySyncResult> {
  const wasEmpty = countCollected(readStampsCollected()) === 0;
  const fallbackMonth = currentMonthKey();

  let totalAdded = 0;
  let consumed = 0;

  const ingestDelta = async (photos: PhotoRef[]) => {
    if (photos.length <= consumed) {
      return;
    }
    const slice = photos.slice(consumed);
    consumed = photos.length;
    const places = await resolveVisitPlaces(slice);
    if (places.length === 0) {
      return;
    }
    const result = syncStampsFromVisits(places, {
      month: fallbackMonth,
      silent: true,
    });
    if (result.added.length > 0 || result.pruned.length > 0) {
      totalAdded += result.added.length;
      notifyStampsChanged();
    }
  };

  const photos = await loadAllLocatedPhotos({
    forceRealLibrary: true,
    locationBatchSize: LIBRARY_GPS_BATCH,
    onPartial: ingestDelta,
  });

  // Final pass in case the last batch did not grow (or library was cache-only).
  await ingestDelta(photos);

  // Historical fill should not leave a badge / popup backlog.
  if (wasEmpty) {
    markAllStampsSeen();
    notifyStampsChanged();
  }

  return { added: totalAdded };
}
