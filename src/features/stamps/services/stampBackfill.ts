import * as Location from 'expo-location';

import { loadAllLocatedPhotos } from '@/features/photos/services/mediaLibrary';
import type { PhotoRef } from '@/features/photos/types';
import { currentMonthKey } from '@/features/photos/utils/month';
import { resolveVisitPlaces } from '@/features/photos/services/placeResolve';
import { getStampsLibrarySyncAt } from '@/lib/storage';

import { notifyStampsChanged } from '../hooks/useStamps';
import { isKoreaLatLng } from './koreaBounds';
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

/** GPS-only phase — keep batches modest to avoid jetsam. */
const LIBRARY_GPS_BATCH = 24;
/** Geocode / stamp write chunks so the grid fills while the rest runs. */
const GEOCODE_PHOTO_CHUNK = 400;
/** How often to re-check assets previously cached as no-GPS (iCloud etc.). */
const DEEP_RECHECK_MS = 7 * 24 * 60 * 60 * 1000;

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
  silent: boolean,
): Promise<number> {
  // Domestic only — skip overseas GPS before reverse-geocode.
  const domestic = photos.filter((p) => isKoreaLatLng(p.lat, p.lng));
  if (domestic.length === 0) {
    return 0;
  }
  // Background lane — the month view's chips always geocode first.
  const places = await resolveVisitPlaces(domestic, { priority: 'background' });
  if (places.length === 0) {
    return 0;
  }
  const result = syncStampsFromVisits(places, {
    month: fallbackMonth,
    silent,
  });
  if (result.added.length > 0 || result.pruned.length > 0) {
    notifyStampsChanged();
  }
  return result.added.length;
}

/**
 * Lifetime accumulate from **all** GPS photos in the real album (every year),
 * not the month currently open on the map.
 *
 * Phase 1: scan MediaLibrary GPS as fast as possible (no reverse-geocode waits).
 * Phase 2: geocode unique places in chunks and write stamps.
 *
 * Always silent — earn popups come from map month sync only.
 */
export async function syncStampsFromLibrary(): Promise<StampLibrarySyncResult> {
  const wasEmpty = countCollected(readStampsCollected()) === 0;
  const fallbackMonth = currentMonthKey();
  // First fill: silent (no earn spam). Later runs: unseen for truly new places.
  const silent = wasEmpty;

  if (!(await ensureGeocodePermission())) {
    console.warn('[stamps] library sync skipped — location permission denied');
    return { added: 0, photoCount: 0 };
  }

  const lastSync = getStampsLibrarySyncAt();
  const deepRecheck =
    wasEmpty || lastSync === 0 || Date.now() - lastSync >= DEEP_RECHECK_MS;

  // Phase 1 — every album photo with GPS (all years). Geocode only after.
  // Deep recheck (iCloud / prior no-GPS) is weekly — every visit would take hours.
  const photos = await loadAllLocatedPhotos({
    forceRealLibrary: true,
    locationBatchSize: LIBRARY_GPS_BATCH,
    retryFailedLocations: true,
    networkLocationFallback: deepRecheck,
    recheckCachedNoLocation: deepRecheck,
  });

  console.warn(
    '[stamps] library GPS scan done',
    photos.length,
    'photos — geocoding places',
    deepRecheck ? '(deep)' : '(incremental)',
  );

  // Phase 2 — places → stamps for the entire set (month picker never stamps).
  let totalAdded = 0;
  for (let i = 0; i < photos.length; i += GEOCODE_PHOTO_CHUNK) {
    const chunk = photos.slice(i, i + GEOCODE_PHOTO_CHUNK);
    totalAdded += await ingestPlaces(chunk, fallbackMonth, silent);
  }

  if (wasEmpty) {
    markAllStampsSeen();
    notifyStampsChanged();
  }

  console.warn(
    '[stamps] library sync done',
    'photos=',
    photos.length,
    'added=',
    totalAdded,
  );

  return { added: totalAdded, photoCount: photos.length };
}
