import { Platform } from 'react-native';
import {
  getAssetInfoAsync,
  getAssetsAsync,
  MediaType,
  SortBy,
  type Asset,
} from 'expo-media-library';

import { getAssetLocationRaw, setAssetLocationRaw } from '@/lib/storage';

import type { MonthKey, MonthlyPhotos, MonthSummary, PhotoRef } from '../types';
import { monthBounds, monthKeyFromTimestamp } from '../utils/month';
import { waitForAppForeground } from './appForeground';

/** Larger pages = fewer native round-trips when listing a month. */
const PAGE_SIZE = 200;
/** Parallel getAssetInfoAsync calls for uncached assets only. */
const LOCATION_BATCH = 40;

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

const uriCache = new Map<string, string | null>();

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

  if (Platform.OS === 'ios') {
    const uri = `ph://${assetId}`;
    uriCache.set(assetId, uri);
    return uri;
  }

  try {
    const info = await getAssetInfoAsync(assetId, { shouldDownloadFromNetwork: false });
    const uri = info.localUri ?? info.uri ?? null;
    uriCache.set(assetId, uri);
    return uri;
  } catch (error) {
    console.error('resolveAssetUri failed', assetId, error);
    return null; // transient — leave uncached so a retry can succeed
  }
}
