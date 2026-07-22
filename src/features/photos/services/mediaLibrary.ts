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

const PAGE_SIZE = 100;

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

async function toPhotoRefOrNull(asset: Asset): Promise<PhotoRef | 'no-location' | null> {
  // GPS is effectively immutable per asset, and getAssetInfoAsync is one native
  // call per photo — the dominant cost of a month load — so hit the persistent
  // cache first and only ask the library about assets we've never seen.
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

/**
 * Load all camera-roll photos for a month via expo-media-library.
 * Photos without GPS are excluded from `photos` and counted in
 * `noLocationCount`. Success criterion: 1,000-photo month loads within 3s.
 */
export async function loadMonthlyPhotos(month: MonthKey): Promise<MonthlyPhotos> {
  const { startMs, endMs } = monthBounds(month);
  const assets = await collectAssets({
    createdAfter: startMs,
    createdBefore: endMs,
  });

  const photos: PhotoRef[] = [];
  let noLocationCount = 0;

  // Resolve location in small batches to avoid flooding the bridge.
  const BATCH = 20;
  for (let i = 0; i < assets.length; i += BATCH) {
    const chunk = assets.slice(i, i + BATCH);
    const results = await Promise.all(chunk.map(toPhotoRefOrNull));
    for (const result of results) {
      if (result === 'no-location') {
        noLocationCount += 1;
      } else if (result != null) {
        photos.push(result);
      }
    }
  }

  photos.sort((a, b) => a.takenAt.localeCompare(b.takenAt));

  return { month, photos, noLocationCount };
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
