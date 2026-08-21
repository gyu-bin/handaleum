import { useEffect, useMemo } from 'react';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { queryClient } from '@/lib/queryClient';

import {
  releaseIndexingBackground,
  retainIndexingBackground,
} from '../services/indexingBackground';
import {
  isFullAlbumScanBusy,
  loadMonthlyPhotos,
  loadMonthSummaries,
} from '../services/mediaLibrary';
import { startMonthWarmup } from '../services/monthWarmup';
import type { MonthKey, MonthlyPhotos, PhotoRef } from '../types';
import { withoutHiddenPhotos } from '../utils/withoutHiddenPhotos';
import { excludeHomePhotos } from '../utils/homeFilter';
import { isKoreaLatLng } from '../utils/koreaBounds';
import { useHiddenPhotos } from './useHiddenPhotos';
import { useHomeLocation } from './useHomeLocation';
import { photosQueryKeys } from './photosQueryKeys';

export interface MonthlyPhotosData extends MonthlyPhotos {
  /**
   * Every GPS photo in the month, home included — what the recap may draw on.
   * Card selection uses this: a photo taken at home can still be the shot of
   * the month (decision 2026-07-19).
   */
  allPhotos: PhotoRef[];
  /** How many of `allPhotos` sit at home and so are missing from `photos`. */
  homeExcludedCount: number;
}

async function loadMonthKeepingAlive(
  month: MonthKey,
  onPartial: (partial: MonthlyPhotos) => void,
): Promise<MonthlyPhotos> {
  retainIndexingBackground();
  try {
    return await loadMonthlyPhotos(month, {
      onPartial,
      // Keep going when backgrounded; only pause if full-album stamp owns MediaLibrary.
      shouldContinue: () => !isFullAlbumScanBusy(),
    });
  } finally {
    releaseIndexingBackground();
  }
}

/** Warm the React Query cache for a month (picker tap / neighbor prefetch). */
export function prefetchMonthlyPhotos(month: MonthKey): void {
  void queryClient.prefetchQuery({
    queryKey: photosQueryKeys.monthly(month),
    queryFn: () =>
      loadMonthKeepingAlive(month, (partial) => {
        queryClient.setQueryData(photosQueryKeys.monthly(month), partial);
      }),
  });
}

/**
 * `photos` is map-eligible (home removed); `allPhotos` is the full set.
 * Earning a pin and earning a place in the recap are different bars: home is
 * spatially uninformative on a map, but not unimportant to the month.
 */
export function useMonthlyPhotos(month: MonthKey, options?: { enabled?: boolean }) {
  const { home } = useHomeLocation();
  const { hidden } = useHiddenPhotos(month);
  const client = useQueryClient();
  const enabled = options?.enabled ?? true;
  const query = useQuery({
    queryKey: photosQueryKeys.monthly(month),
    queryFn: () =>
      loadMonthKeepingAlive(month, (partial) => {
        client.setQueryData(photosQueryKeys.monthly(month), partial);
      }),
    enabled,
    // Keep the previous month on screen while the next one loads — avoids a
    // full-screen spinner flash when switching months.
    placeholderData: keepPreviousData,
  });

  // Neighbors first — don't wait 6s / session-once for ‹ › to feel instant.
  useEffect(() => {
    if (!enabled || !query.isSuccess || query.isFetching || query.isPlaceholderData) {
      return;
    }
    const timer = setTimeout(() => {
      startMonthWarmup(month);
    }, 800);
    return () => clearTimeout(timer);
  }, [
    enabled,
    month,
    query.isSuccess,
    query.isFetching,
    query.isPlaceholderData,
  ]);

  const data: MonthlyPhotosData | undefined = useMemo(() => {
    if (!query.data) {
      return undefined;
    }
    const { photos: notHome, homeExcludedCount } = excludeHomePhotos(
      query.data.photos,
      home,
    );
    // Map pins are domestic-only; cards still use allPhotos (incl. overseas).
    const photos = withoutHiddenPhotos(
      notHome.filter((p) => isKoreaLatLng(p.lat, p.lng)),
      hidden,
    );
    return {
      ...query.data,
      photos,
      allPhotos: query.data.photos,
      homeExcludedCount,
      noLocationPhotos: query.data.noLocationPhotos ?? [],
      noLocationCount:
        query.data.noLocationPhotos?.length ?? query.data.noLocationCount ?? 0,
    };
  }, [hidden, query.data, home]);

  return {
    ...query,
    data,
    /** True while showing the previous month under a new month key. */
    isStaleMonth: Boolean(query.isPlaceholderData),
  };
}

export function useMonthSummaries() {
  return useQuery({
    queryKey: photosQueryKeys.summaries,
    queryFn: loadMonthSummaries,
    staleTime: 10 * 60 * 1000,
  });
}
