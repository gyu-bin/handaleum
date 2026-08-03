import { placeBucketKey } from '../services/placeCache';
import type {
  PhotoRef,
  ResolvedPlace,
  VisitAdminLevel,
  VisitPlace,
} from '../types';

/**
 * Pure assembly of journey buckets → VisitPlace[]. No geocoding, no cache
 * access, so the ordering and dedupe rules can be reasoned about on their own.
 */

export type PlaceBucket = {
  key: string;
  lat: number;
  lng: number;
  firstTakenAt: string;
};

/**
 * Photos → distinct ~110m buckets, in first-visit order.
 *
 * lat/lng is a REAL photo coordinate, not the rounded cell center: geocoding
 * the rounded point can land ~78m into the neighbouring 리 (교항리→주문리 at
 * the 주문진항 boundary), which then dedupes the whole village away. Apple
 * Photos geocodes exact coordinates — so must we. The cache key still rounds,
 * so nearby photos keep sharing one geocode call.
 */
export function collectBuckets(photos: PhotoRef[]): PlaceBucket[] {
  const map = new Map<string, PlaceBucket>();
  for (const photo of photos) {
    const key = placeBucketKey(photo.lat, photo.lng);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        lat: photo.lat,
        lng: photo.lng,
        firstTakenAt: photo.takenAt,
      });
    } else if (photo.takenAt < existing.firstTakenAt) {
      existing.firstTakenAt = photo.takenAt;
    }
  }
  return [...map.values()].sort((a, b) =>
    a.firstTakenAt.localeCompare(b.firstTakenAt),
  );
}

function visitPlaceFromResolved(
  bucket: PlaceBucket,
  place: ResolvedPlace,
): VisitPlace {
  const level: VisitAdminLevel =
    place.gu || place.dong || place.eupMyon
      ? 'dong'
      : place.city
        ? 'city'
        : 'province';
  return {
    key: bucket.key,
    label: place.detailLabel,
    level,
    province: place.province ?? undefined,
    city: place.city ?? undefined,
    gu: place.gu ?? undefined,
    eupMyon: place.eupMyon ?? undefined,
    dong: place.dong ?? undefined,
    firstTakenAt: bucket.firstTakenAt,
  };
}

/** Finest admin identity — must include 읍·면·동 or rural chips collapse to 시. */
function placeIdentity(place: ResolvedPlace): string {
  return (
    [place.city, place.gu, place.eupMyon, place.dong]
      .filter(Boolean)
      .join('|') || place.detailLabel
  );
}

/** One VisitPlace per distinct admin identity, earliest bucket wins. */
export function collectVisitPlaces(
  buckets: PlaceBucket[],
  resolved: Map<string, ResolvedPlace>,
): VisitPlace[] {
  const out: VisitPlace[] = [];
  const seen = new Set<string>();
  for (const bucket of buckets) {
    const place = resolved.get(bucket.key);
    if (!place?.journeyLabel) {
      continue;
    }
    const identity = placeIdentity(place);
    if (seen.has(identity)) {
      continue;
    }
    seen.add(identity);
    out.push(visitPlaceFromResolved(bucket, place));
  }
  return out;
}
