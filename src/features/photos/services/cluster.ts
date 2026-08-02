import type { PhotoRef, PlaceCluster } from '../types';

/**
 * Soft cap on visible pins so the paper map stays readable.
 * Overview (~zoom 8) ≈ 30 pins; deep zoom allows more detail.
 */
function maxPinsForZoom(zoom: number): number {
  const z = Math.max(6, Math.min(18, zoom));
  // Soft cap: overview stays readable; deep zoom still bounded for native memory.
  return Math.round(20 + (z - 6) * 8); // 20 @6 → 68 @12 → 116 @18
}

/** Starting cell size in degrees from map zoom (~km/111). */
function cellDegForZoom(zoom: number): number {
  // Broader than the old haversine radius — overview should read as cities, not dots.
  const radiusKm = Math.max(1.2, 90 / 2 ** Math.max(0, zoom - 6));
  return Math.max(radiusKm / 111, 0.008);
}

/**
 * Sticky cell size per zoom bucket. Progressive GPS used to grow cellDeg and
 * remount every marker (cancelling thumb exports). We only allow cellDeg to
 * increase within a zoom; month change clears via resetClusterCellCache().
 */
const stickyCellDegByZoom = new Map<number, number>();

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
 */
export function clusterPhotos(photos: PhotoRef[], zoom: number): PlaceCluster[] {
  if (photos.length === 0) {
    return [];
  }

  const maxPins = maxPinsForZoom(zoom);
  const zKey = Math.round(zoom);
  const sticky = stickyCellDegByZoom.get(zKey);
  let cellDeg = sticky ?? cellDegForZoom(zoom);
  let clusters = gridCluster(photos, cellDeg);

  let guard = 0;
  while (clusters.length > maxPins && guard < 14) {
    cellDeg *= 1.55;
    clusters = gridCluster(photos, cellDeg);
    guard += 1;
  }

  const prev = stickyCellDegByZoom.get(zKey);
  if (prev == null || cellDeg >= prev) {
    stickyCellDegByZoom.set(zKey, cellDeg);
  } else {
    // Keep the coarser sticky grain so progressive fill doesn't remount pins.
    cellDeg = prev;
    clusters = gridCluster(photos, cellDeg);
  }

  return clusters;
}

/** Call when the viewed month changes so sticky grain doesn't leak across months. */
export function resetClusterCellCache(): void {
  stickyCellDegByZoom.clear();
}
