import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { getLastViewedMonth, setLastViewedMonth } from '@/lib/storage';
import { useIsPro } from '@/features/insights/hooks/useIsPro';

import type { MonthKey } from '../types';
import { monthKeySchema } from '../schema';
import { currentMonthKey } from '../utils/month';
import { canAccessMonth, clampMonthToAccess } from '../utils/monthAccess';

function resolveMonth(): MonthKey {
  const stored = getLastViewedMonth();
  if (stored) {
    const parsed = monthKeySchema.safeParse(stored);
    if (parsed.success) {
      return parsed.data;
    }
  }
  return currentMonthKey();
}

let currentMonth: MonthKey = resolveMonth();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): MonthKey {
  return currentMonth;
}

function setSharedMonth(next: MonthKey): void {
  const parsed = monthKeySchema.parse(next);
  if (parsed === currentMonth) {
    return;
  }
  currentMonth = parsed;
  setLastViewedMonth(parsed);
  emit();
}

/**
 * Shared viewed month across screens.
 * Free tier is limited to the last FREE_MONTH_WINDOW months unless isPro.
 */
export function useCurrentMonth(): {
  month: MonthKey;
  setMonth: (month: MonthKey) => void;
  canOpenMonth: (month: MonthKey) => boolean;
} {
  const { isPro } = useIsPro();
  const month = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Drop out of locked history if pro is turned off or the window slides.
  useEffect(() => {
    const next = clampMonthToAccess(month, isPro);
    if (next !== month) {
      setSharedMonth(next);
    }
  }, [isPro, month]);

  const setMonth = useCallback(
    (next: MonthKey) => {
      if (!canAccessMonth(next, isPro)) {
        return;
      }
      setSharedMonth(next);
    },
    [isPro],
  );

  const canOpenMonth = useCallback(
    (candidate: MonthKey) => canAccessMonth(candidate, isPro),
    [isPro],
  );

  return { month, setMonth, canOpenMonth };
}
