import type { HomeLocation, MonthKey, PhotoRef, PlaceCluster } from '@/features/photos/types';
import { distanceMeters } from '@/features/photos/utils/homeFilter';

import {
  countDistinctMonthsInIndex,
  type PlaceFirstSeenMap,
} from './placeFirstSeenStorage';

/** Fixed zoom so insights don't depend on the map camera. */
export const INSIGHTS_CLUSTER_ZOOM = 12;

export type FarthestCandidate = {
  centerLat: number;
  centerLng: number;
  distanceM: number;
};

export type TopPlaceCandidate = {
  centerLat: number;
  centerLng: number;
  photoCount: number;
};

export type BusiestDay = {
  /** Local calendar date YYYY-MM-DD */
  date: string;
  count: number;
};

/**
 * Pure insight metrics before async place labels are attached.
 * `newPlacesCount` is null when the first-seen index is still cold-starting.
 */
export type InsightsMetrics = {
  placesCount: number;
  newPlacesCount: number | null;
  farthest: FarthestCandidate | null;
  topPlace: TopPlaceCandidate | null;
  /** Straight-line chain of cluster centers; null if fewer than 2 clusters. */
  approxDistanceKm: number | null;
  busiestDay: BusiestDay | null;
};

function localDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Pure computation — no I/O. Labels for farthest/topPlace are resolved in the hook.
 */
export function computeInsights(input: {
  month: MonthKey;
  photos: PhotoRef[];
  journeyPlaces: string[];
  clusters: PlaceCluster[];
  home: HomeLocation | null;
  placeFirstSeen: PlaceFirstSeenMap;
}): InsightsMetrics {
  const { month, photos, journeyPlaces, clusters, home, placeFirstSeen } = input;

  const placesCount = journeyPlaces.length;

  const monthsInIndex = countDistinctMonthsInIndex(placeFirstSeen);
  let newPlacesCount: number | null = null;
  if (monthsInIndex >= 2) {
    newPlacesCount = journeyPlaces.filter(
      (label) => placeFirstSeen[label] === month,
    ).length;
  }

  let farthest: FarthestCandidate | null = null;
  if (home && clusters.length > 0) {
    for (const cluster of clusters) {
      const m = distanceMeters(
        home.lat,
        home.lng,
        cluster.centerLat,
        cluster.centerLng,
      );
      if (!farthest || m > farthest.distanceM) {
        farthest = {
          centerLat: cluster.centerLat,
          centerLng: cluster.centerLng,
          distanceM: m,
        };
      }
    }
  }

  let topPlace: TopPlaceCandidate | null = null;
  for (const cluster of clusters) {
    const n = cluster.photos.length;
    if (!topPlace || n > topPlace.photoCount) {
      topPlace = {
        centerLat: cluster.centerLat,
        centerLng: cluster.centerLng,
        photoCount: n,
      };
    }
  }

  let approxDistanceKm: number | null = null;
  if (clusters.length >= 2) {
    const ordered = [...clusters].sort((a, b) => {
      const a0 = a.photos[0]?.takenAt ?? '';
      const b0 = b.photos[0]?.takenAt ?? '';
      return a0.localeCompare(b0);
    });
    let sumM = 0;
    for (let i = 1; i < ordered.length; i += 1) {
      const prev = ordered[i - 1]!;
      const curr = ordered[i]!;
      sumM += distanceMeters(
        prev.centerLat,
        prev.centerLng,
        curr.centerLat,
        curr.centerLng,
      );
    }
    approxDistanceKm = Math.round(sumM / 1000);
  }

  let busiestDay: BusiestDay | null = null;
  if (photos.length > 0) {
    const byDay = new Map<string, number>();
    for (const photo of photos) {
      const key = localDateKey(photo.takenAt);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }
    for (const [date, count] of byDay) {
      if (!busiestDay || count > busiestDay.count) {
        busiestDay = { date, count };
      }
    }
  }

  return {
    placesCount,
    newPlacesCount,
    farthest,
    topPlace,
    approxDistanceKm,
    busiestDay,
  };
}
