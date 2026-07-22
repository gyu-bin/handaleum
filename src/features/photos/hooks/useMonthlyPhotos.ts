import { useEffect, useMemo } from 'react';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { queryClient } from '@/lib/queryClient';

import { loadMonthlyPhotos, loadMonthSummaries } from '../services/mediaLibrary';
import type { MonthKey, MonthlyPhotos, PhotoRef } from '../types';
import { excludeHomePhotos } from '../utils/homeFilter';
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

/** Warm the React Query cache for a month (picker tap / neighbor prefetch). */
export function prefetchMonthlyPhotos(month: MonthKey): void {
  void queryClient.prefetchQuery({
    queryKey: photosQueryKeys.monthly(month),
    queryFn: () => loadMonthlyPhotos(month),
  });
}

/**
 * `photos` is map-eligible (home removed); `allPhotos` is the full set.
 * Earning a pin and earning a place in the recap are different bars: home is
 * spatially uninformative on a map, but not unimportant to the month.
 */
export function useMonthlyPhotos(month: MonthKey, options?: { enabled?: boolean }) {
  const { home } = useHomeLocation();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: photosQueryKeys.monthly(month),
    queryFn: () => loadMonthlyPhotos(month),
    enabled: options?.enabled ?? true,
    // Keep the previous month on screen while the next one loads — avoids a
    // full-screen spinner flash when switching months.
    placeholderData: keepPreviousData,
  });

  // Prefetch adjacent months in the summaries list (prev/next by key sort).
  useEffect(() => {
    if (!query.isSuccess || !(options?.enabled ?? true)) {
      return;
    }
    const summaries = client.getQueryData<{ month: MonthKey }[]>(
      photosQueryKeys.summaries,
    );
    if (!summaries || summaries.length === 0) {
      return;
    }
    const idx = summaries.findIndex((s) => s.month === month);
    if (idx < 0) {
      return;
    }
    const neighbors = [summaries[idx - 1]?.month, summaries[idx + 1]?.month].filter(
      (m): m is MonthKey => m != null && m !== month,
    );
    for (const neighbor of neighbors) {
      prefetchMonthlyPhotos(neighbor);
    }
  }, [client, month, options?.enabled, query.isSuccess]);

  const data: MonthlyPhotosData | undefined = useMemo(() => {
    if (!query.data) {
      return undefined;
    }
    const { photos, homeExcludedCount } = excludeHomePhotos(
      query.data.photos,
      home,
    );
    return {
      ...query.data,
      photos,
      allPhotos: query.data.photos,
      homeExcludedCount,
    };
  }, [query.data, home]);

  return { ...query, data };
}

export function useMonthSummaries() {
  return useQuery({
    queryKey: photosQueryKeys.summaries,
    queryFn: loadMonthSummaries,
    staleTime: 10 * 60 * 1000,
  });
}
