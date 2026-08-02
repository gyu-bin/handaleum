import type { PhotoRef } from '../types';
import {
  ensurePlacePermission,
  placeBucketKey,
  resolveDetailLabel,
  resolvePlace,
  resolveVisitPlaces,
} from '../services/placeResolve';

import {
  formatAlbumPlaceLabel,
  formatDetailPlaceLabel,
  parseGeocodedPlace,
} from './parseGeocodedPlace';

// Re-exported so existing consumers keep importing from `placeJourney`.
export { labelsForVisitLevel } from './placeLabels';
export {
  formatAlbumPlaceLabel,
  formatDetailPlaceLabel,
  parseGeocodedPlace,
};
export { placeBucketKey, resolveVisitPlaces };

/**
 * Pin sheet / playback — same ResolvedPlace.detailLabel as journey chips.
 */
export async function resolveClusterDetailLabel(
  lat: number,
  lng: number,
): Promise<string | null> {
  return resolveDetailLabel(lat, lng, { requestPermission: true });
}

/**
 * Card plate region: "경기도 · 성남시" / "서울 · 마포구".
 */
export async function resolveCardRegionLabel(
  lat: number,
  lng: number,
): Promise<string | null> {
  const allowed = await ensurePlacePermission(true);
  if (!allowed) {
    return null;
  }
  const place = await resolvePlace(lat, lng);
  if (!place) {
    return null;
  }

  const province = place.province?.trim() || null;
  const city = place.city?.trim() || null;
  const gu = place.gu?.trim() || null;

  if (province && gu && (province === '서울' || city?.startsWith('서울'))) {
    return `${province} · ${gu}`;
  }
  if (province && city && province !== city && !city.startsWith(province)) {
    return `${province} · ${city}`;
  }
  if (city && gu) {
    return `${city} · ${gu}`;
  }
  return city ?? province ?? place.journeyLabel ?? null;
}

export type PlacePhotoSection = {
  title: string;
  data: PhotoRef[];
};

/**
 * Group month photos under journey-style place headers for the card picker.
 */
export async function groupPhotosByJourneyPlace(
  photos: PhotoRef[],
  unknownLabel: string,
): Promise<PlacePhotoSection[]> {
  if (photos.length === 0) {
    return [];
  }

  const allowed = await ensurePlacePermission(true);
  if (!allowed) {
    return [
      {
        title: unknownLabel,
        data: [...photos].sort((a, b) => b.takenAt.localeCompare(a.takenAt)),
      },
    ];
  }

  const bucketLabel = new Map<string, string>();
  type Acc = { title: string; photos: PhotoRef[]; firstTakenAt: string };
  const groups = new Map<string, Acc>();

  for (const photo of photos) {
    const key = placeBucketKey(photo.lat, photo.lng);
    if (!bucketLabel.has(key)) {
      const place = await resolvePlace(photo.lat, photo.lng);
      bucketLabel.set(key, place?.journeyLabel ?? unknownLabel);
    }
    const title = bucketLabel.get(key)!;
    let acc = groups.get(title);
    if (!acc) {
      acc = { title, photos: [], firstTakenAt: photo.takenAt };
      groups.set(title, acc);
    }
    acc.photos.push(photo);
    if (photo.takenAt < acc.firstTakenAt) {
      acc.firstTakenAt = photo.takenAt;
    }
  }

  return [...groups.values()]
    .sort((a, b) => a.firstTakenAt.localeCompare(b.firstTakenAt))
    .map((group) => ({
      title: group.title,
      data: [...group.photos].sort((a, b) => b.takenAt.localeCompare(a.takenAt)),
    }));
}
