/**
 * Decide whether a full-album stamp sync should skip the MediaLibrary GPS
 * phase and resume geocode from the last GPS snapshot.
 *
 * Full sync cooldown is handled by the runner before this runs.
 */

/** Same window as stampLibrarySyncRunner SYNC_COOLDOWN_MS. */
export const STAMP_GPS_RESUME_MS = 6 * 60 * 60 * 1000;

/** Weekly full MediaLibrary walk (iCloud no-GPS catch-up). */
export const STAMP_DEEP_RECHECK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * MediaLibrary `createdAfter` for "photos added since last album walk".
 * No snapshot / no cursor → undefined (full scan).
 */
export function albumDeltaCreatedAfterMs(input: {
  snapshotCount: number;
  gpsScanAt: number;
  librarySyncAt: number;
}): number | undefined {
  if (input.snapshotCount <= 0) {
    return undefined;
  }
  if (input.gpsScanAt > 0) {
    return input.gpsScanAt;
  }
  if (input.librarySyncAt > 0) {
    return input.librarySyncAt;
  }
  return undefined;
}

/** Append newly located photos; skip ids already in the snapshot. */
export function mergeLocatedPhotos<T extends { assetId: string }>(
  prev: T[],
  added: T[],
): { merged: T[]; fresh: T[] } {
  if (added.length === 0) {
    return { merged: prev, fresh: [] };
  }
  if (prev.length === 0) {
    return { merged: added, fresh: added };
  }
  const seen = new Set(prev.map((photo) => photo.assetId));
  const fresh = added.filter((photo) => !seen.has(photo.assetId));
  if (fresh.length === 0) {
    return { merged: prev, fresh: [] };
  }
  return { merged: prev.concat(fresh), fresh };
}

/**
 * Approach A: reuse on-disk GPS list instead of re-listing the album.
 * Skip when user forces a rescan or the weekly deep recheck is due.
 */
export function shouldReuseLocatedSnapshot(input: {
  force: boolean;
  hasSnapshot: boolean;
  librarySyncAt: number;
  now: number;
  deepRecheckMs?: number;
}): boolean {
  if (input.force || !input.hasSnapshot) {
    return false;
  }
  const deepMs = input.deepRecheckMs ?? STAMP_DEEP_RECHECK_MS;
  if (
    input.librarySyncAt > 0 &&
    input.now - input.librarySyncAt >= deepMs
  ) {
    return false;
  }
  return true;
}

export function shouldResumeGeocodeOnly(input: {
  now: number;
  gpsScanAt: number;
  librarySyncAt: number;
  /** User-requested full rescan — never reuse GPS snapshot. */
  force: boolean;
  /** Place-parse rev bump: coords unchanged, redo names only. */
  parseRevRescan?: boolean;
  resumeWindowMs?: number;
}): boolean {
  if (input.force) {
    return false;
  }
  if (input.gpsScanAt <= 0) {
    return false;
  }
  if (input.parseRevRescan) {
    return true;
  }
  const windowMs = input.resumeWindowMs ?? STAMP_GPS_RESUME_MS;
  if (input.now - input.gpsScanAt >= windowMs) {
    return false;
  }
  // Fresh GPS on disk — reuse whether or not dong match finished.
  return true;
}

/**
 * Skip Pass A (coarse ~1km) when it already finished more recently than the
 * full (fine) sync — i.e. fine catch-up was interrupted.
 */
export function shouldSkipCoarseGeocode(input: {
  coarseGeocodeAt: number;
  librarySyncAt: number;
  force: boolean;
  /** Parse-rev must redo names from coarse again. */
  parseRevRescan?: boolean;
}): boolean {
  if (input.force || input.parseRevRescan) {
    return false;
  }
  if (input.coarseGeocodeAt <= 0) {
    return false;
  }
  return input.librarySyncAt < input.coarseGeocodeAt;
}
