import type { PlaceCluster } from '../types';

export type PathCoord = { latitude: number; longitude: number };

/** Point on the journey polyline with a visit-order number (1…N). */
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
 * Visit-order labels on the polyline (not under photo pins).
 * 1 sits a short walk from the first pin; 2…N sit near each arrival along the hop.
 */
export function journeyPathSteps(clusters: PlaceCluster[]): PathOrderStep[] {
  const coords = orderedPathCoords(clusters);
  if (coords.length < 2) {
    return [];
  }

  const steps: PathOrderStep[] = [];
  const first = coords[0]!;
  const second = coords[1]!;
  steps.push({
    latitude: first.latitude * 0.75 + second.latitude * 0.25,
    longitude: first.longitude * 0.75 + second.longitude * 0.25,
    order: 1,
  });

  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i]!;
    const b = coords[i + 1]!;
    steps.push({
      latitude: a.latitude * 0.25 + b.latitude * 0.75,
      longitude: a.longitude * 0.25 + b.longitude * 0.75,
      order: i + 2,
    });
  }
  return steps;
}
