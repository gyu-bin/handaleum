import type { PhotoRef } from '@/features/photos/types';

/**
 * ~1km cells for stamp Pass A (fast dong sampling).
 * Map chips stay on placeCache BUCKET_DECIMALS (110m).
 */
export const STAMP_COARSE_DECIMALS = 2;

export function stampCoarseBucketKey(lat: number, lng: number): string {
  return `${lat.toFixed(STAMP_COARSE_DECIMALS)},${lng.toFixed(STAMP_COARSE_DECIMALS)}`;
}

/**
 * One representative photo per coarse cell (earliest takenAt, real coords).
 * Caller should pass domestic-only photos when used for Korea stamps.
 */
export function thinPhotosToCoarseBuckets(photos: PhotoRef[]): PhotoRef[] {
  const map = new Map<string, PhotoRef>();
  for (const photo of photos) {
    const key = stampCoarseBucketKey(photo.lat, photo.lng);
    const existing = map.get(key);
    if (!existing || photo.takenAt < existing.takenAt) {
      map.set(key, photo);
    }
  }
  return [...map.values()].sort((a, b) => a.takenAt.localeCompare(b.takenAt));
}
