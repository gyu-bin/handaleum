import {
  isPinExportBusy,
  setFullAlbumScanBusy,
} from '@/features/photos/services/mediaLibrary';
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
/** Let the open month paint + pin thumbs settle before album GPS. */
const MAP_KICKOFF_DELAY_MS = 8_000;
const MAP_PIN_IDLE_WAIT_MS = 40_000;

let inflight: Promise<StampLibrarySyncResult> | null = null;
let syncing = false;
/** Session-once deferred start from the map (survives screen unmount). */
let mapKickoffScheduled = false;
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
 * Once per JS session: wait for first-paint settle, then start the album scan.
 * Not cancelled when the map unmounts — that used to drop the only kickoff.
 */
export function scheduleStampLibrarySyncFromMap(): void {
  if (mapKickoffScheduled) {
    return;
  }
  mapKickoffScheduled = true;
  void (async () => {
    await new Promise((r) => setTimeout(r, MAP_KICKOFF_DELAY_MS));
    const deadline = Date.now() + MAP_PIN_IDLE_WAIT_MS;
    while (isPinExportBusy() && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 500));
    }
    void startStampLibrarySync();
  })();
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
    // already invalidated by placeResolve CACHE_REV. Do NOT zero
    // stampsLibrarySyncAt here: `force` already bypasses the cooldown, and a
    // zeroed timestamp flips syncStampsFromLibrary into deep recheck (network
    // re-reads of no-GPS assets) — a parse change never needs GPS re-reads.
    clearPlaceResolveCache();
  }

  syncing = true;
  setFullAlbumScanBusy(true);
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
      setFullAlbumScanBusy(false);
      emit();
    });
  inflight = run;
  return run;
}
