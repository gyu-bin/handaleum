import { useEffect, useMemo, useState } from 'react';

import { clusterPhotos } from '@/features/photos/services/cluster';
import { useHomeLocation } from '@/features/photos/hooks/useHomeLocation';
import { useMonthJourney } from '@/features/photos/hooks/useMonthJourney';
import { useMonthlyPhotos } from '@/features/photos/hooks/useMonthlyPhotos';
import type { MonthKey } from '@/features/photos/types';
import { resolveClusterDetailLabel } from '@/features/photos/utils/placeJourney';

import type { MonthlyInsights } from '../types';
import {
  computeInsights,
  INSIGHTS_CLUSTER_ZOOM,
} from '../services/computeInsights';
import {
  mergePlaceFirstSeen,
  readPlaceFirstSeen,
} from '../services/placeFirstSeenStorage';

/**
 * Assembles monthly insight metrics. Journey places mirror the map header chips.
 * Cluster detail labels resolve asynchronously (cached buckets).
 */
export function useMonthlyInsights(month: MonthKey): {
  insights: MonthlyInsights | null;
  isPending: boolean;
  isError: boolean;
  isEmpty: boolean;
  isResolvingLabels: boolean;
  refetch: () => void;
} {
  const { home } = useHomeLocation();
  const {
    data,
    isPending,
    isError,
    refetch,
  } = useMonthlyPhotos(month);
  const photos = useMemo(() => data?.photos ?? [], [data?.photos]);
  const { places: journeyPlaces, isResolving: journeyResolving } =
    useMonthJourney(photos);

  const clusters = useMemo(
    () => clusterPhotos(photos, INSIGHTS_CLUSTER_ZOOM),
    [photos],
  );

  const [firstSeen, setFirstSeen] = useState(() => readPlaceFirstSeen());

  // Merge first-seen index when journey labels settle for this month.
  useEffect(() => {
    if (journeyResolving || journeyPlaces.length === 0) {
      return;
    }
    const next = mergePlaceFirstSeen(month, journeyPlaces);
    setFirstSeen(next);
  }, [month, journeyPlaces, journeyResolving]);

  const metrics = useMemo(() => {
    if (!data) {
      return null;
    }
    return computeInsights({
      month,
      photos,
      journeyPlaces,
      clusters,
      home,
      placeFirstSeen: firstSeen,
    });
  }, [data, month, photos, journeyPlaces, clusters, home, firstSeen]);

  const [farthestLabel, setFarthestLabel] = useState<string | null>(null);
  const [topLabel, setTopLabel] = useState<string | null>(null);
  const [labelsResolving, setLabelsResolving] = useState(false);

  const farthestKey = metrics?.farthest
    ? `${metrics.farthest.centerLat.toFixed(3)},${metrics.farthest.centerLng.toFixed(3)}`
    : '';
  const topKey = metrics?.topPlace
    ? `${metrics.topPlace.centerLat.toFixed(3)},${metrics.topPlace.centerLng.toFixed(3)}`
    : '';

  useEffect(() => {
    let cancelled = false;
    const farthest = metrics?.farthest;
    const top = metrics?.topPlace;

    if (!farthest && !top) {
      setFarthestLabel(null);
      setTopLabel(null);
      setLabelsResolving(false);
      return;
    }

    setLabelsResolving(true);
    void (async () => {
      const [fLabel, tLabel] = await Promise.all([
        farthest
          ? resolveClusterDetailLabel(farthest.centerLat, farthest.centerLng)
          : Promise.resolve(null),
        top
          ? resolveClusterDetailLabel(top.centerLat, top.centerLng)
          : Promise.resolve(null),
      ]);
      if (!cancelled) {
        setFarthestLabel(fLabel);
        setTopLabel(tLabel);
        setLabelsResolving(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by coord buckets
  }, [farthestKey, topKey]);

  const insights: MonthlyInsights | null = useMemo(() => {
    if (!metrics) {
      return null;
    }
    return {
      ...metrics,
      farthestLabeled: metrics.farthest
        ? {
            ...metrics.farthest,
            label: farthestLabel,
            distanceKm: Math.round(metrics.farthest.distanceM / 1000),
          }
        : null,
      topPlaceLabeled: metrics.topPlace
        ? {
            ...metrics.topPlace,
            label: topLabel,
          }
        : null,
    };
  }, [metrics, farthestLabel, topLabel]);

  const isEmpty = Boolean(data && photos.length === 0);

  return {
    insights,
    isPending,
    isError,
    isEmpty,
    isResolvingLabels: journeyResolving || labelsResolving,
    refetch: () => {
      void refetch();
    },
  };
}
