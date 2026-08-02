import { clearPlaceResolveCache } from '@/features/photos/services/placeResolve';
import {
  getStampsLibrarySyncAt,
  getStampsPlaceParseRev,
  setStampsLibrarySyncAt,
  setStampsPlaceParseRev,
  STAMPS_PLACE_PARSE_REV,
} from '@/lib/storage';

import {
  syncStampsFromLibrary,
  type StampLibrarySyncResult,
} from './stampBackfill';

type Listener = (syncing: boolean) => void;

/** Skip restarting a full-album scan if one finished within this window. */
const SYNC_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

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

export type StartStampLibrarySyncOptions = {
  /** Ignore cooldown (e.g. user explicitly asked to rescan). */
  force?: boolean;
};

/**
 * Single-flight full-album stamp sync. Safe to call from map + stamps screen.
 * Place-parse revision bumps force one rescan; rev only locks after a scan that
 * actually saw photos (so a failed/empty run does not skip the real fix).
 */
export function startStampLibrarySync(
  options?: StartStampLibrarySyncOptions,
): Promise<StampLibrarySyncResult> {
  if (inflight) {
    return inflight;
  }

  const parseRevStale = getStampsPlaceParseRev() < STAMPS_PLACE_PARSE_REV;
  const force = options?.force === true || parseRevStale;

  if (!force) {
    const last = getStampsLibrarySyncAt();
    if (last > 0 && Date.now() - last < SYNC_COOLDOWN_MS) {
      return Promise.resolve({ added: 0, photoCount: 0 });
    }
  }

  if (parseRevStale || options?.force) {
    // Drop in-memory geocode results so the new parser runs; disk keys are
    // already invalidated by placeResolve CACHE_REV.
    clearPlaceResolveCache();
    // Allow the scan even if a previous sync finished moments ago.
    setStampsLibrarySyncAt(0);
  }

  syncing = true;
  emit();
  const run = syncStampsFromLibrary()
    .then((result) => {
      setStampsLibrarySyncAt(Date.now());
      // Only lock rev after we actually scanned the library.
      if (result.photoCount > 0) {
        setStampsPlaceParseRev(STAMPS_PLACE_PARSE_REV);
      }
      return result;
    })
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
