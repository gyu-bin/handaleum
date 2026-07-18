import { useCallback, useSyncExternalStore } from 'react';

import { getLastViewedMonth, setLastViewedMonth } from '@/lib/storage';

import type { MonthKey } from '../types';
import { monthKeySchema } from '../schema';
import { currentMonthKey } from '../utils/month';

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
 * Persists to sqlite kv-store; syncs via useSyncExternalStore so the map
 * updates after MonthPicker selects a different month.
 */
export function useCurrentMonth(): {
  month: MonthKey;
  setMonth: (month: MonthKey) => void;
} {
  const month = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setMonth = useCallback((next: MonthKey) => {
    setSharedMonth(next);
  }, []);

  return { month, setMonth };
}
