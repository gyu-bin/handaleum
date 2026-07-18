import type { PhotoRef, PlaceCluster } from '../types';

const EARTH_RADIUS_KM = 6371;

function haversineKm(a: PhotoRef, b: PhotoRef): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Approximate cluster radius in km from map zoom. */
function radiusKmForZoom(zoom: number): number {
  return Math.max(0.04, 48 / 2 ** Math.max(0, zoom - 8));
}

/**
 * Group nearby photos into map pins. Pure function, computed at read time,
 * never persisted (spec A-2). Cluster radius depends on zoom level.
 */
export function clusterPhotos(photos: PhotoRef[], zoom: number): PlaceCluster[] {
  const radiusKm = radiusKmForZoom(zoom);
  const remaining = [...photos].sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  const clusters: PlaceCluster[] = [];

  while (remaining.length > 0) {
    const seed = remaining.shift()!;
    const members: PhotoRef[] = [seed];

    for (let i = remaining.length - 1; i >= 0; i -= 1) {
      if (haversineKm(seed, remaining[i]!) <= radiusKm) {
        members.push(remaining[i]!);
        remaining.splice(i, 1);
      }
    }

    const centerLat = members.reduce((sum, p) => sum + p.lat, 0) / members.length;
    const centerLng = members.reduce((sum, p) => sum + p.lng, 0) / members.length;
    const id = members
      .map((p) => p.assetId)
      .sort()
      .join('|')
      .slice(0, 120);

    clusters.push({
      id,
      centerLat,
      centerLng,
      photos: members.sort((a, b) => a.takenAt.localeCompare(b.takenAt)),
    });
  }

  return clusters;
}
