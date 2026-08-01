import { useCallback, useSyncExternalStore } from 'react';

import type { StampsCollected } from '../types';
import {
  countCollected,
  markAllStampsSeen,
  readStampsCollected,
  readStampsUnseen,
} from '../services/stampsStorage';

type Snapshot = {
  collected: StampsCollected;
  unseen: string[];
  collectedCount: number;
  unseenCount: number;
};

let snapshot: Snapshot = buildSnapshot();
const listeners = new Set<() => void>();

function buildSnapshot(): Snapshot {
  const collected = readStampsCollected();
  const unseen = readStampsUnseen();
  return {
    collected,
    unseen,
    collectedCount: countCollected(collected),
    unseenCount: unseen.length,
  };
}

function emit(): void {
  snapshot = buildSnapshot();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Snapshot {
  return snapshot;
}

/** Call after any stamps kv write so subscribers refresh. */
export function notifyStampsChanged(): void {
  emit();
}

/**
 * Collected stamps + unseen badge count (sqlite kv + useSyncExternalStore).
 */
export function useStamps(): {
  collected: StampsCollected;
  unseen: string[];
  collectedCount: number;
  unseenCount: number;
  markAllSeen: () => void;
} {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const markAllSeen = useCallback(() => {
    if (state.unseenCount === 0) {
      return;
    }
    markAllStampsSeen();
    emit();
  }, [state.unseenCount]);

  return {
    collected: state.collected,
    unseen: state.unseen,
    collectedCount: state.collectedCount,
    unseenCount: state.unseenCount,
    markAllSeen,
  };
}
