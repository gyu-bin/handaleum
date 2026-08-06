/**
 * Runnable check for stamp GPS → geocode resume gating.
 * Run: npx tsx src/features/stamps/services/stampSyncResume.check.ts
 */
import assert from 'node:assert/strict';

import {
  STAMP_GPS_RESUME_MS,
  shouldResumeGeocodeOnly,
  shouldSkipCoarseGeocode,
} from './stampSyncResume';

const now = 1_000_000_000_000;

assert.equal(
  shouldResumeGeocodeOnly({
    now,
    gpsScanAt: now - 60_000,
    librarySyncAt: 0,
    force: false,
  }),
  true,
  'incomplete geocode within window resumes',
);

assert.equal(
  shouldResumeGeocodeOnly({
    now,
    gpsScanAt: now - 60_000,
    librarySyncAt: now - 30_000,
    force: false,
  }),
  false,
  'completed full sync newer than GPS does not resume',
);

assert.equal(
  shouldResumeGeocodeOnly({
    now,
    gpsScanAt: now - STAMP_GPS_RESUME_MS - 1,
    librarySyncAt: 0,
    force: false,
  }),
  false,
  'stale GPS window does not resume',
);

assert.equal(
  shouldResumeGeocodeOnly({
    now,
    gpsScanAt: now - 60_000,
    librarySyncAt: 0,
    force: true,
  }),
  false,
  'user force never resumes',
);

assert.equal(
  shouldResumeGeocodeOnly({
    now,
    gpsScanAt: now - STAMP_GPS_RESUME_MS * 2,
    librarySyncAt: now - STAMP_GPS_RESUME_MS,
    force: false,
    parseRevRescan: true,
  }),
  true,
  'parse-rev reuses GPS even after completed sync',
);

assert.equal(
  shouldResumeGeocodeOnly({
    now,
    gpsScanAt: 0,
    librarySyncAt: 0,
    force: false,
    parseRevRescan: true,
  }),
  false,
  'parse-rev without GPS timestamp cannot resume',
);

assert.equal(
  shouldSkipCoarseGeocode({
    coarseGeocodeAt: now - 60_000,
    librarySyncAt: 0,
    force: false,
  }),
  true,
  'coarse done, fine incomplete → skip coarse',
);

assert.equal(
  shouldSkipCoarseGeocode({
    coarseGeocodeAt: now - 60_000,
    librarySyncAt: now - 30_000,
    force: false,
  }),
  false,
  'fine newer than coarse → do not skip',
);

assert.equal(
  shouldSkipCoarseGeocode({
    coarseGeocodeAt: now - 60_000,
    librarySyncAt: 0,
    force: false,
    parseRevRescan: true,
  }),
  false,
  'parse-rev redoes coarse',
);

console.log('stampSyncResume.check.ts: ok');
