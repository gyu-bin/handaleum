import type { PlaceCluster } from '../types';

export type PathCoord = { latitude: number; longitude: number };

/** Midpoint on the journey polyline with the arrival pin's visit order. */
export type PathOrderStep = PathCoord & { order: number };

/**
 * Cluster centers in first-visit order (earliest photo in each pin).
 * Dedupes identical coordinates so the polyline doesn't stall.
 */
function orderedPathCoords(clusters: PlaceCluster[]): PathCoord[] {
  if (clusters.length < 2) {
    return [];
  }

  const sorted = [...clusters].sort((a, b) => {
    const aAt = a.photos[0]?.takenAt ?? '';
    const bAt = b.photos[0]?.takenAt ?? '';
    return aAt.localeCompare(bAt);
  });

  const coords: PathCoord[] = [];
  for (const cluster of sorted) {
    const next: PathCoord = {
      latitude: cluster.centerLat,
      longitude: cluster.centerLng,
    };
    const prev = coords[coords.length - 1];
    if (
      prev &&
      prev.latitude === next.latitude &&
      prev.longitude === next.longitude
    ) {
      continue;
    }
    coords.push(next);
  }

  return coords;
}

/**
 * Cluster centers in first-visit order (earliest photo in each pin).
 * Used for the home-map journey polyline — not every photo, just place pins.
 */
export function journeyPathCoords(clusters: PlaceCluster[]): PathCoord[] {
  const coords = orderedPathCoords(clusters);
  return coords.length >= 2 ? coords : [];
}

/**
 * Midpoints of each hop with the arrival visit number (2…N).
 * Same ordering as `journeyPathCoords` — numbers grow in travel direction.
 */
export function journeyPathSteps(clusters: PlaceCluster[]): PathOrderStep[] {
  const coords = orderedPathCoords(clusters);
  if (coords.length < 2) {
    return [];
  }

  const steps: PathOrderStep[] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i]!;
    const b = coords[i + 1]!;
    steps.push({
      latitude: (a.latitude + b.latitude) / 2,
      longitude: (a.longitude + b.longitude) / 2,
      order: i + 2,
    });
  }
  return steps;
}
