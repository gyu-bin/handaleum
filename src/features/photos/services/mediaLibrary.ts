import { Platform } from 'react-native';
import {
  getAssetInfoAsync,
  getAssetsAsync,
  MediaType,
  SortBy,
  type Asset,
} from 'expo-media-library';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import { getAssetLocationRaw, setAssetLocationRaw } from '@/lib/storage';
import {
  createConcurrencyLimiter,
  lruSet,
} from '@/shared/utils/concurrency';

import type { MonthKey, MonthlyPhotos, MonthSummary, PhotoRef } from '../types';
import { monthBounds, monthKeyFromTimestamp } from '../utils/month';
import { waitForAppForeground } from './appForeground';
import {
  buildDummyMonthSummaries,
  buildDummyMonthlyPhotos,
  dummyAssetImageUri,
  isDevDummyPhotosEnabled,
  isDummyAssetId,
} from './dummyPhotos';
import { readPinThumbFromDisk, writePinThumbToDisk } from './pinThumbCache';

/** Larger pages = fewer native round-trips when listing a month. */
const PAGE_SIZE = 200;
/**
 * Parallel getAssetInfoAsync for uncached GPS. Keep low — large months used to
 * fan out 40 native reads and jetsam the process.
 */
const LOCATION_BATCH = 8;
/** Cap simultaneous ImageManipulator exports (map pin thumbs). */
const PIN_EXPORT_CONCURRENCY = 2;
/** Cap simultaneous Android URI lookups while scrolling grids. */
const ANDROID_URI_CONCURRENCY = 6;
/** Bound in-memory URI maps so multi-month sessions don't grow forever. */
const URI_CACHE_MAX = 400;
const FILE_URI_CACHE_MAX = 80;

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

async function fetchLocation(asset: Asset): Promise<PhotoRef | 'no-location' | null> {
  try {
    const info = await getAssetInfoAsync(asset, { shouldDownloadFromNetwork: false });
    const location = info.location;
    // Native module exports coordinates as strings despite the number type.
    const lat = location == null ? NaN : Number(location.latitude);
    const lng = location == null ? NaN : Number(location.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setAssetLocationRaw(asset.id, 'x');
      return 'no-location';
    }
    setAssetLocationRaw(asset.id, `${lat},${lng}`);
    return refFromCoords(asset, lat, lng);
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

async function pauseWhileBackgrounded(shouldContinue?: () => boolean): Promise<void> {
  if (!shouldContinue || shouldContinue()) {
    return;
  }
  await waitForAppForeground();
}

/** Min gap between progressive UI updates — avoids re-clustering every batch. */
const PARTIAL_MIN_MS = 400;

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

  for (const asset of assets) {
    const hit = fromCache(asset);
    if (hit === 'miss') {
      uncached.push(asset);
    } else if (hit === 'no-location') {
      noLocationCount += 1;
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

  for (let i = 0; i < uncached.length; i += LOCATION_BATCH) {
    await pauseWhileBackgrounded(shouldContinue);
    const chunk = uncached.slice(i, i + LOCATION_BATCH);
    const results = await Promise.all(chunk.map(fetchLocation));
    for (const result of results) {
      if (result === 'no-location') {
        noLocationCount += 1;
      } else if (result != null) {
        photos.push(result);
      }
    }
    const remaining = uncached.length - (i + chunk.length);
    if (photos.length > 0 || remaining <= 0) {
      emitPartial(remaining <= 0);
    }
  }

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

export type LoadAllLocatedPhotosOptions = {
  /** Called as GPS cache + native batches fill in (for progressive stamp sync). */
  onPartial?: (photos: PhotoRef[]) => void;
  shouldContinue?: () => boolean;
};

/**
 * All library photos that have GPS — cache hits first, then uncached batches.
 * Used once for 발도장 historical backfill.
 */
export async function loadAllLocatedPhotos(
  options?: LoadAllLocatedPhotosOptions,
): Promise<PhotoRef[]> {
  if (isDevDummyPhotosEnabled()) {
    const summaries = buildDummyMonthSummaries();
    const photos: PhotoRef[] = [];
    for (const { month } of summaries) {
      const monthPhotos = await buildDummyMonthlyPhotos(month);
      photos.push(...monthPhotos.photos);
    }
    options?.onPartial?.(photos);
    return photos;
  }

  const { onPartial, shouldContinue } = options ?? {};
  const assets = await collectAssets({});
  const photos: PhotoRef[] = [];
  const uncached: Asset[] = [];

  for (const asset of assets) {
    const hit = fromCache(asset);
    if (hit === 'miss') {
      uncached.push(asset);
    } else if (hit !== 'no-location') {
      photos.push(hit);
    }
  }

  if (photos.length > 0) {
    onPartial?.(photos.slice());
  }

  for (let i = 0; i < uncached.length; i += LOCATION_BATCH) {
    await pauseWhileBackgrounded(shouldContinue);
    const chunk = uncached.slice(i, i + LOCATION_BATCH);
    const results = await Promise.all(chunk.map(fetchLocation));
    let grew = false;
    for (const result of results) {
      if (result != null && result !== 'no-location') {
        photos.push(result);
        grew = true;
      }
    }
    if (grew) {
      onPartial?.(photos.slice());
    }
  }

  return photos;
}

const uriCache = new Map<string, string | null>();
const fileUriCache = new Map<string, string | null>();
const fileUriInflight = new Map<string, Promise<string | null>>();

/** Pin thumbs are ~44pt; 128px covers @3x without shipping full camera-roll files. */
const PIN_THUMB_WIDTH = 128;

/**
 * Resolve a display URI for a camera-roll asset. Every consumer feeds the
 * result to expo-image, which renders iOS `ph://` Photos URIs natively — so on
 * iOS this is a pure string build with no native round-trip. Elsewhere the
 * (per-asset native call) lookup runs once and is memoized: grid cells
 * unmount/remount while scrolling and would otherwise re-pay it every time.
 */
export async function resolveAssetUri(assetId: string): Promise<string | null> {
  const hit = uriCache.get(assetId);
  if (hit !== undefined) {
    return hit;
  }

  if (isDummyAssetId(assetId)) {
    const uri = dummyAssetImageUri(assetId);
    lruSet(uriCache, assetId, uri, URI_CACHE_MAX);
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
      const uri = dummyAssetImageUri(assetId);
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
  });

  fileUriInflight.set(assetId, work);
  return work;
}
