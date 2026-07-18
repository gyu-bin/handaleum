import { useQuery } from '@tanstack/react-query';

import { loadMonthlyPhotos, loadMonthSummaries } from '../services/mediaLibrary';
import type { MonthKey } from '../types';
import { photosQueryKeys } from './photosQueryKeys';

export function useMonthlyPhotos(month: MonthKey, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: photosQueryKeys.monthly(month),
    queryFn: () => loadMonthlyPhotos(month),
    enabled: options?.enabled ?? true,
  });
}

export function useMonthSummaries() {
  return useQuery({
    queryKey: photosQueryKeys.summaries,
    queryFn: loadMonthSummaries,
  });
}
