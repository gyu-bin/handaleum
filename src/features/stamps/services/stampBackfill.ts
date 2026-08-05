import * as Location from 'expo-location';

import {
  isAppForeground,
  waitForAppForeground,
} from '@/features/photos/services/appForeground';
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

export type StampLibraryProgress = {
  phase: 'idle' | 'gps' | 'geocode' | 'done';
  /** Album assets total (GPS phase). */
  assetTotal: number;
  assetScanned: number;
  /** Photos with GPS so far / after GPS phase. */
  photoCount: number;
  chunkDone: number;
  chunkTotal: number;
  startedAt: number;
};

/** @deprecated Prefer StampLibraryProgress — kept for settings diag. */
export type StampScanDebug = StampLibraryProgress;

const IDLE_PROGRESS: StampLibraryProgress = {
  phase: 'idle',
  assetTotal: 0,
  assetScanned: 0,
  photoCount: 0,
  chunkDone: 0,
  chunkTotal: 0,
  startedAt: 0,
};

let progress: StampLibraryProgress = IDLE_PROGRESS;
type ProgressListener = (next: StampLibraryProgress) => void;
const progressListeners = new Set<ProgressListener>();

function emitProgress(): void {
  for (const listener of progressListeners) {
    listener(progress);
  }
}

let lastProgressEmitAt = 0;
/** Keep GPS count ticks visible — batches are small now. */
const PROGRESS_EMIT_MIN_MS = 32;

function setProgress(next: StampLibraryProgress, force = false): void {
  const scannedChanged = next.assetScanned !== progress.assetScanned;
  progress = next;
  const now = Date.now();
  // Always surface count ticks; only throttle identical GPS snapshots.
  if (
    !force &&
    next.phase === 'gps' &&
    !scannedChanged &&
    now - lastProgressEmitAt < PROGRESS_EMIT_MIN_MS
  ) {
    return;
  }
  lastProgressEmitAt = now;
  emitProgress();
}

export function getStampLibraryProgress(): StampLibraryProgress {
  return progress;
}

export function subscribeStampLibraryProgress(
  listener: ProgressListener,
): () => void {
  progressListeners.add(listener);
  listener(progress);
  return () => {
    progressListeners.delete(listener);
  };
}

/** Live full-album scan state for the settings diagnostics panel. */
export function getStampScanDebug(): StampScanDebug {
  return progress;
}

/**
 * Full-album GPS batch via AssetLocations native (PHAsset.location).
 * Keep modest: Android still opens EXIF per id; huge bursts jump the
 * banner by hundreds and can jetsam while the map is open.
 */
const LIBRARY_GPS_BATCH = 32;
/** Yield between batches so the banner paints and the OS can reclaim. */
const LIBRARY_GPS_YIELD_MS = 24;
/** Geocode / stamp write chunks so the grid fills while the rest runs. */
const GEOCODE_PHOTO_CHUNK = 500;
/** Short yield — keep UI alive without stalling the scan. */
const GEOCODE_CHUNK_YIELD_MS = 16;
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
  // Defer UI notify — chunked geocode used to rebuild the stamp snapshot on
  // every batch and re-render anything subscribed (map screen before badge move).
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

  const lastSync = getStampsLibrarySyncAt();
  // Weekly iCloud recheck only — never on first fill. First open must stay
  // local-metadata-fast. wasEmpty||lastSync===0 used to force
  // network downloads and capped scan at ~tens of assets/sec.
  const deepRecheck =
    lastSync > 0 && Date.now() - lastSync >= DEEP_RECHECK_MS;

  setProgress(
    {
      phase: 'gps',
      assetTotal: 0,
      assetScanned: 0,
      photoCount: 0,
      chunkDone: 0,
      chunkTotal: 0,
      startedAt: Date.now(),
    },
    true,
  );

  // Phase 1 — MediaLibrary GPS only (no Location permission needed).
  // Stream pages so we don't wait to list 전체 앨범 before reading EXIF.
  const photos = await loadAllLocatedPhotos({
    forceRealLibrary: true,
    locationBatchSize: LIBRARY_GPS_BATCH,
    batchYieldMs: LIBRARY_GPS_YIELD_MS,
    // Pause GPS batches while map pins decode — concurrent ImageManipulator
    // + MediaLibrary is the usual iOS jetsam on home.
    yieldToPinExports: true,
    pinExportYieldMaxMs: Number.POSITIVE_INFINITY,
    retryFailedLocations: false,
    networkLocationFallback: deepRecheck,
    recheckCachedNoLocation: deepRecheck,
    shouldContinue: isAppForeground,
    onScanProgress: (scan) => {
      setProgress({
        ...progress,
        phase: 'gps',
        assetTotal: scan.assetTotal,
        assetScanned: scan.assetScanned,
        photoCount: scan.locatedCount,
      });
    },
  });

  console.warn(
    '[stamps] library GPS scan done',
    photos.length,
    'photos — geocoding places',
    deepRecheck ? '(deep)' : '(incremental)',
  );

  // Location permission only for reverse-geocode (동 이름).
  if (!(await ensureGeocodePermission())) {
    console.warn('[stamps] geocode skipped — location permission denied');
    setProgress({ ...progress, phase: 'done', photoCount: photos.length }, true);
    return { added: 0, photoCount: photos.length };
  }

  // Phase 2 — places → stamps for the entire set (month picker never stamps).
  const chunkTotal = Math.max(1, Math.ceil(photos.length / GEOCODE_PHOTO_CHUNK));
  setProgress(
    {
      ...progress,
      phase: 'geocode',
      photoCount: photos.length,
      assetScanned: progress.assetTotal || progress.assetScanned,
      chunkDone: 0,
      chunkTotal: photos.length === 0 ? 0 : chunkTotal,
    },
    true,
  );
  let totalAdded = 0;
  let lastNotifyAt = 0;
  for (let i = 0; i < photos.length; i += GEOCODE_PHOTO_CHUNK) {
    await waitForAppForeground();
    const chunk = photos.slice(i, i + GEOCODE_PHOTO_CHUNK);
    const added = await ingestPlaces(chunk, fallbackMonth, silent);
    totalAdded += added;
    setProgress(
      {
        ...progress,
        chunkDone: progress.chunkDone + 1,
      },
      true,
    );
    const now = Date.now();
    if (added > 0 && now - lastNotifyAt > 2000) {
      notifyStampsChanged();
      lastNotifyAt = now;
    }
    if (i + GEOCODE_PHOTO_CHUNK < photos.length) {
      await new Promise((r) => setTimeout(r, GEOCODE_CHUNK_YIELD_MS));
    }
  }

  if (wasEmpty) {
    markAllStampsSeen();
  }
  if (totalAdded > 0 || wasEmpty) {
    notifyStampsChanged();
  }

  console.warn(
    '[stamps] library sync done',
    'photos=',
    photos.length,
    'added=',
    totalAdded,
  );

  setProgress({ ...progress, phase: 'done' }, true);
  return { added: totalAdded, photoCount: photos.length };
}

/** Reset banner state after the runner tears down syncing. */
export function resetStampLibraryProgress(): void {
  setProgress(IDLE_PROGRESS, true);
}
