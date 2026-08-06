import { useCallback, useSyncExternalStore } from 'react';

import {
  getJourneyPathOrderVisible,
  setJourneyPathOrderVisible,
} from '@/lib/storage';

let visible = getJourneyPathOrderVisible();
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

function getSnapshot(): boolean {
  return visible;
}

function setSharedVisible(next: boolean): void {
  if (next === visible) {
    return;
  }
  visible = next;
  setJourneyPathOrderVisible(next);
  emit();
}

/**
 * Persist whether mid-segment visit-order numbers show on the home map.
 * Default on (storage absent ⇒ visible).
 */
export function useJourneyPathOrder(): {
  showPathOrder: boolean;
  setShowPathOrder: (next: boolean) => void;
  togglePathOrder: () => void;
} {
  const showPathOrder = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setShowPathOrder = useCallback((next: boolean) => {
    setSharedVisible(next);
  }, []);
  const togglePathOrder = useCallback(() => {
    setSharedVisible(!visible);
  }, []);

  return { showPathOrder, setShowPathOrder, togglePathOrder };
}
