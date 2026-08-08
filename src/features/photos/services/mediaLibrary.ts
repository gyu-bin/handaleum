import { Platform } from 'react-native';
import {
  getAssetInfoAsync,
  getAssetsAsync,
  MediaType,
  SortBy,
  type Asset,
} from 'expo-media-library';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { getAssetLocationsAsync } from 'asset-locations';

import { getAssetLocationRaw, setAssetLocationRaw } from '@/lib/storage';
import {
  createConcurrencyLimiter,
  lruSet,
} from '@/shared/utils/concurrency';

import type { MonthKey, MonthlyPhotos, MonthSummary, PhotoRef } from '../types';
import { monthBounds, monthKeyFromTimestamp } from '../utils/month';
import {
  buildDummyMonthSummaries,
  buildDummyMonthlyPhotos,
  dummyAssetImageUri,
  isDevDummyPhotosEnabled,
  isDummyAssetId,
  type DummyImageSize,
} from './dummyPhotos';
import { readPinThumbFromDisk, writePinThumbToDisk } from './pinThumbCache';

/**
 * Full-album stamp GPS scan in flight. Month warmup checks this so two
 * MediaLibrary scanners never overlap (main heat source on the map).
 */
let fullAlbumScanBusy = false;

export function setFullAlbumScanBusy(busy: boolean): void {
  fullAlbumScanBusy = busy;
}

export function isFullAlbumScanBusy(): boolean {
  return fullAlbumScanBusy;
}

/** Larger pages = fewer native round-trips when listing a month. */
const PAGE_SIZE = 200;
/** Full-album listing — keep pages modest so home stays responsive. */
const LIBRARY_PAGE_SIZE = 200;
/**
 * Parallel getAssetInfoAsync for uncached GPS. Keep low — large months used to
 * fan out 40 native reads and jetsam the process.
 */
const LOCATION_BATCH = 8;
/** Cap simultaneous ImageManipulator exports (map pin thumbs). */
const PIN_EXPORT_CONCURRENCY = 2;
/** Cap simultaneous Android URI lookups while scrolling grids. */
const ANDROID_URI_CONCURRENCY = 2;
/** Bound in-memory URI maps so multi-month sessions don't grow forever. */
const URI_CACHE_MAX = 400;
/** Pins + grid scroll backlog — warm file thumbs so remounts skip ph:// decode. */
const FILE_URI_CACHE_MAX = 360;
/** Idle grid warm — keep at 1 so scroll never competes with a manipulator storm. */
const GRID_THUMB_WARM_CONCURRENCY = 1;
const limitGridThumbWarm = createConcurrencyLimiter(GRID_THUMB_WARM_CONCURRENCY);
const gridThumbWarmQueued = new Set<string>();
/** While true, do not start new ImageManipulator thumbs (scroll / fling). */
let gridThumbWarmPaused = false;


const limitPinExport = createConcurrencyLimiter(PIN_EXPORT_CONCURRENCY);
const limitAndroidUri = createConcurrencyLimiter(ANDROID_URI_CONCURRENCY);

async function collectAssets(options: {
  createdAfter?: number;
  createdBefore?: number;
}): Promise<Asset[]> {
  const assets: Asset[] = [];
  let after: string | undefined;
  let hasNextPage = true;

  while (hasNextPage) {
    const page = await getAssetsAsync({
      first: PAGE_SIZE,
      after,
      createdAfter: options.createdAfter,
      createdBefore: options.createdBefore,
      mediaType: MediaType.photo,
      sortBy: [[SortBy.creationTime, false]],
    });
    assets.push(...page.assets);
    hasNextPage = page.hasNextPage;
    after = page.endCursor;
  }

  return assets;
}

function refFromCoords(asset: Asset, lat: number, lng: number): PhotoRef {
  return {
    assetId: asset.id,
    takenAt: new Date(asset.creationTime).toISOString(),
    lat,
    lng,
  };
}

/** Sync resolve from kv cache — no native call. */
function fromCache(asset: Asset): PhotoRef | 'no-location' | 'miss' {
  const cached = getAssetLocationRaw(asset.id);
  if (cached === 'x') {
    return 'no-location';
  }
  if (cached != null) {
    const [lat, lng] = cached.split(',').map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return refFromCoords(asset, lat!, lng!);
    }
  }
  return 'miss';
}

function coordsFromInfo(
  asset: Asset,
  info: { location?: { latitude: number; longitude: number } | null },
): PhotoRef | null {
  const location = info.location;
  const lat = location == null ? NaN : Number(location.latitude);
  const lng = location == null ? NaN : Number(location.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  setAssetLocationRaw(asset.id, `${lat},${lng}`);
  return refFromCoords(asset, lat, lng);
}

/**
 * Resolve GPS for one asset.
 * Default: local metadata only (map month loads — avoid iCloud download storms).
 * `networkFallback`: if local has no coords but asset is in iCloud, download once
 * (monthly soft-recheck + 발도장). Never download every no-GPS local asset —
 * that freezes the UI on screenshot-heavy months.
 */
async function fetchLocation(
  asset: Asset,
  options?: { networkFallback?: boolean },
): Promise<PhotoRef | 'no-location' | null> {
  try {
    const info = await getAssetInfoAsync(asset, {
      shouldDownloadFromNetwork: false,
    });
    const local = coordsFromInfo(asset, info);
    if (local) {
      return local;
    }

    if (options?.networkFallback && info.isNetworkAsset) {
      const remote = await getAssetInfoAsync(asset, {
        shouldDownloadFromNetwork: true,
      });
      const fromNetwork = coordsFromInfo(asset, remote);
      if (fromNetwork) {
        return fromNetwork;
      }
    } else if (info.isNetworkAsset && !options?.networkFallback) {
      return null; // leave uncached — stamp scan / retry can try again
    }

    setAssetLocationRaw(asset.id, 'x');
    return 'no-location';
  } catch (error) {
    console.error('getAssetInfoAsync failed', asset.id, error);
    return null; // transient failure — leave uncached so a retry can succeed
  }
}

export type LoadMonthlyPhotosOptions = {
  /** Called after the cache pass (if anything to show) and after each GPS batch. */
  onPartial?: (data: MonthlyPhotos) => void;
  /**
   * When false, pause between batches until true again.
   * Used so backgrounding the app stops MediaLibrary work; assetLoc still persists.
   */
  shouldContinue?: () => boolean;
};

function snapshot(
  month: MonthKey,
  photos: PhotoRef[],
  noLocationCount: number,
  sort: boolean,
): MonthlyPhotos {
  const list = sort
    ? [...photos].sort((a, b) => a.takenAt.localeCompare(b.takenAt))
    : [...photos];
  return { month, photos: list, noLocationCount };
}

/**
 * Pause until `shouldContinue` is true again (or forever if omitted = no gate).
 * Not just "app foreground" — callers also gate on album-scan busy so two
 * MediaLibrary owners never overlap.
 */
async function pauseWhileBackgrounded(shouldContinue?: () => boolean): Promise<void> {
  if (!shouldContinue) {
    return;
  }
  while (!shouldContinue()) {
    await new Promise((r) => setTimeout(r, 400));
  }
}

/** Min gap between progressive UI updates — avoids re-clustering every batch. */
const PARTIAL_MIN_MS = 1400;

/** Soft-retry assets once cached as no-GPS (iCloud metadata catch-up). */
const softRecheckedNoLoc = new Set<string>();
/** Unbounded soft-recheck of every "x" stalls month open on screenshot-heavy libraries. */
const SOFT_RECHECK_CAP = 120;
/** Yield to the UI between GPS batches so map gestures stay responsive. */
const BATCH_YIELD_MS = 64;

/**
 * Load all camera-roll photos for a month via expo-media-library.
 * Cached GPS hits resolve synchronously; only uncached assets pay getAssetInfoAsync.
 * Optional onPartial paints the map before every uncached asset is resolved.
 */
export async function loadMonthlyPhotos(
  month: MonthKey,
  options?: LoadMonthlyPhotosOptions,
): Promise<MonthlyPhotos> {
  if (isDevDummyPhotosEnabled()) {
    return buildDummyMonthlyPhotos(month);
  }

  const { onPartial, shouldContinue } = options ?? {};
  const { startMs, endMs } = monthBounds(month);
  const assets = await collectAssets({
    createdAfter: startMs,
    createdBefore: endMs,
  });

  const photos: PhotoRef[] = [];
  let noLocationCount = 0;
  const uncached: Asset[] = [];
  let softBudget = SOFT_RECHECK_CAP;

  for (const asset of assets) {
    const hit = fromCache(asset);
    if (hit === 'miss') {
      uncached.push(asset);
    } else if (hit === 'no-location') {
      // Recheck a capped set of prior misses (iCloud may have caught up).
      if (softBudget > 0 && !softRecheckedNoLoc.has(asset.id)) {
        softBudget -= 1;
        softRecheckedNoLoc.add(asset.id);
        uncached.push(asset);
      } else {
        noLocationCount += 1;
      }
    } else {
      photos.push(hit);
    }
  }

  let lastPartialAt = 0;
  const emitPartial = (force: boolean) => {
    if (!onPartial) {
      return;
    }
    if (photos.length === 0 && !force) {
      return;
    }
    const now = Date.now();
    if (!force && now - lastPartialAt < PARTIAL_MIN_MS) {
      return;
    }
    lastPartialAt = now;
    // Partial frames skip a full sort — final return is sorted.
    onPartial(snapshot(month, photos, noLocationCount, force));
  };

  // Emit early only when we already have pins, or when there is nothing left to resolve.
  // Avoid flashing the empty-month state while GPS is still resolving.
  if (photos.length > 0 || uncached.length === 0) {
    emitPartial(uncached.length === 0);
  }

  await resolveUncachedLocations(uncached, {
    batchSize: LOCATION_BATCH,
    yieldMs: BATCH_YIELD_MS,
    yieldToPinExports: true,
    shouldContinue,
    locOpts: { networkFallback: true },
    onBatch: async ({ located: batchLocated, noLocation }) => {
      photos.push(...batchLocated);
      noLocationCount += noLocation;
      emitPartial(false);
    },
  });
  emitPartial(true);

  return snapshot(month, photos, noLocationCount, true);
}

/** Photo counts per month, for the month picker. */
export async function loadMonthSummaries(): Promise<MonthSummary[]> {
  if (isDevDummyPhotosEnabled()) {
    return buildDummyMonthSummaries();
  }

  const assets = await collectAssets({});
  const counts = new Map<MonthKey, number>();

  for (const asset of assets) {
    const month = monthKeyFromTimestamp(asset.creationTime);
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([month, totalCount]) => ({ month, totalCount }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

export type AlbumScanProgress = {
  /** Total assets in the album (or batch universe). */
  assetTotal: number;
  /** Assets already examined (cache hit or native lookup). */
  assetScanned: number;
  /** Photos that currently have GPS. */
  locatedCount: number;
};

export type LoadAllLocatedPhotosOptions = {
  /**
   * Called as GPS cache + native batches fill in (for progressive stamp sync).
   * Awaited so consumers can geocode/ingest before the next GPS batch.
   */
  onPartial?: (photos: PhotoRef[]) => void | Promise<void>;
  /** Lightweight counters for home indexing banner (not awaited). */
  onScanProgress?: (progress: AlbumScanProgress) => void;
  shouldContinue?: () => boolean;
  /**
   * Skip __DEV__ dummy set — always scan the real MediaLibrary.
   * Required for 발도장 lifetime accumulate from the user's album.
   */
  forceRealLibrary?: boolean;
  /** Override LOCATION_BATCH for long full-library scans (default 8). */
  locationBatchSize?: number;
  /** Gap between GPS batches (default BATCH_YIELD_MS). 0 = back-to-back. */
  batchYieldMs?: number;
  /**
   * When false, skip waiting on pin thumb exports (full-album scan after map settle).
   * Default true so month map pins stay responsive.
   */
  yieldToPinExports?: boolean;
  /**
   * Max wait per GPS batch for pin exports to go idle.
   * Use Infinity on full-album scan so home never overlaps ImageManipulator.
   */
  pinExportYieldMaxMs?: number;
  /** Re-read assets that failed getAssetInfoAsync once (transient native errors). */
  retryFailedLocations?: boolean;
  /** Try iCloud download when local metadata has no GPS (발도장 only). */
  networkLocationFallback?: boolean;
  /**
   * Re-check assets previously cached as no-location (may have been iCloud
   * blacklisted before network fallback existed).
   */
  recheckCachedNoLocation?: boolean;
};

/**
 * getAssetInfoAsync fallback — always capped at LOCATION_BATCH.
 * Never Promise.all an entire native-sized chunk (32+); that jetsams iOS.
 */
async function resolveChunkViaGetAssetInfo(
  chunk: Asset[],
  locOpts: { networkFallback?: boolean },
): Promise<(PhotoRef | 'no-location' | null)[]> {
  const out: (PhotoRef | 'no-location' | null)[] = new Array(chunk.length);
  for (let i = 0; i < chunk.length; i += LOCATION_BATCH) {
    const slice = chunk.slice(i, i + LOCATION_BATCH);
    const results = await Promise.all(
      slice.map((asset) => fetchLocation(asset, locOpts)),
    );
    for (let j = 0; j < results.length; j++) {
      out[i + j] = results[j] ?? null;
    }
  }
  return out;
}

/**
 * Prefer AssetLocations native batch (PHAsset.location / EXIF latlng).
 * Falls back to per-asset getAssetInfoAsync when the module is missing.
 */
async function resolveChunkLocations(
  chunk: Asset[],
  locOpts: { networkFallback?: boolean },
): Promise<(PhotoRef | 'no-location' | null)[]> {
  const rows = await getAssetLocationsAsync(chunk.map((a) => a.id));
  if (rows == null) {
    return resolveChunkViaGetAssetInfo(chunk, locOpts);
  }

  const out: (PhotoRef | 'no-location' | null)[] = new Array(chunk.length);
  const needNetwork: number[] = [];

  for (let j = 0; j < chunk.length; j++) {
    const asset = chunk[j]!;
    const row = rows[j];
    const lat = row?.latitude;
    const lng = row?.longitude;
    if (
      lat != null &&
      lng != null &&
      Number.isFinite(lat) &&
      Number.isFinite(lng)
    ) {
      setAssetLocationRaw(asset.id, `${lat},${lng}`);
      out[j] = refFromCoords(asset, lat, lng);
      continue;
    }
    if (locOpts.networkFallback) {
      needNetwork.push(j);
      continue;
    }
    setAssetLocationRaw(asset.id, 'x');
    out[j] = 'no-location';
  }

  // iCloud / deep recheck — same cap as month GPS (opens image bytes).
  for (let i = 0; i < needNetwork.length; i += LOCATION_BATCH) {
    const slice = needNetwork.slice(i, i + LOCATION_BATCH);
    const recovered = await Promise.all(
      slice.map((j) => fetchLocation(chunk[j]!, locOpts)),
    );
    for (let k = 0; k < recovered.length; k++) {
      out[slice[k]!] = recovered[k] ?? null;
    }
  }

  return out;
}

async function resolveUncachedLocations(
  uncached: Asset[],
  options: {
    batchSize: number;
    yieldMs: number;
    yieldToPinExports: boolean;
    pinExportYieldMaxMs?: number;
    shouldContinue?: () => boolean;
    locOpts: { networkFallback?: boolean };
    /** Called after each native batch with how many assets were examined. */
    onBatch?: (update: {
      located: PhotoRef[];
      failed: Asset[];
      examined: number;
      noLocation: number;
    }) => void | Promise<void>;
  },
): Promise<{ located: PhotoRef[]; failed: Asset[] }> {
  const located: PhotoRef[] = [];
  const failed: Asset[] = [];
  const {
    batchSize,
    yieldMs,
    yieldToPinExports,
    pinExportYieldMaxMs = 2500,
    shouldContinue,
    locOpts,
  } = options;

  for (let i = 0; i < uncached.length; i += batchSize) {
    await pauseWhileBackgrounded(shouldContinue);
    if (yieldToPinExports) {
      await waitWhilePinExportBusy(pinExportYieldMaxMs);
    }
    await pauseWhileBackgrounded(shouldContinue);
    const chunk = uncached.slice(i, i + batchSize);
    const results = await resolveChunkLocations(chunk, locOpts);
    const batchLocated: PhotoRef[] = [];
    const batchFailed: Asset[] = [];
    let noLocation = 0;
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result != null && result !== 'no-location') {
        batchLocated.push(result);
        located.push(result);
      } else if (result === 'no-location') {
        noLocation += 1;
      } else if (result === null) {
        batchFailed.push(chunk[j]!);
        failed.push(chunk[j]!);
      }
    }
    await options.onBatch?.({
      located: batchLocated,
      failed: batchFailed,
      examined: chunk.length,
      noLocation,
    });
    const remaining = uncached.length - (i + chunk.length);
    if (remaining > 0 && yieldMs > 0) {
      await new Promise((r) => setTimeout(r, yieldMs));
    }
  }

  return { located, failed };
}

/**
 * All library photos that have GPS.
 * Streams MediaLibrary pages → GPS resolve (does not wait to list the whole
 * album first). Does not reverse-geocode.
 */
export async function loadAllLocatedPhotos(
  options?: LoadAllLocatedPhotosOptions,
): Promise<PhotoRef[]> {
  const {
    onPartial,
    onScanProgress,
    shouldContinue,
    forceRealLibrary,
    locationBatchSize,
    batchYieldMs,
    yieldToPinExports = true,
    pinExportYieldMaxMs,
    retryFailedLocations,
    networkLocationFallback,
    recheckCachedNoLocation,
  } = options ?? {};
  const batchSize =
    locationBatchSize != null && locationBatchSize > 0
      ? locationBatchSize
      : LOCATION_BATCH;
  const yieldMs =
    batchYieldMs != null && batchYieldMs >= 0 ? batchYieldMs : BATCH_YIELD_MS;
  const locOpts = { networkFallback: networkLocationFallback === true };
  const pinYieldMaxMs = pinExportYieldMaxMs ?? 2500;

  if (!forceRealLibrary && isDevDummyPhotosEnabled()) {
    const summaries = buildDummyMonthSummaries();
    const photos: PhotoRef[] = [];
    for (const { month } of summaries) {
      const monthPhotos = await buildDummyMonthlyPhotos(month);
      photos.push(...monthPhotos.photos);
    }
    onScanProgress?.({
      assetTotal: photos.length,
      assetScanned: photos.length,
      locatedCount: photos.length,
    });
    await onPartial?.(photos);
    return photos;
  }

  const photos: PhotoRef[] = [];
  const allFailed: Asset[] = [];
  let listed = 0;
  let scanned = 0;
  /** Real album size from MediaLibrary (not a rolling page estimate). */
  let assetTotal = 0;
  let after: string | undefined;
  let hasNextPage = true;

  const emit = () => {
    onScanProgress?.({
      assetTotal: Math.max(assetTotal, listed),
      assetScanned: scanned,
      locatedCount: photos.length,
    });
  };

  while (hasNextPage) {
    await pauseWhileBackgrounded(shouldContinue);
    const page = await getAssetsAsync({
      first: LIBRARY_PAGE_SIZE,
      after,
      mediaType: MediaType.photo,
      sortBy: [[SortBy.creationTime, false]],
    });
    hasNextPage = page.hasNextPage;
    after = page.endCursor;
    listed += page.assets.length;
    // totalCount is available on the first page — show 0/18,000 immediately.
    if (page.totalCount > assetTotal) {
      assetTotal = page.totalCount;
    }

    const uncached: Asset[] = [];
    let pageGrew = false;
    /** Emit every N cache hits so the count climbs continuously, not by page. */
    const CACHE_PROGRESS_EVERY = 16;
    let sinceEmit = 0;
    for (const asset of page.assets) {
      const hit = fromCache(asset);
      if (hit === 'miss') {
        uncached.push(asset);
      } else if (hit === 'no-location') {
        if (recheckCachedNoLocation) {
          uncached.push(asset);
        } else {
          scanned += 1;
          sinceEmit += 1;
        }
      } else {
        photos.push(hit);
        scanned += 1;
        pageGrew = true;
        sinceEmit += 1;
      }
      if (sinceEmit >= CACHE_PROGRESS_EVERY) {
        emit();
        sinceEmit = 0;
        // Let the indexing banner paint during cache-only stretches.
        await new Promise((r) => setTimeout(r, 0));
        await pauseWhileBackgrounded(shouldContinue);
      }
    }
    if (sinceEmit > 0) {
      emit();
    }
    if (pageGrew) {
      await onPartial?.(photos.slice());
    }

    if (uncached.length === 0) {
      continue;
    }

    const { failed } = await resolveUncachedLocations(uncached, {
      batchSize,
      yieldMs,
      yieldToPinExports,
      pinExportYieldMaxMs: pinYieldMaxMs,
      shouldContinue,
      locOpts,
      onBatch: async ({ located: batchLocated, examined }) => {
        photos.push(...batchLocated);
        scanned += examined;
        emit();
        if (batchLocated.length > 0) {
          await onPartial?.(photos.slice());
        }
      },
    });
    allFailed.push(...failed);
  }

  assetTotal = Math.max(assetTotal, listed);
  emit();

  if (retryFailedLocations && allFailed.length > 0) {
    await resolveUncachedLocations(allFailed, {
      batchSize,
      yieldMs,
      yieldToPinExports,
      pinExportYieldMaxMs: pinYieldMaxMs,
      shouldContinue,
      locOpts,
      onBatch: async ({ located: batchLocated }) => {
        photos.push(...batchLocated);
        onScanProgress?.({
          assetTotal,
          assetScanned: listed,
          locatedCount: photos.length,
        });
        if (batchLocated.length > 0) {
          await onPartial?.(photos.slice());
        }
      },
    });
  }

  onScanProgress?.({
    assetTotal,
    assetScanned: listed,
    locatedCount: photos.length,
  });

  return photos;
}

const uriCache = new Map<string, string | null>();
const fileUriCache = new Map<string, string | null>();
const fileUriInflight = new Map<string, Promise<string | null>>();

const pinExportIdleListeners = new Set<() => void>();

function notifyPinExportMaybeIdle(): void {
  if (fileUriInflight.size > 0) {
    return;
  }
  for (const listener of [...pinExportIdleListeners]) {
    listener();
  }
}

/** True while any pin thumb export / disk resolve is in flight. */
export function isPinExportBusy(): boolean {
  return fileUriInflight.size > 0;
}

/**
 * Resolves when pin thumb exports are idle, or after `maxMs` (whichever first).
 * Pass Infinity to wait until idle with no timeout (full-album home scan).
 */
export function waitWhilePinExportBusy(maxMs = 2500): Promise<void> {
  if (!isPinExportBusy()) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer != null) {
        clearTimeout(timer);
      }
      pinExportIdleListeners.delete(onIdle);
      resolve();
    };
    if (Number.isFinite(maxMs)) {
      timer = setTimeout(finish, Math.max(0, maxMs));
    }
    const onIdle = () => {
      if (!isPinExportBusy()) {
        finish();
      }
    };
    pinExportIdleListeners.add(onIdle);
  });
}

/** Pin thumbs are ~44pt; 128px covers @3x without shipping full camera-roll files. */
const PIN_THUMB_WIDTH = 128;

/**
 * Sync display URI for list cells — no Promise, no setState on scroll.
 * Prefers a warm ~128px `file://` pin thumb only when `imageSize` is thumb-sized
 * (avoids full `ph://` decode on dense grids). Hero / collage (256+) skip the
 * pin thumb so they are not stuck on a soft 128px bake after warmGridThumbs.
 * Else iOS/dummy sync; Android cache hit or null (warm via
 * {@link resolveAssetUri} / {@link resolveAssetFileUri}).
 */
export function syncAssetDisplayUri(
  assetId: string,
  imageSize: DummyImageSize = 128,
): string | null {
  if (isDummyAssetId(assetId)) {
    return dummyAssetImageUri(assetId, imageSize);
  }
  if (imageSize <= PIN_THUMB_WIDTH) {
    const file = peekAssetFileUri(assetId);
    if (file) {
      return file;
    }
  }
  if (Platform.OS === 'ios') {
    return `ph://${assetId}`;
  }
  return uriCache.get(assetId) ?? null;
}

/**
 * Resolve a display URI for a camera-roll asset. Every consumer feeds the
 * result to expo-image, which renders iOS `ph://` Photos URIs natively — so on
 * iOS this is a pure string build with no native round-trip. Elsewhere the
 * (per-asset native call) lookup runs once and is memoized: grid cells
 * unmount/remount while scrolling and would otherwise re-pay it every time.
 */
export async function resolveAssetUri(
  assetId: string,
  options?: {
    /** Dummy/picsum edge length; ignored for real Photos assets. */
    imageSize?: DummyImageSize;
  },
): Promise<string | null> {
  const imageSize = options?.imageSize ?? 256;
  const cacheKey =
    isDummyAssetId(assetId) ? `${assetId}#${imageSize}` : assetId;
  const hit = uriCache.get(cacheKey);
  if (hit !== undefined) {
    return hit;
  }

  if (isDummyAssetId(assetId)) {
    const uri = dummyAssetImageUri(assetId, imageSize);
    lruSet(uriCache, cacheKey, uri, URI_CACHE_MAX);
    return uri;
  }

  if (Platform.OS === 'ios') {
    const uri = `ph://${assetId}`;
    lruSet(uriCache, assetId, uri, URI_CACHE_MAX);
    return uri;
  }

  return limitAndroidUri(async () => {
    // Re-check after waiting in the queue — another cell may have filled cache.
    const queuedHit = uriCache.get(assetId);
    if (queuedHit !== undefined) {
      return queuedHit;
    }
    try {
      const info = await getAssetInfoAsync(assetId, {
        shouldDownloadFromNetwork: false,
      });
      const uri = info.localUri ?? info.uri ?? null;
      // Only cache hits — a null miss may be transient (iCloud / permission).
      if (uri) {
        lruSet(uriCache, assetId, uri, URI_CACHE_MAX);
      }
      return uri;
    } catch (error) {
      console.error('resolveAssetUri failed', assetId, error);
      return null; // transient — leave uncached so a retry can succeed
    }
  });
}

/** Strip iOS 18+ metadata fragments that break Image / manipulator loaders. */
function sanitizeMediaUri(uri: string): string {
  const hash = uri.indexOf('#');
  return hash >= 0 ? uri.slice(0, hash) : uri;
}

function normalizeFileCandidate(uri: string): string | null {
  const cleaned = sanitizeMediaUri(uri);
  if (cleaned.startsWith('file:') || cleaned.startsWith('content:')) {
    return cleaned;
  }
  if (cleaned.startsWith('/')) {
    return `file://${cleaned}`;
  }
  return null;
}

/**
 * Copy (and shrink) a Photos asset into the app cache as `file://`.
 * Naver markers load this via `image.httpUri` (native file:// reader).
 *
 * On iOS, prefer `ph://` — ImageManipulator loads it via PHImageManager.
 * Raw DCIM `localUri` often fails `isReadableFile` (iOS 18 sandbox) and must
 * never be passed straight to Naver (NSData can't read it either).
 */
async function exportPinThumbFileUri(assetId: string): Promise<string | null> {
  // Warm iCloud / paired resources before reading pixels.
  let infoLocal: string | null = null;
  try {
    let info = await getAssetInfoAsync(assetId, { shouldDownloadFromNetwork: true });
    infoLocal = info.localUri ?? null;
    if (!infoLocal && Platform.OS === 'ios') {
      await new Promise((r) => setTimeout(r, 450));
      info = await getAssetInfoAsync(assetId, { shouldDownloadFromNetwork: true });
      infoLocal = info.localUri ?? null;
    }
  } catch (error) {
    console.error('getAssetInfoAsync for pin thumb failed', assetId, error);
  }

  const sources: string[] = [];
  // 1) ph:// — dedicated Photo Library path in expo-image-manipulator.
  if (Platform.OS === 'ios') {
    sources.push(`ph://${assetId}`);
  }
  // 2) localUri only when it looks like an app-readable file (not DCIM Media/).
  if (infoLocal) {
    const cleaned = sanitizeMediaUri(infoLocal);
    const isAppFile =
      (cleaned.startsWith('file:') || cleaned.startsWith('/')) &&
      !cleaned.includes('/Media/DCIM/') &&
      !cleaned.includes('/Mobile/Media/');
    if (isAppFile || cleaned.startsWith('content:')) {
      sources.push(cleaned);
    }
  }

  const tried = new Set<string>();
  for (const src of sources) {
    if (tried.has(src)) {
      continue;
    }
    tried.add(src);
    try {
      const out = await manipulateAsync(
        src,
        [{ resize: { width: PIN_THUMB_WIDTH } }],
        { compress: 0.78, format: SaveFormat.JPEG },
      );
      const fileUri = normalizeFileCandidate(out.uri) ?? out.uri;
      // Only accept manipulator cache output — never a Photos DCIM path.
      if (fileUri.startsWith('file:') || fileUri.startsWith('content:')) {
        return fileUri;
      }
    } catch (error) {
      console.warn('pin thumb export failed', assetId, src.slice(0, 48), error);
    }
  }

  return null;
}

/**
 * Sync memory peek for pin thumbs. Map markers use this on first paint so a
 * remount after zoom doesn't flash the placeholder when the URI is already warm.
 */
export function peekAssetFileUri(assetId: string): string | null {
  return fileUriCache.get(assetId) ?? null;
}

/**
 * Resolve a `file://` (or readable local) URI for native map markers.
 * Naver loads it via `image.httpUri` (supports file:// natively). Do not pass
 * thumbs as custom React children — iOS snapshots those with renderInContext
 * and RN Image pixels are often missing on device.
 * Dummy assets keep https picsum URLs.
 */
export async function resolveAssetFileUri(assetId: string): Promise<string | null> {
  const hit = fileUriCache.get(assetId);
  if (hit !== undefined) {
    return hit;
  }

  const pending = fileUriInflight.get(assetId);
  if (pending) {
    return pending;
  }

  const work = (async (): Promise<string | null> => {
    if (isDummyAssetId(assetId)) {
      const uri = dummyAssetImageUri(assetId, 256);
      lruSet(fileUriCache, assetId, uri, FILE_URI_CACHE_MAX);
      return uri;
    }

    try {
      const diskHit = await readPinThumbFromDisk(assetId);
      if (diskHit) {
        lruSet(fileUriCache, assetId, diskHit, FILE_URI_CACHE_MAX);
        return diskHit;
      }

      // One slot covers getAssetInfoAsync + manipulateAsync (avoid parallel decode storms).
      const exported = await limitPinExport(() => exportPinThumbFileUri(assetId));
      if (!exported) {
        return null;
      }
      const durable = (await writePinThumbToDisk(assetId, exported)) ?? exported;
      lruSet(fileUriCache, assetId, durable, FILE_URI_CACHE_MAX);
      return durable;
    } catch (error) {
      console.error('resolveAssetFileUri failed', assetId, error);
      return null;
    }
  })().finally(() => {
    fileUriInflight.delete(assetId);
    notifyPinExportMaybeIdle();
  });

  fileUriInflight.set(assetId, work);
  return work;
}

/**
 * Pause/resume idle thumb export while the user is scrolling a photo grid.
 * In-flight manipulator work (at most 1) may finish; nothing new starts.
 */
export function setGridThumbWarmPaused(paused: boolean): void {
  gridThumbWarmPaused = paused;
}

/**
 * Idle-warm 128px file thumbs for grid cells. Fills {@link peekAssetFileUri}
 * only — callers must NOT setState on completion (that hitches scroll).
 * Recycled cells pick up file:// via {@link syncAssetDisplayUri}.
 */
export function scheduleGridThumbWarm(assetId: string): void {
  if (isDummyAssetId(assetId)) {
    return;
  }
  if (gridThumbWarmPaused) {
    return;
  }
  if (peekAssetFileUri(assetId) || gridThumbWarmQueued.has(assetId)) {
    return;
  }
  gridThumbWarmQueued.add(assetId);
  void limitGridThumbWarm(async () => {
    try {
      if (gridThumbWarmPaused) {
        return;
      }
      await resolveAssetFileUri(assetId);
    } finally {
      gridThumbWarmQueued.delete(assetId);
    }
  });
}

/** After interactions — warm the first N ids for a screen (Playback / card grid). */
export function warmGridThumbs(assetIds: string[], limit = 48): void {
  if (gridThumbWarmPaused) {
    return;
  }
  const slice = assetIds.slice(0, Math.max(0, limit));
  for (const id of slice) {
    scheduleGridThumbWarm(id);
  }
}
