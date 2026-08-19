import type { PhotoRef } from '../types';
import {
  ensurePlacePermission,
  peekResolvedPlace,
  placeBucketKey,
  resolveDetailLabel,
  resolvePlace,
  resolveVisitPlaces,
} from '../services/placeResolve';
import { collectBuckets, type PlaceBucket } from './visitPlaceBuild';

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

export type PlaceGroupProgress = {
  done: number;
  total: number;
};

function sectionsFromPhotos(
  photos: PhotoRef[],
  unknownLabel: string,
): PlacePhotoSection[] {
  type Acc = { title: string; photos: PhotoRef[]; firstTakenAt: string };
  const groups = new Map<string, Acc>();

  for (const photo of photos) {
    const place = peekResolvedPlace(photo.lat, photo.lng);
    const title = place?.journeyLabel ?? unknownLabel;
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

/**
 * Group month photos under journey-style place headers for the card picker.
 * Cache hits paint immediately; remaining ~110m buckets geocode one at a time.
 */
export async function groupPhotosByJourneyPlace(
  photos: PhotoRef[],
  unknownLabel: string,
  options?: {
    onProgress?: (
      sections: PlacePhotoSection[],
      progress: PlaceGroupProgress,
    ) => void;
    signal?: { cancelled: boolean };
  },
): Promise<PlacePhotoSection[]> {
  if (photos.length === 0) {
    return [];
  }

  const buckets = collectBuckets(photos);
  const pending: PlaceBucket[] = [];
  for (const bucket of buckets) {
    if (!peekResolvedPlace(bucket.lat, bucket.lng)) {
      pending.push(bucket);
    }
  }

  const emit = (done: number) => {
    const sections = sectionsFromPhotos(photos, unknownLabel);
    options?.onProgress?.(sections, { done, total: buckets.length });
    return sections;
  };

  const cached = buckets.length - pending.length;
  const initial = emit(cached);
  if (pending.length === 0) {
    return initial;
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

  let done = cached;
  for (const bucket of pending) {
    if (options?.signal?.cancelled) {
      return sectionsFromPhotos(photos, unknownLabel);
    }
    await resolvePlace(bucket.lat, bucket.lng);
    done += 1;
    emit(done);
  }

  return sectionsFromPhotos(photos, unknownLabel);
}
