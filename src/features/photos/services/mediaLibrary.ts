import {
  getAssetInfoAsync,
  getAssetsAsync,
  MediaType,
  SortBy,
  type Asset,
} from 'expo-media-library';

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

async function toPhotoRefOrNull(asset: Asset): Promise<PhotoRef | 'no-location' | null> {
  try {
    const info = await getAssetInfoAsync(asset, { shouldDownloadFromNetwork: false });
    const location = info.location;
    if (location == null) {
      return 'no-location';
    }
    // Native module exports coordinates as strings despite the number type.
    const lat = Number(location.latitude);
    const lng = Number(location.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return 'no-location';
    }
    return {
      assetId: asset.id,
      takenAt: new Date(asset.creationTime).toISOString(),
      lat,
      lng,
    };
  } catch (error) {
    console.error('getAssetInfoAsync failed', asset.id, error);
    return null;
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

/** Resolve a display URI for a camera-roll asset. */
export async function resolveAssetUri(assetId: string): Promise<string | null> {
  try {
    const info = await getAssetInfoAsync(assetId, { shouldDownloadFromNetwork: false });
    return info.localUri ?? info.uri ?? null;
  } catch (error) {
    console.error('resolveAssetUri failed', assetId, error);
    return null;
  }
}
