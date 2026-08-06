/**
 * Decide whether a full-album stamp sync should skip the MediaLibrary GPS
 * phase and resume geocode from the last GPS snapshot.
 *
 * Full sync cooldown is handled by the runner before this runs.
 */

/** Same window as stampLibrarySyncRunner SYNC_COOLDOWN_MS. */
export const STAMP_GPS_RESUME_MS = 6 * 60 * 60 * 1000;

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
  // GPS finished more recently than a completed full sync (or never finished).
  return input.librarySyncAt < input.gpsScanAt;
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
