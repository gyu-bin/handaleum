import { useEffect, useRef } from 'react';

import type { MonthKey, VisitPlace } from '@/features/photos/types';

import { syncStampsFromVisits } from '../services/stampsStorage';
import { notifyStampsChanged } from './useStamps';

/**
 * When the month map already has resolved visit places, merge new 시군구
 * stamps. Also prunes illegal parent-city stamps. Idempotent.
 */
export function useStampSync(month: MonthKey, places: VisitPlace[]): void {
  const placesRef = useRef(places);
  placesRef.current = places;

  useEffect(() => {
    const result = syncStampsFromVisits(places, { month });
    if (result.added.length > 0 || result.pruned.length > 0) {
      notifyStampsChanged();
    }
  }, [month, places]);
}
