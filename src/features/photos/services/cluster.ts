import type { PhotoRef, PlaceCluster } from '../types';

/**
 * Soft cap on visible pins so the paper map stays readable.
 * Overview (~zoom 8) ≈ 30 pins; deep zoom allows more detail.
 */
function maxPinsForZoom(zoom: number): number {
  const z = Math.max(6, Math.min(18, zoom));
  return Math.round(24 + (z - 6) * 10); // 24 @6 → 84 @12 → 144 @18
}

/** Starting cell size in degrees from map zoom (~km/111). */
function cellDegForZoom(zoom: number): number {
  // Broader than the old haversine radius — overview should read as cities, not dots.
  const radiusKm = Math.max(1.2, 90 / 2 ** Math.max(0, zoom - 6));
  return Math.max(radiusKm / 111, 0.008);
}

function gridCluster(photos: PhotoRef[], cellDeg: number): PlaceCluster[] {
  const cells = new Map<string, PhotoRef[]>();

  for (const photo of photos) {
    const row = Math.floor(photo.lat / cellDeg);
    const col = Math.floor(photo.lng / cellDeg);
    const key = `${row}:${col}`;
    const bucket = cells.get(key);
    if (bucket) {
      bucket.push(photo);
    } else {
      cells.set(key, [photo]);
    }
  }

  const clusters: PlaceCluster[] = [];
  for (const members of cells.values()) {
    members.sort((a, b) => a.takenAt.localeCompare(b.takenAt));
    const centerLat =
      members.reduce((sum, p) => sum + p.lat, 0) / members.length;
    const centerLng =
      members.reduce((sum, p) => sum + p.lng, 0) / members.length;
    const seedId = members[0]!.assetId;
    clusters.push({
      id: `${centerLat.toFixed(4)},${centerLng.toFixed(4)}:${members.length}:${seedId}`,
      centerLat,
      centerLng,
      photos: members,
    });
  }

  return clusters;
}

/**
 * Group nearby photos into map pins. Pure function, computed at read time,
 * never persisted (spec A-2).
 *
 * Spatial grid (O(n)). If the first pass still yields too many pins for the
 * current zoom (sparse nationwide scatter), grow the cell until under the cap
 * so the map stays an infographic — not a pin carpet.
 */
export function clusterPhotos(photos: PhotoRef[], zoom: number): PlaceCluster[] {
  if (photos.length === 0) {
    return [];
  }

  const maxPins = maxPinsForZoom(zoom);
  let cellDeg = cellDegForZoom(zoom);
  let clusters = gridCluster(photos, cellDeg);

  let guard = 0;
  while (clusters.length > maxPins && guard < 14) {
    cellDeg *= 1.55;
    clusters = gridCluster(photos, cellDeg);
    guard += 1;
  }

  return clusters;
}
