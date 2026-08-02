import { loadAllLocatedPhotos } from '@/features/photos/services/mediaLibrary';
import { currentMonthKey } from '@/features/photos/utils/month';
import { resolveVisitPlaces } from '@/features/photos/utils/placeJourney';

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

/**
 * Lifetime accumulate from all GPS photos.
 * Always silent — no earn popup / tab badge from bulk scan.
 * New-visit popups come from map month sync (useStampSync) only.
 */
export async function syncStampsFromLibrary(): Promise<StampLibrarySyncResult> {
  const wasEmpty = countCollected(readStampsCollected()) === 0;
  const fallbackMonth = currentMonthKey();

  const photos = await loadAllLocatedPhotos();
  if (photos.length === 0) {
    return { added: 0 };
  }

  const places = await resolveVisitPlaces(photos);
  const result = syncStampsFromVisits(places, {
    month: fallbackMonth,
    silent: true,
  });

  if (result.added.length > 0 || result.pruned.length > 0) {
    notifyStampsChanged();
  }

  // Historical fill should not leave a badge / popup backlog.
  if (wasEmpty) {
    markAllStampsSeen();
    notifyStampsChanged();
  }

  return { added: result.added.length };
}
