import { isDevDummyPhotosEnabled } from '@/features/photos/services/dummyPhotos';
import { loadAllLocatedPhotos, setFullAlbumScanBusy } from '@/features/photos/services/mediaLibrary';
import type { PhotoRef, VisitPlace } from '@/features/photos/types';
import { currentMonthKey } from '@/features/photos/utils/month';
import { collectBuckets } from '@/features/photos/utils/visitPlaceBuild';
import {
  getStampsLibrarySyncAt,
  setStampsCoarseGeocodeAt,
  setStampsGpsScanAt,
} from '@/lib/storage';

import { notifyStampsChanged } from '../hooks/useStamps';
import { lookupDong } from './dongLookup';
import { isKoreaLatLng } from './koreaBounds';
import {
  readLocatedPhotosSnapshot,
  writeLocatedPhotosSnapshot,
} from './locatedPhotosSnapshot';
import { resetStampDongPhotoIndex, prebuildStampDongPhotoIndex } from './stampDongPhotos';
import {
  countCollected,
  clearAllStamps,
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
/** Slightly longer yield so map gestures stay ahead of album GPS. */
const LIBRARY_GPS_YIELD_MS = 40;
/** Cap pin-export wait — infinite wait made the map feel stuck while baking. */
const LIBRARY_PIN_YIELD_MAX_MS = 2500;
/** Local PIP buckets per UI tick — no network, so larger than geocode chunks. */
const DONG_MATCH_CHUNK = 128;
const DONG_MATCH_YIELD_MS = 8;
/** How often to re-check assets previously cached as no-GPS (iCloud etc.). */
const DEEP_RECHECK_MS = 7 * 24 * 60 * 60 * 1000;

export type SyncStampsFromLibraryOptions = {
  /**
   * Skip MediaLibrary GPS when a recent snapshot exists (killed mid-match
   * or parse-rev redo). Falls back to a silent album walk if missing.
   */
  resumeGeocodeOnly?: boolean;
};

/**
 * Lifetime accumulate from **all** GPS photos (every year).
 * __DEV__ sample mode uses dummy hubs instead of the real album.
 *
 * Phase 1: MediaLibrary GPS (or dummy).
 * Phase 2: offline dong PIP (`dongs.json`) — no CLGeocoder / location permission.
 */
export async function syncStampsFromLibrary(
  options?: SyncStampsFromLibraryOptions,
): Promise<StampLibrarySyncResult> {
  const wasEmpty = countCollected(readStampsCollected()) === 0;
  const fallbackMonth = currentMonthKey();
  const silent = wasEmpty;
  const resumeGeocodeOnly = options?.resumeGeocodeOnly === true;
  /** Sample set is the album in __DEV__ when Settings sample is on. */
  const forceRealLibrary = !isDevDummyPhotosEnabled();

  const lastSync = getStampsLibrarySyncAt();
  const deepRecheck =
    !resumeGeocodeOnly &&
    forceRealLibrary &&
    lastSync > 0 &&
    Date.now() - lastSync >= DEEP_RECHECK_MS;

  const startedAt = Date.now();
  let photos: PhotoRef[] = [];

  if (resumeGeocodeOnly) {
    const snap = await readLocatedPhotosSnapshot();
    if (snap && snap.length > 0) {
      photos = snap;
      console.warn(
        '[stamps] resume dong match from GPS snapshot',
        photos.length,
        'photos',
      );
    } else {
      console.warn('[stamps] resume requested but no snapshot — silent GPS');
      setProgress(
        {
          phase: 'geocode',
          assetTotal: 0,
          assetScanned: 0,
          photoCount: 0,
          chunkDone: 0,
          chunkTotal: 0,
          startedAt,
        },
        true,
      );
      photos = await loadAllLocatedPhotos({
        forceRealLibrary,
        locationBatchSize: LIBRARY_GPS_BATCH,
        batchYieldMs: LIBRARY_GPS_YIELD_MS,
        yieldToPinExports: true,
        pinExportYieldMaxMs: LIBRARY_PIN_YIELD_MAX_MS,
        retryFailedLocations: false,
        networkLocationFallback: false,
        recheckCachedNoLocation: false,
      });
      setStampsGpsScanAt(Date.now());
      await writeLocatedPhotosSnapshot(photos);
      resetStampDongPhotoIndex();
    }
  } else {
    setProgress(
      {
        phase: 'gps',
        assetTotal: 0,
        assetScanned: 0,
        photoCount: 0,
        chunkDone: 0,
        chunkTotal: 0,
        startedAt,
      },
      true,
    );

    photos = await loadAllLocatedPhotos({
      forceRealLibrary,
      locationBatchSize: LIBRARY_GPS_BATCH,
      batchYieldMs: LIBRARY_GPS_YIELD_MS,
      yieldToPinExports: true,
      pinExportYieldMaxMs: LIBRARY_PIN_YIELD_MAX_MS,
      retryFailedLocations: false,
      networkLocationFallback: deepRecheck,
      recheckCachedNoLocation: deepRecheck,
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

    setStampsGpsScanAt(Date.now());
    await writeLocatedPhotosSnapshot(photos);
    resetStampDongPhotoIndex();

    console.warn(
      '[stamps] library GPS scan done',
      photos.length,
      'photos — matching dongs locally',
      deepRecheck ? '(deep)' : '(incremental)',
    );
  }

  // Dong PIP does not touch MediaLibrary — free month warmup / pin exports.
  setFullAlbumScanBusy(false);

  // Sample album replaces collected stamps so 발도장 matches the map hubs.
  let silentSync = silent;
  if (!forceRealLibrary) {
    clearAllStamps();
    notifyStampsChanged();
    silentSync = true;
  }

  const domestic = photos.filter((p) => isKoreaLatLng(p.lat, p.lng));
  const buckets = collectBuckets(domestic);
  const placeTotal = buckets.length;

  setProgress(
    {
      ...progress,
      phase: 'geocode',
      photoCount: photos.length,
      assetScanned: progress.assetTotal || progress.assetScanned,
      chunkDone: 0,
      chunkTotal: placeTotal,
      startedAt,
    },
    true,
  );

  let totalAdded = 0;
  let lastNotifyAt = 0;
  let batch: VisitPlace[] = [];

  console.warn(
    '[stamps] local dong PIP',
    placeTotal,
    'buckets (from',
    domestic.length,
    'domestic photos)',
  );

  for (let i = 0; i < buckets.length; i += 1) {
    const bucket = buckets[i]!;
    const hit = lookupDong(bucket.lat, bucket.lng);
    if (hit) {
      batch.push({
        key: bucket.key,
        label: `${hit.city} ${hit.name}`,
        level: 'dong',
        province: hit.sido,
        city: hit.city,
        dong: hit.name,
        firstTakenAt: bucket.firstTakenAt,
      });
    }

    const done = i + 1;
    const flush =
      batch.length >= DONG_MATCH_CHUNK || done === placeTotal || done % DONG_MATCH_CHUNK === 0;

    if (flush) {
      if (batch.length > 0) {
        const result = syncStampsFromVisits(batch, {
          month: fallbackMonth,
          silent: silentSync,
        });
        totalAdded += result.added.length;
        batch = [];
        const now = Date.now();
        if (result.added.length > 0 && now - lastNotifyAt > 2000) {
          notifyStampsChanged();
          lastNotifyAt = now;
        }
      }
      setProgress(
        {
          ...progress,
          phase: 'geocode',
          chunkDone: done,
          chunkTotal: placeTotal,
        },
        true,
      );
      if (done < placeTotal) {
        await new Promise((r) => setTimeout(r, DONG_MATCH_YIELD_MS));
      }
    }
  }

  // Mark coarse checkpoint so older resume helpers stay coherent.
  setStampsCoarseGeocodeAt(Date.now());

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

  // Popup leaves should not rebuild PIP on first open.
  await prebuildStampDongPhotoIndex(photos);

  setProgress(
    {
      ...progress,
      phase: 'done',
      photoCount: photos.length,
      chunkDone: placeTotal,
      chunkTotal: placeTotal,
    },
    true,
  );

  return { added: totalAdded, photoCount: photos.length };
}

/** Reset banner state after the runner tears down syncing. */
export function resetStampLibraryProgress(): void {
  setProgress(IDLE_PROGRESS, true);
}
