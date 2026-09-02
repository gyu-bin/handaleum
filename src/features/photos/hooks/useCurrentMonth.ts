import { useCallback, useEffect, useSyncExternalStore } from 'react';

import {
  getLastCalendarMonth,
  getLastViewedMonth,
  setLastCalendarMonth,
  setLastViewedMonth,
} from '@/lib/storage';
import { useIsPro } from '@/features/insights/hooks/useIsPro';

import type { MonthKey } from '../types';
import { monthKeySchema } from '../schema';
import { subscribeAppForeground } from '../services/appForeground';
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

/**
 * When the device calendar month advances, land on this month even if empty.
 * Same-month browsing of older months is kept until the next rollover.
 */
function alignViewedMonthToCalendar(): void {
  const cal = currentMonthKey();
  if (getLastCalendarMonth() === cal) {
    return;
  }
  setLastCalendarMonth(cal);
  setSharedMonth(cal);
}

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

/** Latest shared month — safe inside press handlers (survives rapid taps). */
export function getSharedMonth(): MonthKey {
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

alignViewedMonthToCalendar();
subscribeAppForeground((active) => {
  if (active) {
    alignViewedMonthToCalendar();
  }
});

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
