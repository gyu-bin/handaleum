import { useEffect, useRef, useState } from 'react';

import type { MonthKey } from '@/features/photos/types';

import { runStampBackfill } from '../services/stampBackfill';
import { isStampsBackfillDone } from '../services/stampsStorage';

/**
 * Runs one-shot full-library stamp backfill on mount when not yet done.
 */
export function useStampBackfill(month: MonthKey): {
  backfilling: boolean;
} {
  const [backfilling, setBackfilling] = useState(() => !isStampsBackfillDone());
  const started = useRef(false);

  useEffect(() => {
    if (started.current || isStampsBackfillDone()) {
      setBackfilling(false);
      return;
    }
    started.current = true;
    setBackfilling(true);
    void runStampBackfill(month)
      .catch((error) => {
        console.warn('[stamps] backfill failed', error);
      })
      .finally(() => {
        setBackfilling(false);
      });
  }, [month]);

  return { backfilling };
}
