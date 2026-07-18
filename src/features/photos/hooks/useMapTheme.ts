import { useCallback, useSyncExternalStore } from 'react';

import { readMapThemeId, writeMapThemeId } from '../services/mapThemeStorage';
import type { MapThemeId } from '../types';

let currentTheme: MapThemeId = readMapThemeId();
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

function getSnapshot(): MapThemeId {
  return currentTheme;
}

function setSharedTheme(next: MapThemeId): void {
  if (next === currentTheme) {
    return;
  }
  currentTheme = next;
  writeMapThemeId(next);
  emit();
}

/**
 * Shared paper-map palette. Persists to sqlite kv-store.
 */
export function useMapTheme(): {
  themeId: MapThemeId;
  setThemeId: (id: MapThemeId) => void;
} {
  const themeId = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setThemeId = useCallback((next: MapThemeId) => {
    setSharedTheme(next);
  }, []);

  return { themeId, setThemeId };
}
