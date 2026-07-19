/**
 * Drops photos taken at home from a month's set.
 * Home is a point + radius rather than a place bucket because a home spills
 * across several ~110m geocode buckets (the flat, the front door, the block).
 */
import type { HomeLocation, PhotoRef } from '../types';

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Haversine great-circle distance in metres. */
export function distanceMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isAtHome(photo: PhotoRef, home: HomeLocation): boolean {
  return (
    distanceMeters(photo.lat, photo.lng, home.lat, home.lng) <= home.radiusM
  );
}

/**
 * Returns the kept photos plus how many were dropped, so the UI can tell the
 * user their photos were filtered rather than silently missing.
 */
export function excludeHomePhotos(
  photos: PhotoRef[],
  home: HomeLocation | null,
): { photos: PhotoRef[]; homeExcludedCount: number } {
  if (!home) {
    return { photos, homeExcludedCount: 0 };
  }
  const kept = photos.filter((photo) => !isAtHome(photo, home));
  return { photos: kept, homeExcludedCount: photos.length - kept.length };
}
