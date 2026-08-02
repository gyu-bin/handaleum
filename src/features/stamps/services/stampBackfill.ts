import * as Location from 'expo-location';

import { loadAllLocatedPhotos } from '@/features/photos/services/mediaLibrary';
import type { PhotoRef } from '@/features/photos/types';
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
  photoCount: number;
};

/** Slightly larger than map month loads — full album can be tens of thousands. */
const LIBRARY_GPS_BATCH = 16;

async function ensureGeocodePermission(): Promise<boolean> {
  try {
    const current = await Location.getForegroundPermissionsAsync();
    if (current.status === 'granted') {
      return true;
    }
    const requested = await Location.requestForegroundPermissionsAsync();
    return requested.status === 'granted';
  } catch (error) {
    console.warn('[stamps] location permission for geocode failed', error);
    return false;
  }
}

async function ingestPlaces(
  photos: PhotoRef[],
  fallbackMonth: ReturnType<typeof currentMonthKey>,
): Promise<number> {
  if (photos.length === 0) {
    return 0;
  }
  const places = await resolveVisitPlaces(photos);
  if (places.length === 0) {
    return 0;
  }
  const result = syncStampsFromVisits(places, {
    month: fallbackMonth,
    silent: true,
  });
  if (result.added.length > 0 || result.pruned.length > 0) {
    notifyStampsChanged();
  }
  return result.added.length;
}

/**
 * Lifetime accumulate from all GPS photos in the real album.
 * Always silent — no earn popup / tab badge from bulk scan.
 * New-visit popups come from map month sync (useStampSync) only.
 *
 * Progressive: as GPS batches resolve, places are geocoded and written so the
 * stamp grid fills while the rest of the library is still scanning.
 * Ends with a full pass over every located photo (cache hits = cheap).
 */
export async function syncStampsFromLibrary(): Promise<StampLibrarySyncResult> {
  const wasEmpty = countCollected(readStampsCollected()) === 0;
  const fallbackMonth = currentMonthKey();

  if (!(await ensureGeocodePermission())) {
    console.warn('[stamps] library sync skipped — location permission denied');
    return { added: 0, photoCount: 0 };
  }

  let totalAdded = 0;
  let consumed = 0;

  const ingestDelta = async (photos: PhotoRef[]) => {
    if (photos.length <= consumed) {
      return;
    }
    const slice = photos.slice(consumed);
    consumed = photos.length;
    totalAdded += await ingestPlaces(slice, fallbackMonth);
  };

  const photos = await loadAllLocatedPhotos({
    forceRealLibrary: true,
    locationBatchSize: LIBRARY_GPS_BATCH,
    retryFailedLocations: true,
    onPartial: ingestDelta,
  });

  // Final full pass — retries geocode misses from progressive phase.
  totalAdded += await ingestPlaces(photos, fallbackMonth);

  if (wasEmpty) {
    markAllStampsSeen();
    notifyStampsChanged();
  }

  return { added: totalAdded, photoCount: photos.length };
}
