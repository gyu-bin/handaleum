import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

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

/**
 * `photos` is map-eligible (home removed); `allPhotos` is the full set.
 * Earning a pin and earning a place in the recap are different bars: home is
 * spatially uninformative on a map, but not unimportant to the month.
 */
export function useMonthlyPhotos(month: MonthKey, options?: { enabled?: boolean }) {
  const { home } = useHomeLocation();
  const query = useQuery({
    queryKey: photosQueryKeys.monthly(month),
    queryFn: () => loadMonthlyPhotos(month),
    enabled: options?.enabled ?? true,
  });

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
  });
}
