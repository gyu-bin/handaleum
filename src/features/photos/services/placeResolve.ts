import type { PhotoRef, ResolvedPlace, VisitPlace } from '../types';
import { isEupMyonName } from '../utils/adminNames';
import { liftEupMyonCity } from '../utils/parentSiFromCoords';
import { parseGeocodedPlace } from '../utils/parseGeocodedPlace';
import { composeFineLabel } from '../utils/placeLabels';
import {
  collectBuckets,
  collectVisitPlaces,
  type PlaceBucket,
} from '../utils/visitPlaceBuild';

import { ensurePlacePermission, reverseGeocode } from './geocodeQueue';
import {
  BUCKET_DECIMALS,
  peekResolvedPlace,
  placeBucketKey,
  placeCacheKey,
  storeResolvedPlace,
} from './placeCache';

/**
 * Single entry for coordinate → place name. Cache and rate limiting live in
 * `placeCache` / `geocodeQueue`; this file owns the naming policy and the
 * journey-chip API. The GPS→pin pipeline does not go through here.
 */

export { clearPlaceResolveCache, peekResolvedPlace, placeBucketKey } from './placeCache';
export { ensurePlacePermission } from './geocodeQueue';

const inflightPlace = new Map<string, Promise<ResolvedPlace | null>>();

function detailLabelFromParts(
  city: string | null,
  gu: string | null,
  dong: string | null,
  eupMyon: string | null,
  lat: number,
  lng: number,
  journeyLabel: string,
): string {
  return (
    composeFineLabel(city, gu, dong, { lat, lng }, eupMyon) ??
    journeyLabel ??
    city ??
    gu ??
    dong ??
    eupMyon ??
    'Unknown'
  );
}

function toResolvedPlace(
  lat: number,
  lng: number,
  parsed: NonNullable<ReturnType<typeof parseGeocodedPlace>>,
): ResolvedPlace {
  // Address parse may leave 주문진읍 as city when 강릉시 is missing from fields.
  const liftedCity = liftEupMyonCity(parsed.city, lat, lng);
  const city = liftedCity ?? parsed.city;
  const promoted = Boolean(
    liftedCity && parsed.city && isEupMyonName(parsed.city),
  );
  // Keep the 읍·면 name after promoting city to parent 시.
  const rawEupMyon = parsed.eupMyon ?? (promoted ? parsed.city : null);
  const eupMyon = rawEupMyon && rawEupMyon !== city ? rawEupMyon : null;
  const journeyLabel = promoted
    ? parsed.gu
      ? `${liftedCity} - ${parsed.gu}`
      : liftedCity!
    : parsed.journeyLabel;

  return {
    key: placeBucketKey(lat, lng),
    lat: Number(lat.toFixed(BUCKET_DECIMALS)),
    lng: Number(lng.toFixed(BUCKET_DECIMALS)),
    province: parsed.province,
    city,
    gu: parsed.gu,
    eupMyon,
    dong: parsed.dong,
    journeyLabel,
    detailLabel: detailLabelFromParts(
      city,
      parsed.gu,
      parsed.dong,
      eupMyon,
      lat,
      lng,
      journeyLabel,
    ),
  };
}

export async function resolvePlace(
  lat: number,
  lng: number,
): Promise<ResolvedPlace | null> {
  const cached = peekResolvedPlace(lat, lng);
  if (cached) {
    return cached;
  }
  const key = placeCacheKey(lat, lng);
  const inflight = inflightPlace.get(key);
  if (inflight) {
    return inflight;
  }

  const task = reverseGeocode(lat, lng)
    .then((addr) => {
      const parsed = addr ? parseGeocodedPlace(addr) : null;
      if (!parsed?.journeyLabel) {
        return null;
      }
      const place = toResolvedPlace(lat, lng, parsed);
      storeResolvedPlace(key, place);
      return place;
    })
    .finally(() => {
      inflightPlace.delete(key);
    });
  inflightPlace.set(key, task);
  return task;
}

/** Pin sheet / playback title — same string journey chips use at fine grain. */
export async function resolveDetailLabel(
  lat: number,
  lng: number,
  options?: { requestPermission?: boolean },
): Promise<string | null> {
  const allowed = await ensurePlacePermission(
    options?.requestPermission !== false,
  );
  if (!allowed) {
    return null;
  }
  const place = await resolvePlace(lat, lng);
  return place?.detailLabel ?? null;
}

/**
 * Sync hydrate from memory/disk only — paints journey chips on cold start
 * before CLGeocoder runs.
 */
export function hydrateVisitPlacesFromPhotos(photos: PhotoRef[]): VisitPlace[] {
  if (photos.length === 0) {
    return [];
  }
  const buckets = collectBuckets(photos);
  const resolved = new Map<string, ResolvedPlace>();
  for (const bucket of buckets) {
    const place = peekResolvedPlace(bucket.lat, bucket.lng);
    if (place) {
      resolved.set(bucket.key, place);
    }
  }
  return collectVisitPlaces(buckets, resolved);
}

export type ResolveVisitPlacesOptions = {
  /** Paint chips as buckets land instead of one flush after the last geocode. */
  onProgress?: (places: VisitPlace[]) => void;
  /** Flip `cancelled` to stop geocoding when the month or filter changes. */
  signal?: { cancelled: boolean };
};

/**
 * Photos → VisitPlace[] for journey chips + stamp ingest. Cached buckets are
 * emitted first; the rest stream in one queued geocode at a time.
 */
export async function resolveVisitPlaces(
  photos: PhotoRef[],
  options?: ResolveVisitPlacesOptions,
): Promise<VisitPlace[]> {
  if (photos.length === 0) {
    return [];
  }

  const allowed = await ensurePlacePermission(true);
  if (!allowed) {
    return hydrateVisitPlacesFromPhotos(photos);
  }

  const buckets = collectBuckets(photos);
  const resolved = new Map<string, ResolvedPlace>();
  const pending: PlaceBucket[] = [];

  for (const bucket of buckets) {
    const cached = peekResolvedPlace(bucket.lat, bucket.lng);
    if (cached) {
      resolved.set(bucket.key, cached);
    } else {
      pending.push(bucket);
    }
  }

  let emitted = collectVisitPlaces(buckets, resolved);
  options?.onProgress?.(emitted);

  for (const bucket of pending) {
    if (options?.signal?.cancelled) {
      return emitted;
    }
    const place = await resolvePlace(bucket.lat, bucket.lng);
    if (!place) {
      continue;
    }
    resolved.set(bucket.key, place);
    const next = collectVisitPlaces(buckets, resolved);
    const grew = next.length !== emitted.length;
    emitted = next;
    if (grew) {
      options?.onProgress?.(emitted);
    }
  }

  return emitted;
}
