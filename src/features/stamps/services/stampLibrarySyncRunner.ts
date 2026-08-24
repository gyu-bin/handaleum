import {
  DUMMY_HUBS_REV,
  isDevDummyPhotosEnabled,
} from '@/features/photos/services/dummyPhotos';
import {
  isPinExportBusy,
  setFullAlbumScanBusy,
} from '@/features/photos/services/mediaLibrary';
import {
  releaseIndexingBackground,
  retainIndexingBackground,
} from '@/features/photos/services/indexingBackground';
import { clearPlaceResolveCache } from '@/features/photos/services/placeResolve';
import {
  getDevDummyHubsRev,
  getStampsLibrarySyncAt,
  getStampsPlaceParseRev,
  setDevDummyHubsRev,
  setStampsCoarseGeocodeAt,
  setStampsGpsScanAt,
  setStampsLibrarySyncAt,
  setStampsPlaceParseRev,
  STAMPS_PLACE_PARSE_REV,
} from '@/lib/storage';

import {
  clearLocatedPhotosSnapshot,
  hasLocatedPhotosSnapshot,
} from './locatedPhotosSnapshot';
import {
  resetStampLibraryProgress,
  syncStampsFromLibrary,
  type StampLibrarySyncResult,
} from './stampBackfill';
import { prebuildStampDongPhotoIndex } from './stampDongPhotos';
import {
  STAMP_DEEP_RECHECK_MS,
  STAMP_GPS_RESUME_MS,
  shouldReuseLocatedSnapshot,
} from './stampSyncResume';

type Listener = (syncing: boolean) => void;

/** Skip restarting a finished full-album sync if one finished within this window. */
const SYNC_COOLDOWN_MS = STAMP_GPS_RESUME_MS;
/** Settle after month GPS so pin thumb exports can start before album scan. */
const MAP_KICKOFF_DELAY_MS = 1_800;
/** Wait for first pin-export wave; scan still yields while later pins decode. */
const MAP_PIN_IDLE_WAIT_MS = 4_000;

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
  /** Ignore cooldown and wipe GPS snapshot (sample hubs / sparse dummy). */
  force?: boolean;
  /** Ignore cooldown; only walk assets newer than the last GPS scan. */
  incremental?: boolean;
};

/**
 * Single-flight stamp sync.
 * GPS → offline dong PIP. Reuses located snapshot when present (Approach A).
 */
export function startStampLibrarySync(
  options?: StartStampLibrarySyncOptions,
): Promise<StampLibrarySyncResult> {
  if (inflight) {
    return inflight;
  }

  const parseRevStale = getStampsPlaceParseRev() < STAMPS_PLACE_PARSE_REV;
  const dummyHubsStale =
    isDevDummyPhotosEnabled() && getDevDummyHubsRev() < DUMMY_HUBS_REV;
  const userForce = options?.force === true || dummyHubsStale;
  const userIncremental = options?.incremental === true && !userForce;
  const now = Date.now();
  const librarySyncAt = getStampsLibrarySyncAt();

  if (!userForce && !userIncremental && !parseRevStale) {
    if (librarySyncAt > 0 && now - librarySyncAt < SYNC_COOLDOWN_MS) {
      // Warm dong popup index without touching MediaLibrary.
      void prebuildStampDongPhotoIndex();
      return Promise.resolve({ added: 0, photoCount: 0 });
    }
  }

  const run = (async () => {
    const hasSnap = await hasLocatedPhotosSnapshot();
    const resumeGeocodeOnly =
      !userIncremental &&
      shouldReuseLocatedSnapshot({
        force: userForce,
        hasSnapshot: hasSnap,
        librarySyncAt,
        now,
        deepRecheckMs: STAMP_DEEP_RECHECK_MS,
      });

    syncing = true;
    setFullAlbumScanBusy(true);
    retainIndexingBackground();
    emit();

    try {
      // Forced rescan (user or new sample hubs) drops the GPS snapshot.
      if (userForce) {
        clearPlaceResolveCache();
        setStampsGpsScanAt(0);
        setStampsCoarseGeocodeAt(0);
        await clearLocatedPhotosSnapshot();
      } else if (parseRevStale) {
        clearPlaceResolveCache();
        setStampsCoarseGeocodeAt(0);
      }

      const result = await syncStampsFromLibrary({
        resumeGeocodeOnly,
        incremental: userIncremental,
      });
      setStampsLibrarySyncAt(Date.now());
      if (result.photoCount > 0) {
        setStampsPlaceParseRev(STAMPS_PLACE_PARSE_REV);
        if (isDevDummyPhotosEnabled()) {
          setDevDummyHubsRev(DUMMY_HUBS_REV);
        }
      }
      return result;
    } catch (error) {
      console.warn('[stamps] library sync failed', error);
      return { added: 0, photoCount: 0 };
    } finally {
      inflight = null;
      syncing = false;
      setFullAlbumScanBusy(false);
      releaseIndexingBackground();
      emit();
      setTimeout(() => {
        if (!isStampLibrarySyncing()) {
          resetStampLibraryProgress();
        }
      }, 400);
    }
  })();

  inflight = run;
  return run;
}
