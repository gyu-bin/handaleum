/**
 * Runnable check for stamp GPS snapshot reuse / resume gating.
 * Run: npx tsx src/features/stamps/services/stampSyncResume.check.ts
 */
import assert from 'node:assert/strict';

import {
  STAMP_DEEP_RECHECK_MS,
  STAMP_GPS_RESUME_MS,
  albumDeltaCreatedAfterMs,
  mergeLocatedPhotos,
  shouldReuseLocatedSnapshot,
  shouldResumeGeocodeOnly,
  shouldSkipCoarseGeocode,
} from './stampSyncResume';

const now = 1_000_000_000_000;

assert.equal(
  shouldReuseLocatedSnapshot({
    force: false,
    hasSnapshot: true,
    librarySyncAt: now - 60_000,
    now,
  }),
  true,
  'fresh sync + snapshot → reuse',
);

assert.equal(
  shouldReuseLocatedSnapshot({
    force: false,
    hasSnapshot: true,
    librarySyncAt: now - STAMP_DEEP_RECHECK_MS - 1,
    now,
  }),
  false,
  'weekly deep recheck due → full GPS',
);

assert.equal(
  shouldReuseLocatedSnapshot({
    force: true,
    hasSnapshot: true,
    librarySyncAt: now - 60_000,
    now,
  }),
  false,
  'force never reuses',
);

assert.equal(
  shouldReuseLocatedSnapshot({
    force: false,
    hasSnapshot: false,
    librarySyncAt: 0,
    now,
  }),
  false,
  'no snapshot → cannot reuse',
);

assert.equal(
  shouldResumeGeocodeOnly({
    now,
    gpsScanAt: now - 60_000,
    librarySyncAt: 0,
    force: false,
  }),
  true,
  'fresh GPS resumes',
);

assert.equal(
  shouldResumeGeocodeOnly({
    now,
    gpsScanAt: now - 60_000,
    librarySyncAt: now - 30_000,
    force: false,
  }),
  true,
  'fresh GPS reuses even after completed sync',
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

assert.equal(
  albumDeltaCreatedAfterMs({
    snapshotCount: 0,
    gpsScanAt: now,
    librarySyncAt: now,
  }),
  undefined,
  'no snapshot → full scan',
);

assert.equal(
  albumDeltaCreatedAfterMs({
    snapshotCount: 10,
    gpsScanAt: now - 60_000,
    librarySyncAt: now - 30_000,
  }),
  now - 60_000,
  'GPS cursor wins',
);

assert.equal(
  albumDeltaCreatedAfterMs({
    snapshotCount: 10,
    gpsScanAt: 0,
    librarySyncAt: now - 30_000,
  }),
  now - 30_000,
  'library sync cursor if GPS missing',
);

assert.equal(
  albumDeltaCreatedAfterMs({
    snapshotCount: 10,
    gpsScanAt: 0,
    librarySyncAt: 0,
  }),
  undefined,
  'snapshot without cursor → full scan',
);

assert.deepEqual(
  mergeLocatedPhotos([], [{ assetId: 'a' }]).fresh.map((p) => p.assetId),
  ['a'],
  'empty prev → all added are fresh',
);

const merged = mergeLocatedPhotos(
  [{ assetId: 'a' }, { assetId: 'b' }],
  [{ assetId: 'b' }, { assetId: 'c' }],
);
assert.deepEqual(
  merged.fresh.map((p) => p.assetId),
  ['c'],
  'skip ids already in snapshot',
);
assert.deepEqual(
  merged.merged.map((p) => p.assetId),
  ['a', 'b', 'c'],
  'append only new ids',
);
assert.equal(
  mergeLocatedPhotos([{ assetId: 'a' }], [{ assetId: 'a' }]).fresh.length,
  0,
  'no-op when nothing new',
);

console.log('stampSyncResume.check.ts: ok');
