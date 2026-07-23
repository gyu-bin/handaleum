import { useCallback, useSyncExternalStore } from 'react';

import { getOnboardingSeen, setOnboardingSeen } from '@/lib/storage';

let seen: boolean = getOnboardingSeen();
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
  return seen;
}

function markSeenShared(): void {
  if (seen) {
    return;
  }
  seen = true;
  setOnboardingSeen();
  emit();
}

/**
 * Whether the first-run onboarding has been completed. Persists to sqlite kv;
 * syncs via useSyncExternalStore so the map screen's redirect gate updates the
 * instant onboarding finishes (mirrors useCurrentMonth).
 */
export function useOnboarding(): { seen: boolean; markSeen: () => void } {
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const markSeen = useCallback(() => markSeenShared(), []);
  return { seen: value, markSeen };
}
