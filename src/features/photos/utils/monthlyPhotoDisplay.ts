import type { DisplayPhoto, MonthlyPhotos, PhotoRef } from '../types';

export function isLocatedPhoto(photo: DisplayPhoto): photo is PhotoRef {
  return 'lat' in photo && 'lng' in photo;
}

/**
 * Builds the photo-record source for a month. Located rows win duplicate ids
 * because they carry the extra map metadata; no synthetic coordinates are made.
 */
export function getAllMonthlyPhotos(
  data: Pick<MonthlyPhotos, 'photos' | 'noLocationPhotos'>,
): DisplayPhoto[] {
  const byAssetId = new Map<string, DisplayPhoto>();

  for (const photo of data.noLocationPhotos ?? []) {
    byAssetId.set(photo.assetId, photo);
  }
  for (const photo of data.photos) {
    byAssetId.set(photo.assetId, photo);
  }

  return [...byAssetId.values()].sort((a, b) =>
    a.takenAt.localeCompare(b.takenAt),
  );
}
