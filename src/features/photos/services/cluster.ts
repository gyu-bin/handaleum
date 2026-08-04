import type { PhotoRef, PlaceCluster } from '../types';

/**
 * Soft cap on visible pins so the paper map stays readable.
 * Overview (~zoom 8) ≈ 30 pins; deep zoom allows more detail.
 */
function maxPinsForZoom(zoom: number): number {
  const z = Math.max(6, Math.min(18, zoom));
  // Slightly higher than before — nearby neighborhoods were getting swallowed
  // when progressive GPS briefly looked "nationwide" and coarsened the grid.
  return Math.round(28 + (z - 6) * 10); // 28 @6 → 88 @12 → 148 @18
}

/** Starting cell size in degrees from map zoom (~km/111). */
function cellDegForZoom(zoom: number): number {
  // Broader than the old haversine radius — overview should read as cities, not dots.
  const radiusKm = Math.max(1.0, 70 / 2 ** Math.max(0, zoom - 6));
  return Math.max(radiusKm / 111, 0.006);
}

/**
 * Last successful grain per zoom bucket — used only to keep marker ids stable
 * when the ideal grain is unchanged. Never blocks refining to a finer grid
 * (that was swallowing nearby places after progressive GPS / time-filter).
 */
const lastGrainByZoom = new Map<number, number>();

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
  // Id = grid cell only (not member count / seed). Progressive GPS and
  // time-slider updates must not remount markers or cancel in-flight thumbs.
  const grain = cellDeg.toFixed(6);
  for (const [cellKey, members] of cells.entries()) {
    members.sort((a, b) => a.takenAt.localeCompare(b.takenAt));
    const centerLat =
      members.reduce((sum, p) => sum + p.lat, 0) / members.length;
    const centerLng =
      members.reduce((sum, p) => sum + p.lng, 0) / members.length;
    clusters.push({
      id: `${grain}:${cellKey}`,
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
 *
 * Always recompute from the natural zoom grain first so progressive GPS /
 * time-filter changes can refine again. Sticky coarsening used to lock a
 * huge cell forever and merge distinct nearby places into one pin.
 */
export function clusterPhotos(photos: PhotoRef[], zoom: number): PlaceCluster[] {
  if (photos.length === 0) {
    return [];
  }

  const maxPins = maxPinsForZoom(zoom);
  const zKey = Math.round(zoom);
  let cellDeg = cellDegForZoom(zoom);
  let clusters = gridCluster(photos, cellDeg);

  let guard = 0;
  while (clusters.length > maxPins && guard < 14) {
    cellDeg *= 1.45;
    clusters = gridCluster(photos, cellDeg);
    guard += 1;
  }

  // If the ideal grain matches last time (within ~5%), reuse it so marker
  // ids stay stable across tiny photo-set churn without blocking refine.
  const prev = lastGrainByZoom.get(zKey);
  if (prev != null && Math.abs(prev - cellDeg) / cellDeg < 0.05) {
    cellDeg = prev;
    clusters = gridCluster(photos, cellDeg);
  }

  lastGrainByZoom.set(zKey, cellDeg);
  return clusters;
}

/** Call when the viewed month changes so grain doesn't leak across months. */
export function resetClusterCellCache(): void {
  lastGrainByZoom.clear();
}
