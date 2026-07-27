import type { PlaceCluster } from '../types';

export type PathCoord = { latitude: number; longitude: number };

/**
 * Cluster centers in first-visit order (earliest photo in each pin).
 * Used for the home-map journey polyline — not every photo, just place pins.
 */
export function journeyPathCoords(clusters: PlaceCluster[]): PathCoord[] {
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

  return coords.length >= 2 ? coords : [];
}
