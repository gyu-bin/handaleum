import {
  isPinExportBusy,
  setFullAlbumScanBusy,
} from '@/features/photos/services/mediaLibrary';
import { isDevDummyPhotosEnabled } from '@/features/photos/services/dummyPhotos';
import {
  releaseIndexingBackground,
  retainIndexingBackground,
} from '@/features/photos/services/indexingBackground';
import { clearPlaceResolveCache } from '@/features/photos/services/placeResolve';
import {
  getStampsGpsScanAt,
  getStampsLibrarySyncAt,
  getStampsPlaceParseRev,
  setStampsCoarseGeocodeAt,
  setStampsGpsScanAt,
  setStampsLibrarySyncAt,
  setStampsPlaceParseRev,
  STAMPS_PLACE_PARSE_REV,
} from '@/lib/storage';

import { clearLocatedPhotosSnapshot } from './locatedPhotosSnapshot';
import {
  resetStampLibraryProgress,
  syncStampsFromLibrary,
  type StampLibrarySyncResult,
} from './stampBackfill';
import {
  STAMP_GPS_RESUME_MS,
  shouldResumeGeocodeOnly,
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
  /** Ignore cooldown (e.g. user explicitly asked to rescan). */
  force?: boolean;
};

/**
 * Single-flight full-album stamp sync.
 * GPS → offline dong PIP (no CLGeocoder). Resumes from GPS snapshot when killed.
 */
export function startStampLibrarySync(
  options?: StartStampLibrarySyncOptions,
): Promise<StampLibrarySyncResult> {
  if (inflight) {
    return inflight;
  }

  const parseRevStale = getStampsPlaceParseRev() < STAMPS_PLACE_PARSE_REV;
  const userForce = options?.force === true;
  const now = Date.now();

  if (!userForce && !parseRevStale) {
    const last = getStampsLibrarySyncAt();
    if (last > 0 && now - last < SYNC_COOLDOWN_MS) {
      return Promise.resolve({ added: 0, photoCount: 0 });
    }
  }

  const resumeGeocodeOnly =
    !isDevDummyPhotosEnabled() &&
    shouldResumeGeocodeOnly({
      now,
      gpsScanAt: getStampsGpsScanAt(),
      librarySyncAt: getStampsLibrarySyncAt(),
      force: userForce,
      parseRevRescan: parseRevStale,
    });

  syncing = true;
  setFullAlbumScanBusy(true);
  retainIndexingBackground();
  emit();
  const run = (async () => {
    if (userForce || isDevDummyPhotosEnabled()) {
      clearPlaceResolveCache();
      setStampsGpsScanAt(0);
      setStampsCoarseGeocodeAt(0);
      await clearLocatedPhotosSnapshot();
    } else if (parseRevStale) {
      clearPlaceResolveCache();
      setStampsCoarseGeocodeAt(0);
    }

    return syncStampsFromLibrary({ resumeGeocodeOnly });
  })()
    .then((result) => {
      setStampsLibrarySyncAt(Date.now());
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
      releaseIndexingBackground();
      emit();
      setTimeout(() => {
        if (!isStampLibrarySyncing()) {
          resetStampLibraryProgress();
        }
      }, 400);
    });
  inflight = run;
  return run;
}
