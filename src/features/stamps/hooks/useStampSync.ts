import { useEffect, useRef } from 'react';

import type { MonthKey, VisitPlace } from '@/features/photos/types';

import { syncStampsFromVisits } from '../services/stampsStorage';
import { notifyStampsChanged } from './useStamps';

/**
 * When the month map already has resolved visit places, merge new 시군구
 * stamps. Idempotent; safe to call on every places update.
 */
export function useStampSync(month: MonthKey, places: VisitPlace[]): void {
  const placesRef = useRef(places);
  placesRef.current = places;

  useEffect(() => {
    if (places.length === 0) {
      return;
    }
    const result = syncStampsFromVisits(month, places);
    if (result.added.length > 0) {
      notifyStampsChanged();
    }
  }, [month, places]);
}
