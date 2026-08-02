import {
  syncStampsFromLibrary,
  type StampLibrarySyncResult,
} from './stampBackfill';

type Listener = (syncing: boolean) => void;

let inflight: Promise<StampLibrarySyncResult> | null = null;
let syncing = false;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) {
    listener(syncing);
  }
}

export function isStampLibrarySyncing(): boolean {
  return syncing;
}

export function subscribeStampLibrarySync(listener: Listener): () => void {
  listeners.add(listener);
  listener(syncing);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Single-flight full-album stamp sync. Safe to call from map + stamps screen.
 * No-ops into the same promise if already running.
 */
export function startStampLibrarySync(): Promise<StampLibrarySyncResult> {
  if (inflight) {
    return inflight;
  }
  syncing = true;
  emit();
  const run = syncStampsFromLibrary()
    .catch((error): StampLibrarySyncResult => {
      console.warn('[stamps] library sync failed', error);
      return { added: 0, photoCount: 0 };
    })
    .finally(() => {
      inflight = null;
      syncing = false;
      emit();
    });
  inflight = run;
  return run;
}
