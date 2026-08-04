import { getPlaceResolveRaw, setPlaceResolveRaw } from '@/lib/storage';

import { resolvedPlaceSchema } from '../schema';
import type { ResolvedPlace } from '../types';

/**
 * Two-tier place cache behind `placeResolve`. Disk survives cold start so
 * journey chips paint before CLGeocoder runs.
 */

/** ~110m buckets — nearby photos share one reverse-geocode call. */
export const BUCKET_DECIMALS = 3;
/** Bump when parseGeocodedPlace / gu recovery changes (invalidates disk keys). */
const CACHE_REV = 'v18';

const placeCache = new Map<string, ResolvedPlace>();
/** Buckets known absent from disk — avoids a sync SQLite read per repaint. */
const diskMissCache = new Set<string>();

export function placeBucketKey(lat: number, lng: number): string {
  return `${lat.toFixed(BUCKET_DECIMALS)},${lng.toFixed(BUCKET_DECIMALS)}`;
}

export function placeCacheKey(lat: number, lng: number): string {
  return `${CACHE_REV}:${placeBucketKey(lat, lng)}`;
}

function readDiskPlace(key: string): ResolvedPlace | null {
  const raw = getPlaceResolveRaw(key);
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = resolvedPlaceSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** Sync peek — memory then disk. Never geocodes. */
export function peekResolvedPlace(
  lat: number,
  lng: number,
): ResolvedPlace | null {
  const key = placeCacheKey(lat, lng);
  const mem = placeCache.get(key);
  if (mem) {
    return mem;
  }
  if (diskMissCache.has(key)) {
    return null;
  }
  const disk = readDiskPlace(key);
  if (disk) {
    placeCache.set(key, disk);
    return disk;
  }
  diskMissCache.add(key);
  return null;
}

export function storeResolvedPlace(key: string, place: ResolvedPlace): void {
  placeCache.set(key, place);
  diskMissCache.delete(key);
  setPlaceResolveRaw(key, JSON.stringify(place));
}

/** Drop in-memory place cache (disk keys keep prior rev until overwritten). */
export function clearPlaceResolveCache(): void {
  placeCache.clear();
  diskMissCache.clear();
}
